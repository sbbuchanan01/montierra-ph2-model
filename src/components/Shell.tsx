'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useModel, useModelStore } from '@/store/useModelStore';
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
  const reset = useModelStore((s) => s.reset);
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
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
      {kpis.map(([label, value]) => (
        <div key={label} className="flex items-baseline gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
          <span className="text-sm font-bold tabular-nums text-slate-900">{value}</span>
        </div>
      ))}
      <button
        onClick={() => {
          if (confirm('Reset all assumptions to the workbook base case?')) reset();
        }}
        className="ml-auto rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
      >
        Reset to base case
      </button>
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
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Montierra Ph. II</h1>
              <p className="text-xs text-slate-500">Leander, TX · 20-unit surface multifamily · Development model</p>
            </div>
            <Hydrated>
              <div className="grow md:max-w-4xl">
                <KpiStrip />
              </div>
            </Hydrated>
          </div>
          <nav className="mt-3 flex gap-0.5 overflow-x-auto">
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
