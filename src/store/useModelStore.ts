'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMemo } from 'react';
import type { Assumptions } from '@/lib/model/types';
import { DEFAULT_ASSUMPTIONS, makeBlankAssumptions } from '@/lib/model/defaults';
import { runModel } from '@/lib/model/engine';
import type { ForSaleAssumptions } from '@/lib/forsale/types';
import { TH_TEMPLATE_ASSUMPTIONS, makeBlankForSale } from '@/lib/forsale/defaults';
import { runForSaleModel } from '@/lib/forsale/engine';
import { isForSale, kindOf, runAny, tryRunAny, type AnyAssumptions, type ModelKind } from '@/lib/any';
import { createClient } from '@/lib/supabase/client';

export interface Scenario {
  id: string;
  name: string;
  savedAt: string;
  assumptions: AnyAssumptions;
}

export interface ProjectMeta {
  name: string;
  city: string;
  state: string;
  constructionType: string;
}

export interface Project extends ProjectMeta {
  id: string;
  createdAt: string;
  updatedAt: string;
  baseCase: AnyAssumptions;
  scenarios: Scenario[];
}

/** 'blank' = zeroed rental assumptions, 'blankForSale' = zeroed for-sale assumptions; otherwise copy an existing deal's base case. */
export type ProjectTemplate = 'blank' | 'blankForSale' | { copyFrom: string };

/** A scenario starts from the base case (null), another scenario (its id) or the for-sale townhome template. */
export type ScenarioSource = string | null | { template: 'forSale' };

const clone = <T,>(v: T): T => structuredClone(v);

/** A deep copy of a case under a new deal name, whichever kind it is. */
const renamed = (a: AnyAssumptions, name: string): AnyAssumptions =>
  isForSale(a) ? { ...clone(a), project: { ...a.project, name } } : { ...clone(a), project: { ...a.project, name } };

/**
 * Projects captured from the pre-Supabase localStorage schema (v2) during
 * persist migration; uploaded once on first load if the server is empty.
 */
let legacyProjects: Project[] | null = null;

/** Single-flight guard: init() is called from multiple mounts; run once. */
let initPromise: Promise<void> | null = null;

