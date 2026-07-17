'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useActiveProject, useModel, useModelStore } from '@/store/useModelStore';
import { fmtMoney, fmtPct, fmtX } from '@/lib/format';

const NAV: { href: string; label: string }[] = [
  { href: '/', label: 'Summary' },
  { href: '/assumptions/unit-mix', label: 'Unit Mix' },
  { href: '/assumptions/leasing', label: 'Leasing' },
  { href: '/assumptions/costs', label: 'Costs' },
  { href: '/assumptions/financing', label: 'Financing' },
  { href: '/assumptions/construction-curve', label: 'Curve' },
  { href: '/assumptions/waterfall', label: 'Waterfall' },
  { href: '/cash-flow', label: 'Cash Flow' },
  { href: '/returns', label: 'Returns' },
  { href: '/taxes', label: 'Taxes' },
  { href: '/comps', label: 'Comps' },
  { href: '/export', label: 'Export' },
  { href: '/compare', label: 'Compare' },
  { href: '/projects', label: 'Projects' },
];

/** Renders children only after the persisted store hydrates (avoids SSR mismatch). */
function Hydrated({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) {
    return <div className="p-10 text-sm text-slate-400">Loading model…</div>;
  }
  return <>{children}</>;
}

function KpiStrip() {
  const model = useModel();
  const kpis: [string, string][] = [
    ['Total Cost', fmtMoney(model.budget.totalGross)],
    ['XIRR', fmtPct(model.returns.projectXirr)],
    ['MOIC', fmtX(model.returns.projectMoic)],
    ['ROC', fmtPct(model.operatingYield.untrended.returnOnCostGross)],
    ['Debt Yield', fmtPct(model.operatingYield.untrended.debtYield)],
    ['DSCR', fmtX(model.operatingYield.untrended.dscr)],
    ['LP IRR', fmtPct(model.waterfall.lpIrr)],
    ['GP IRR', fmtPct(model.waterfall.gpIrr)],
  ];
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1">
      {kpis.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
          <span className="text-sm font-bold tabular-nums text-slate-900">{value}</span>
        </div>
      ))}
    </div>
  );
}

const barBtn =
  'rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent';

function ProjectBar() {
  const project = useActiveProject();
  const projects = useModelStore((s) => s.projects);
  const activeScenarioId = useModelStore((s) => s.activeScenarioId);
  const dirty = useModelStore((s) => s.dirty);
  const {
    save, saveAsScenario, setAsBaseCase, discard, switchScenario, switchProject,
  } = useModelStore.getState();

  const guardDirty = (): boolean =>
    !dirty || confirm('You have unsaved changes that will be discarded. Continue?');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Project</span>
        <select
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800"
          value={project.id}
          onChange={(e) => {
            if (guardDirty()) switchProject(e.target.value);
          }}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Scenario</span>
        <select
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800"
          value={activeScenarioId ?? '__base__'}
          onChange={(e) => {
            if (guardDirty()) switchScenario(e.target.value === '__base__' ? null : e.target.value);
          }}
        >
          <option value="__base__">Base case</option>
          {project.scenarios.map((sc) => (
            <option key={sc.id} value={sc.id}>{sc.name}</option>
          ))}
        </select>
      </label>

      <span
        className={`text-[11px] font-medium ${dirty ? 'text-amber-600' : 'text-slate-400'}`}
        title={dirty ? 'Unsaved changes' : 'All changes saved'}
      >
        {dirty ? '● unsaved changes' : '✓ saved'}
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <button className={barBtn} disabled={!dirty} onClick={() => save()}>
          Save {activeScenarioId === null ? 'base case' : 'scenario'}
        </button>
        <button
          className={barBtn}
          onClick={() => {
            const name = prompt('Scenario name:', 'New scenario');
            if (name?.trim()) saveAsScenario(name.trim());
          }}
        >
          Save as scenario…
        </button>
        {activeScenarioId !== null && (
          <button
            className={barBtn}
            onClick={() => {
              if (confirm(`Overwrite the "${project.name}" base case with the current numbers?`)) {
                setAsBaseCase();
              }
            }}
          >
            Set as base case
          </button>
        )}
        <button className={barBtn} disabled={!dirty} onClick={() => discard()}>
          Discard
        </button>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login') {
    return <div className="min-h-screen bg-slate-100">{children}</div>;
  }
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                <ProjectTitle />
              </h1>
            </div>
            <Hydrated>
              <div className="grow md:max-w-4xl">
                <KpiStrip />
              </div>
            </Hydrated>
          </div>
          <Hydrated>
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
              <ProjectBar />
            </div>
          </Hydrated>
          <nav className="mt-1.5 flex gap-0.5 overflow-x-auto">
            {NAV.map((item) => {
              const active =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'border-slate-900 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Hydrated>{children}</Hydrated>
      </main>
    </div>
  );
}

function ProjectTitle() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const project = useActiveProject();
  const a = useModelStore((s) => s.assumptions);
  if (!ready) return <>Development Model</>;
  return (
    <>
      {project.name}
      <span className="ml-2 text-xs font-normal text-slate-400">
        {[a.project.location, a.project.productType].filter(Boolean).join(' · ') || 'Development model'}
      </span>
    </>
  );
}
