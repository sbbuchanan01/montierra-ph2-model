'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMemo } from 'react';
import type { Assumptions } from '@/lib/model/types';
import { DEFAULT_ASSUMPTIONS } from '@/lib/model/defaults';
import { runModel } from '@/lib/model/engine';

interface ModelStore {
  assumptions: Assumptions;
  /** Deep-merge-free setter: pass an updater that returns a new Assumptions. */
  update: (fn: (draft: Assumptions) => Assumptions) => void;
  reset: () => void;
}

export const useModelStore = create<ModelStore>()(
  persist(
    (set) => ({
      assumptions: DEFAULT_ASSUMPTIONS,
      update: (fn) => set((s) => ({ assumptions: fn(structuredClone(s.assumptions)) })),
      reset: () => set({ assumptions: structuredClone(DEFAULT_ASSUMPTIONS) }),
    }),
    { name: 'montierra-ph2-assumptions', version: 1 },
  ),
);

/** Recomputes the full model whenever assumptions change (runs in ~5ms). */
export function useModel() {
  const assumptions = useModelStore((s) => s.assumptions);
  return useMemo(() => runModel(assumptions), [assumptions]);
}