interface ModelStore {
  /** Server state has been fetched at least once. */
  loaded: boolean;
  syncError: string | null;
  projects: Project[];
  activeProjectId: string | null;
  /** null = the project's base case */
  activeScenarioId: string | null;
  /** Working draft — what every input page edits and every output reflects (rental or for-sale). */
  assumptions: AnyAssumptions;
  dirty: boolean;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Edit a rental draft. A no-op while a for-sale case is open (the pages branch on kind, so this never fires then). */
  update: (fn: (draft: Assumptions) => Assumptions) => void;
  /** Edit a for-sale draft. A no-op while a rental case is open. */
  updateForSale: (fn: (draft: ForSaleAssumptions) => ForSaleAssumptions) => void;
  save: () => Promise<void>;
  saveAsScenario: (name: string) => Promise<void>;
  setAsBaseCase: () => Promise<void>;
  discard: () => void;
  switchScenario: (scenarioId: string | null) => void;
  switchProject: (projectId: string) => void;
  /** Make a deal + scenario (null = base case) the working draft. */
  openScenario: (projectId: string, scenarioId: string | null) => void;
  /** Returns the new project's id, or null if the insert failed. */
  createProject: (meta: ProjectMeta, template: ProjectTemplate) => Promise<string | null>;
  /** Adds a scenario to any deal, copied from its base case (null) or another scenario. Does not touch the draft. */
  createScenario: (projectId: string, name: string, from: ScenarioSource) => Promise<string | null>;
  updateProjectMeta: (projectId: string, patch: Partial<ProjectMeta>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  renameScenario: (scenarioId: string, name: string) => Promise<void>;
  deleteScenario: (scenarioId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const activeProjectOf = (s: Pick<ModelStore, 'projects' | 'activeProjectId'>): Project | undefined =>
  s.projects.find((p) => p.id === s.activeProjectId) ?? s.projects[0];

const savedSnapshot = (project: Project | undefined, scenarioId: string | null): AnyAssumptions => {
  if (!project) return DEFAULT_ASSUMPTIONS;
  if (scenarioId === null) return project.baseCase;
  return project.scenarios.find((sc) => sc.id === scenarioId)?.assumptions ?? project.baseCase;
};

async function fetchProjects(): Promise<Project[]> {
  const supabase = createClient();
  const [projectsRes, scenariosRes] = await Promise.all([
    supabase
      .from('montierra_projects')
      .select('id,name,city,state,construction_type,created_at,updated_at,base_case')
      .order('created_at'),
    supabase.from('montierra_scenarios').select('id,project_id,name,saved_at,assumptions').order('saved_at'),
  ]);
  if (projectsRes.error) throw new Error(projectsRes.error.message);
  if (scenariosRes.error) throw new Error(scenariosRes.error.message);
  return (projectsRes.data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    city: (p.city as string) ?? '',
    state: (p.state as string) ?? '',
    constructionType: (p.construction_type as string) ?? '',
    createdAt: p.created_at as string,
    updatedAt: (p.updated_at as string) ?? (p.created_at as string),
    baseCase: p.base_case as AnyAssumptions,
    scenarios: (scenariosRes.data ?? [])
      .filter((sc) => sc.project_id === p.id)
      .map((sc) => ({
        id: sc.id as string,
        name: sc.name as string,
        savedAt: sc.saved_at as string,
        assumptions: sc.assumptions as AnyAssumptions,
      })),
  }));
}

export const useModelStore = create<ModelStore>()(
  persist(
    (set, get) => {
      const sync = async (fn: () => Promise<void>): Promise<void> => {
        try {
          await fn();
          set({ syncError: null });
        } catch (e) {
          set({ syncError: e instanceof Error ? e.message : 'Sync failed' });
        }
      };

      const reconcile = (projects: Project[]) => {
        const s = get();
        let activeProjectId = s.activeProjectId;
        if (!projects.some((p) => p.id === activeProjectId)) {
          activeProjectId = projects[0]?.id ?? null;
        }
        const project = projects.find((p) => p.id === activeProjectId);
        let activeScenarioId = s.activeScenarioId;
        if (activeScenarioId !== null && !project?.scenarios.some((sc) => sc.id === activeScenarioId)) {
          activeScenarioId = null;
        }
        // Keep an unsaved draft; otherwise show the saved snapshot.
        const keepDraft = s.dirty && s.activeProjectId === activeProjectId;
        set({
          projects,
          activeProjectId,
          activeScenarioId,
          loaded: true,
          ...(keepDraft ? {} : { assumptions: clone(savedSnapshot(project, activeScenarioId)), dirty: false }),
        });
      };

      return {
        loaded: false,
        syncError: null,
        projects: [],
        activeProjectId: null,
        activeScenarioId: null,
        assumptions: DEFAULT_ASSUMPTIONS,
        dirty: false,

        init: async () => {
          if (get().loaded) return;
          if (initPromise) return initPromise;
          initPromise = (async () => {
          await sync(async () => {
            let projects = await fetchProjects();
            const supabase = createClient();
            if (projects.length === 0) {
              // First load ever: migrate pre-Supabase local projects, or seed
              // the Montierra workbook base case.
              const toUpload =
                legacyProjects && legacyProjects.length > 0
                  ? legacyProjects
                  : [
                      {
                        id: '',
                        name: 'Montierra Ph. II',
                        city: 'Leander',
                        state: 'TX',
                        constructionType: 'Surface MF',
                        createdAt: '',
                        updatedAt: '',
                        baseCase: DEFAULT_ASSUMPTIONS,
                        scenarios: [],
                      },
                    ];
              for (const p of toUpload) {
                const { data: row, error } = await supabase
                  .from('montierra_projects')
                  .insert({
                    name: p.name,
                    city: p.city ?? '',
                    state: p.state ?? '',
                    construction_type: p.constructionType ?? '',
                    base_case: p.baseCase,
                  })
                  .select('id')
                  .single();
                if (error) throw new Error(error.message);
                if (p.scenarios.length > 0) {
                  const { error: scErr } = await supabase.from('montierra_scenarios').insert(
                    p.scenarios.map((sc) => ({
                      project_id: row.id,
                      name: sc.name,
                      assumptions: sc.assumptions,
                    })),
                  );
                  if (scErr) throw new Error(scErr.message);
                }
              }
              legacyProjects = null;
              projects = await fetchProjects();
            }
            reconcile(projects);
          });
          if (get().syncError) set({ loaded: true }); // don't block the UI on sync failure
          })();
          try {
            await initPromise;
          } finally {
            initPromise = null;
          }
        },

        refresh: async () => {
          await sync(async () => reconcile(await fetchProjects()));
        },

        update: (fn) =>
          set((s) => (isForSale(s.assumptions) ? s : { assumptions: fn(clone(s.assumptions)), dirty: true })),

        updateForSale: (fn) =>
          set((s) => (isForSale(s.assumptions) ? { assumptions: fn(clone(s.assumptions)), dirty: true } : s)),

        save: async () => {
          const s = get();
          const draft = clone(s.assumptions);
          await sync(async () => {
            const supabase = createClient();
            if (s.activeScenarioId === null) {
              if (!s.activeProjectId) return;
              const { error } = await supabase
                .from('montierra_projects')
                .update({ base_case: draft, updated_at: new Date().toISOString() })
                .eq('id', s.activeProjectId);
              if (error) throw new Error(error.message);
            } else {
              const { error } = await supabase
                .from('montierra_scenarios')
                .update({ assumptions: draft, saved_at: new Date().toISOString() })
                .eq('id', s.activeScenarioId);
              if (error) throw new Error(error.message);
            }
            set({
              dirty: false,
              projects: get().projects.map((p) => {
                if (p.id !== s.activeProjectId) return p;
                if (s.activeScenarioId === null) return { ...p, baseCase: draft, updatedAt: new Date().toISOString() };
                return {
                  ...p,
                  scenarios: p.scenarios.map((sc) =>
                    sc.id === s.activeScenarioId ? { ...sc, assumptions: draft, savedAt: new Date().toISOString() } : sc,
                  ),
                };
              }),
            });
          });
        },

        saveAsScenario: async (name) => {
          const s = get();
          if (!s.activeProjectId) return;
          const draft = clone(s.assumptions);
          await sync(async () => {
            const supabase = createClient();
            const { data: row, error } = await supabase
              .from('montierra_scenarios')
              .insert({ project_id: s.activeProjectId, name, assumptions: draft })
              .select('id,saved_at')
              .single();
            if (error) throw new Error(error.message);
            const scenario: Scenario = {
              id: row.id as string,
              name,
              savedAt: row.saved_at as string,
              assumptions: draft,
            };
            set({
              dirty: false,
              activeScenarioId: scenario.id,
              projects: get().projects.map((p) =>
                p.id === s.activeProjectId ? { ...p, scenarios: [...p.scenarios, scenario] } : p,
              ),
            });
          });
        },

        setAsBaseCase: async () => {
          const s = get();
          if (!s.activeProjectId) return;
          const draft = clone(s.assumptions);
          await sync(async () => {
            const supabase = createClient();
            const { error } = await supabase
              .from('montierra_projects')
              .update({ base_case: draft, updated_at: new Date().toISOString() })
              .eq('id', s.activeProjectId);
            if (error) throw new Error(error.message);
            set({
              dirty: false,
              activeScenarioId: null,
              projects: get().projects.map((p) =>
                p.id === s.activeProjectId ? { ...p, baseCase: draft, updatedAt: new Date().toISOString() } : p,
              ),
            });
          });
        },

        discard: () =>
          set((s) => ({
            dirty: false,
            assumptions: clone(savedSnapshot(activeProjectOf(s), s.activeScenarioId)),
          })),

        switchScenario: (scenarioId) =>
          set((s) => ({
            activeScenarioId: scenarioId,
            dirty: false,
            assumptions: clone(savedSnapshot(activeProjectOf(s), scenarioId)),
          })),

        switchProject: (projectId) =>
          set((s) => {
            const project = s.projects.find((p) => p.id === projectId);
            if (!project) return s;
            return {
              activeProjectId: projectId,
              activeScenarioId: null,
              dirty: false,
              assumptions: clone(project.baseCase),
            };
          }),

        openScenario: (projectId, scenarioId) =>
          set((s) => {
            const project = s.projects.find((p) => p.id === projectId);
            if (!project) return s;
            const id = scenarioId !== null && project.scenarios.some((sc) => sc.id === scenarioId) ? scenarioId : null;
            return {
              activeProjectId: projectId,
              activeScenarioId: id,
              dirty: false,
              assumptions: clone(savedSnapshot(project, id)),
            };
          }),

        createProject: async (meta, template) => {
          const source =
            typeof template === 'string' ? undefined : get().projects.find((p) => p.id === template.copyFrom);
          const baseCase: AnyAssumptions = source
            ? renamed(source.baseCase, meta.name)
            : template === 'blankForSale'
              ? makeBlankForSale(meta.name)
              : makeBlankAssumptions(meta.name);
          baseCase.project.location = [meta.city, meta.state].filter(Boolean).join(', ');
          baseCase.project.productType = meta.constructionType;
          let newId: string | null = null;
          await sync(async () => {
            const supabase = createClient();
            const { data: row, error } = await supabase
              .from('montierra_projects')
              .insert({
                name: meta.name,
                city: meta.city,
                state: meta.state,
                construction_type: meta.constructionType,
                base_case: baseCase,
              })
              .select('id,created_at')
              .single();
            if (error) throw new Error(error.message);
            newId = row.id as string;
            const project: Project = {
              id: row.id as string,
              ...meta,
              createdAt: row.created_at as string,
              updatedAt: row.created_at as string,
              baseCase,
              scenarios: [],
            };
            set({
              projects: [...get().projects, project],
              activeProjectId: project.id,
              activeScenarioId: null,
              dirty: false,
              assumptions: clone(baseCase),
            });
          });
          return newId;
        },

        createScenario: async (projectId, name, from) => {
          const project = get().projects.find((p) => p.id === projectId);
          if (!project) return null;
          const assumptions: AnyAssumptions =
            from !== null && typeof from === 'object'
              ? { ...clone(TH_TEMPLATE_ASSUMPTIONS), project: { ...clone(TH_TEMPLATE_ASSUMPTIONS.project), name: project.name } }
              : clone(savedSnapshot(project, from));
          let newId: string | null = null;
          await sync(async () => {
            const supabase = createClient();
            const { data: row, error } = await supabase
              .from('montierra_scenarios')
              .insert({ project_id: projectId, name, assumptions })
              .select('id,saved_at')
              .single();
            if (error) throw new Error(error.message);
            newId = row.id as string;
            const scenario: Scenario = { id: newId, name, savedAt: row.saved_at as string, assumptions };
            set({
              projects: get().projects.map((p) =>
                p.id === projectId ? { ...p, scenarios: [...p.scenarios, scenario] } : p,
              ),
            });
          });
          return newId;
        },

        updateProjectMeta: async (projectId, patch) => {
          await sync(async () => {
            const supabase = createClient();
            const dbPatch: Record<string, string> = { updated_at: new Date().toISOString() };
            if (patch.name !== undefined) dbPatch.name = patch.name;
            if (patch.city !== undefined) dbPatch.city = patch.city;
            if (patch.state !== undefined) dbPatch.state = patch.state;
            if (patch.constructionType !== undefined) dbPatch.construction_type = patch.constructionType;
            const { error } = await supabase
              .from('montierra_projects')
              .update(dbPatch)
              .eq('id', projectId);
            if (error) throw new Error(error.message);
            set({
              projects: get().projects.map((p) => (p.id === projectId ? { ...p, ...patch } : p)),
            });
          });
        },

        deleteProject: async (projectId) => {
          const s = get();
          if (s.projects.length <= 1) return;
          await sync(async () => {
            const supabase = createClient();
            const { error } = await supabase.from('montierra_projects').delete().eq('id', projectId);
            if (error) throw new Error(error.message);
            const projects = get().projects.filter((p) => p.id !== projectId);
            if (get().activeProjectId !== projectId) {
              set({ projects });
              return;
            }
            const next = projects[0];
            set({
              projects,
              activeProjectId: next.id,
              activeScenarioId: null,
              dirty: false,
              assumptions: clone(next.baseCase),
            });
          });
        },

        renameScenario: async (scenarioId, name) => {
          await sync(async () => {
            const supabase = createClient();
            const { error } = await supabase
              .from('montierra_scenarios')
              .update({ name })
              .eq('id', scenarioId);
            if (error) throw new Error(error.message);
            set({
              projects: get().projects.map((p) => ({
                ...p,
                scenarios: p.scenarios.map((sc) => (sc.id === scenarioId ? { ...sc, name } : sc)),
              })),
            });
          });
        },

        deleteScenario: async (scenarioId) => {
          await sync(async () => {
            const supabase = createClient();
            const { error } = await supabase.from('montierra_scenarios').delete().eq('id', scenarioId);
            if (error) throw new Error(error.message);
            const s = get();
            const projects = s.projects.map((p) => ({
              ...p,
              scenarios: p.scenarios.filter((sc) => sc.id !== scenarioId),
            }));
            if (s.activeScenarioId !== scenarioId) {
              set({ projects });
              return;
            }
            const project = projects.find((p) => p.id === s.activeProjectId);
            set({
              projects,
              activeScenarioId: null,
              dirty: false,
              assumptions: clone(project?.baseCase ?? DEFAULT_ASSUMPTIONS),
            });
          });
        },

        signOut: async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          window.location.href = '/login';
        },
      };
    },
    {
      name: 'montierra-ph2-assumptions',
      version: 3,
      // Projects now live in Supabase; only the per-device working draft and
      // the active selection are persisted locally.
      partialize: (s) => ({
        activeProjectId: s.activeProjectId,
        activeScenarioId: s.activeScenarioId,
        assumptions: s.assumptions,
        dirty: s.dirty,
      }),
      migrate: (persisted, version) => {
        if (version < 3) {
          // Capture v1/v2 local projects for a one-time upload to Supabase.
          const old = persisted as
            | { assumptions?: AnyAssumptions; projects?: (Partial<Project> & { name: string })[] }
            | undefined;
          if (old?.projects && old.projects.length > 0) {
            legacyProjects = old.projects.map((p) => ({
              id: p.id ?? '',
              name: p.name,
              city: p.city ?? '',
              state: p.state ?? '',
              constructionType: p.constructionType ?? '',
              createdAt: p.createdAt ?? '',
              updatedAt: p.updatedAt ?? '',
              baseCase: p.baseCase ?? DEFAULT_ASSUMPTIONS,
              scenarios: p.scenarios ?? [],
            }));
          } else if (old?.assumptions) {
            legacyProjects = [
              {
                id: '',
                name: 'Montierra Ph. II',
                city: 'Leander',
                state: 'TX',
                constructionType: 'Surface MF',
                createdAt: '',
                updatedAt: '',
                baseCase: old.assumptions,
                scenarios: [],
              },
            ];
          }
          return {
            activeProjectId: null,
            activeScenarioId: null,
            assumptions: old?.assumptions ?? DEFAULT_ASSUMPTIONS,
            dirty: false,
          };
        }
        return persisted;
      },
    },
  ),
);

