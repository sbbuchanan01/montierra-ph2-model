'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMemo } from 'react';
import type { Assumptions } from '@/lib/model/types';
import { DEFAULT_ASSUMPTIONS, makeBlankAssumptions } from '@/lib/model/defaults';
import { runModel } from '@/lib/model/engine';

export interface Scenario {
  id: string;
  name: string;
  savedAt: string;
  assumptions: Assumptions;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  baseCase: Assumptions;
  scenarios: Scenario[];
}

export type ProjectTemplate = 'blank' | 'copy' | 'montierra';

const clone = <T,>(v: T): T => structuredClone(v);
const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
const now = () => new Date().toISOString();

const initialProject: Project = {
  id: 'montierra',
  name: 'Montierra Ph. II',
  createdAt: '2026-07-17T00:00:00.000Z',
  baseCase: DEFAULT_ASSUMPTIONS,
  scenarios: [],
};

interface ModelStore {
  projects: Project[];
  activeProjectId: string;
  /** null = the project's base case */
  activeScenarioId: string | null;
  /** Working draft — what every input page edits and every output reflects. */
  assumptions: Assumptions;
  dirty: boolean;

  update: (fn: (draft: Assumptions) => Assumptions) => void;
  /** Save the draft into whatever is active (base case or scenario). */
  save: () => void;
  /** Save the draft as a brand-new named scenario and make it active. */
  saveAsScenario: (name: string) => void;
  /** Promote the draft to the project's base case (overrides the old one). */
  setAsBaseCase: () => void;
  /** Throw away unsaved edits, reverting to the active saved snapshot. */
  discard: () => void;

  switchScenario: (scenarioId: string | null) => void;
  switchProject: (projectId: string) => void;
  createProject: (name: string, template: ProjectTemplate) => void;
  renameProject: (projectId: string, name: string) => void;
  deleteProject: (projectId: string) => void;
  renameScenario: (scenarioId: string, name: string) => void;
  deleteScenario: (scenarioId: string) => void;
}

const activeProjectOf = (s: Pick<ModelStore, 'projects' | 'activeProjectId'>): Project =>
  s.projects.find((p) => p.id === s.activeProjectId) ?? s.projects[0];

const savedSnapshot = (project: Project, scenarioId: string | null): Assumptions =>
  scenarioId === null
    ? project.baseCase
    : project.scenarios.find((sc) => sc.id === scenarioId)?.assumptions ?? project.baseCase;

export const useModelStore = create<ModelStore>()(
  persist(
    (set, get) => ({
      projects: [initialProject],
      activeProjectId: initialProject.id,
      activeScenarioId: null,
      assumptions: DEFAULT_ASSUMPTIONS,
      dirty: false,

      update: (fn) => set((s) => ({ assumptions: fn(clone(s.assumptions)), dirty: true })),

      save: () =>
        set((s) => {
          const draft = clone(s.assumptions);
          return {
            dirty: false,
            projects: s.projects.map((p) => {
              if (p.id !== s.activeProjectId) return p;
              if (s.activeScenarioId === null) return { ...p, baseCase: draft };
              return {
                ...p,
                scenarios: p.scenarios.map((sc) =>
                  sc.id === s.activeScenarioId ? { ...sc, assumptions: draft, savedAt: now() } : sc,
                ),
              };
            }),
          };
        }),

      saveAsScenario: (name) =>
        set((s) => {
          const scenario: Scenario = { id: uid(), name, savedAt: now(), assumptions: clone(s.assumptions) };
          return {
            dirty: false,
            activeScenarioId: scenario.id,
            projects: s.projects.map((p) =>
              p.id === s.activeProjectId ? { ...p, scenarios: [...p.scenarios, scenario] } : p,
            ),
          };
        }),

      setAsBaseCase: () =>
        set((s) => ({
          dirty: false,
          activeScenarioId: null,
          projects: s.projects.map((p) =>
            p.id === s.activeProjectId ? { ...p, baseCase: clone(s.assumptions) } : p,
          ),
        })),

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

      createProject: (name, template) =>
        set((s) => {
          const baseCase =
            template === 'blank'
              ? makeBlankAssumptions(name)
              : template === 'copy'
                ? { ...clone(s.assumptions), project: { ...clone(s.assumptions.project), name } }
                : { ...clone(DEFAULT_ASSUMPTIONS), project: { ...clone(DEFAULT_ASSUMPTIONS.project), name } };
          const project: Project = { id: uid(), name, createdAt: now(), baseCase, scenarios: [] };
          return {
            projects: [...s.projects, project],
            activeProjectId: project.id,
            activeScenarioId: null,
            dirty: false,
            assumptions: clone(baseCase),
          };
        }),

      renameProject: (projectId, name) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === projectId ? { ...p, name } : p)),
        })),

      deleteProject: (projectId) =>
        set((s) => {
          if (s.projects.length <= 1) return s;
          const projects = s.projects.filter((p) => p.id !== projectId);
          if (s.activeProjectId !== projectId) return { ...s, projects };
          const next = projects[0];
          return {
            projects,
            activeProjectId: next.id,
            activeScenarioId: null,
            dirty: false,
            assumptions: clone(next.baseCase),
          };
        }),

      renameScenario: (scenarioId, name) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === s.activeProjectId
              ? { ...p, scenarios: p.scenarios.map((sc) => (sc.id === scenarioId ? { ...sc, name } : sc)) }
              : p,
          ),
        })),

      deleteScenario: (scenarioId) =>
        set((s) => {
          const projects = s.projects.map((p) =>
            p.id === s.activeProjectId
              ? { ...p, scenarios: p.scenarios.filter((sc) => sc.id !== scenarioId) }
              : p,
          );
          if (s.activeScenarioId !== scenarioId) return { ...s, projects };
          const project = projects.find((p) => p.id === s.activeProjectId)!;
          return {
            projects,
            activeScenarioId: null,
            dirty: false,
            assumptions: clone(project.baseCase),
          };
        }),
    }),
    {
      name: 'montierra-ph2-assumptions',
      version: 2,
      migrate: (persisted, version) => {
        // v1 stored a single { assumptions } working copy.
        if (version < 2) {
          const old = persisted as { assumptions?: Assumptions } | undefined;
          const baseCase = old?.assumptions ?? DEFAULT_ASSUMPTIONS;
          return {
            projects: [{ ...initialProject, baseCase }],
            activeProjectId: initialProject.id,
            activeScenarioId: null,
            assumptions: baseCase,
            dirty: false,
          };
        }
        return persisted;
      },
    },
  ),
);

export function useActiveProject(): Project {
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
