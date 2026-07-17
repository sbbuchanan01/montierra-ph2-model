'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMemo } from 'react';
import type { Assumptions } from '@/lib/model/types';
import { DEFAULT_ASSUMPTIONS, makeBlankAssumptions } from '@/lib/model/defaults';
import { runModel } from '@/lib/model/engine';
import { createClient } from '@/lib/supabase/client';

export interface Scenario {
  id: string;
  name: string;
  savedAt: string;
  assumptions: Assumptions;
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
  baseCase: Assumptions;
  scenarios: Scenario[];
}

export type ProjectTemplate = 'blank' | 'copy';

const clone = <T,>(v: T): T => structuredClone(v);

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
  /** Working draft — what every input page edits and every output reflects. */
  assumptions: Assumptions;
  dirty: boolean;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  update: (fn: (draft: Assumptions) => Assumptions) => void;
  save: () => Promise<void>;
  saveAsScenario: (name: string) => Promise<void>;
  setAsBaseCase: () => Promise<void>;
  discard: () => void;
  switchScenario: (scenarioId: string | null) => void;
  switchProject: (projectId: string) => void;
  createProject: (meta: ProjectMeta, template: ProjectTemplate) => Promise<void>;
  updateProjectMeta: (projectId: string, patch: Partial<ProjectMeta>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  renameScenario: (scenarioId: string, name: string) => Promise<void>;
  deleteScenario: (scenarioId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const activeProjectOf = (s: Pick<ModelStore, 'projects' | 'activeProjectId'>): Project | undefined =>
  s.projects.find((p) => p.id === s.activeProjectId) ?? s.projects[0];

const savedSnapshot = (project: Project | undefined, scenarioId: string | null): Assumptions => {
  if (!project) return DEFAULT_ASSUMPTIONS;
  if (scenarioId === null) return project.baseCase;
  return project.scenarios.find((sc) => sc.id === scenarioId)?.assumptions ?? project.baseCase;
};

async function fetchProjects(): Promise<Project[]> {
  const supabase = createClient();
  const [projectsRes, scenariosRes] = await Promise.all([
    supabase
      .from('montierra_projects')
      .select('id,name,city,state,construction_type,created_at,base_case')
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
    baseCase: p.base_case as Assumptions,
    scenarios: (scenariosRes.data ?? [])
      .filter((sc) => sc.project_id === p.id)
      .map((sc) => ({
        id: sc.id as string,
        name: sc.name as string,
        savedAt: sc.saved_at as string,
        assumptions: sc.assumptions as Assumptions,
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

        update: (fn) => set((s) => ({ assumptions: fn(clone(s.assumptions)), dirty: true })),

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
                if (s.activeScenarioId === null) return { ...p, baseCase: draft };
                return {
                  ...p,
                  scenarios: p.scenarios.map((sc) =>
                    sc.id === s.activeScenarioId ? { ...sc, assumptions: draft } : sc,
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
                p.id === s.activeProjectId ? { ...p, baseCase: draft } : p,
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

        createProject: async (meta, template) => {
          const s = get();
          const baseCase =
            template === 'blank'
              ? makeBlankAssumptions(meta.name)
              : { ...clone(s.assumptions), project: { ...clone(s.assumptions.project), name: meta.name } };
          baseCase.project.location = [meta.city, meta.state].filter(Boolean).join(', ');
          baseCase.project.productType = meta.constructionType;
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
            const project: Project = {
              id: row.id as string,
              ...meta,
              createdAt: row.created_at as string,
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
            | { assumptions?: Assumptions; projects?: (Partial<Project> & { name: string })[] }
            | undefined;
          if (old?.projects && old.projects.length > 0) {
            legacyProjects = old.projects.map((p) => ({
              id: p.id ?? '',
              name: p.name,
              city: p.city ?? '',
              state: p.state ?? '',
              constructionType: p.constructionType ?? '',
              createdAt: p.createdAt ?? '',
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

/** Recomputes the full model whenever the working draft changes (runs in ~5ms). */
export function useModel() {
  const assumptions = useModelStore((s) => s.assumptions);
  return useMemo(() => runModel(assumptions), [assumptions]);
}

/** Safe wrapper for comparison views — a degenerate scenario returns null instead of throwing. */
export function tryRunModel(assumptions: Assumptions) {
  try {
    return runModel(assumptions);
  } catch {
    return null;
  }
}