export function useActiveProject(): Project | undefined {
  return useModelStore((s) => s.projects.find((p) => p.id === s.activeProjectId) ?? s.projects[0]);
}

/** Which model the working draft is: the multifamily rental engine or the for-sale townhome engine. */
export function useModelKind(): ModelKind {
  return useModelStore((s) => kindOf(s.assumptions));
}

/** Recomputes the full RENTAL model whenever the working draft changes (runs in ~5ms). Rental pages only. */
export function useModel() {
  const assumptions = useModelStore((s) => s.assumptions);
  return useMemo(() => {
    if (isForSale(assumptions)) throw new Error('useModel() called while a for-sale case is open — branch on useModelKind() first');
    return runModel(assumptions);
  }, [assumptions]);
}

/** The FOR-SALE draft and its model. For-sale pages only. */
export function useForSale() {
  const assumptions = useModelStore((s) => s.assumptions);
  const update = useModelStore((s) => s.updateForSale);
  const model = useMemo(() => {
    if (!isForSale(assumptions)) throw new Error('useForSale() called while a rental case is open — branch on useModelKind() first');
    return runForSaleModel(assumptions);
  }, [assumptions]);
  return { a: assumptions as ForSaleAssumptions, m: model, update };
}

/** Either model for the working draft, for kind-agnostic chrome such as the KPI strip. */
export function useAnyModel() {
  const assumptions = useModelStore((s) => s.assumptions);
  return useMemo(() => runAny(assumptions), [assumptions]);
}

/** Safe wrapper for comparison views — a degenerate scenario returns null instead of throwing. */
export const tryRunModel = tryRunAny;

/** The RENTAL draft for the rental input pages (they only render while a rental case is open). */
export function useRentalAssumptions(): Assumptions {
  return useModelStore((s) => s.assumptions as Assumptions);
}
