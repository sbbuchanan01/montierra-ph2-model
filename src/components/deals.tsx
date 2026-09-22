'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode } from 'react';
import { useModelStore } from '@/store/useModelStore';
import { fmtMoney, fmtPct, fmtX } from '@/lib/format';
import type { ModelOutput } from '@/lib/model/types';

export const fmtShort = (v: number): string => {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `$${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `$${(a / 1e3).toFixed(0)}K` : `$${a.toFixed(0)}`;
  return v < 0 ? `(${s})` : s;
};

export const fmtUpdated = (iso: string): string => (iso ? new Date(iso).toLocaleDateString() : '—');

export function Kpi({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="truncate font-bold tabular-nums text-slate-900">
        {value}
        {delta}
      </div>
      {sub && <div className="truncate text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'navy' | 'green' | 'amber' }) {
  const cls = {
    slate: 'bg-slate-100 text-slate-600',
    navy: 'bg-slate-900 text-white',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-800',
  }[tone];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

export interface Metric {
  label: string;
  value: (m: ModelOutput) => number;
  fmt: (v: number) => string;
  /** show the delta in percentage points instead of % change */
  deltaPp?: boolean;
  /** a lower value is the better outcome (colors the delta) */
  lowerIsBetter?: boolean;
}

const profit = (m: ModelOutput) => m.returns.totalDistributions - m.returns.totalEquityInvested;

export const METRICS: Metric[] = [
  { label: 'Units', value: (m) => m.totalUnits, fmt: (v) => v.toLocaleString() },
  { label: 'Total Project Cost', value: (m) => m.budget.totalGross, fmt: (v) => fmtMoney(v), lowerIsBetter: true },
  { label: 'Cost / Unit', value: (m) => (m.totalUnits > 0 ? m.budget.totalGross / m.totalUnits : 0), fmt: (v) => fmtMoney(v), lowerIsBetter: true },
  { label: 'Construction Loan', value: (m) => m.financing.loanAmount, fmt: (v) => fmtMoney(v) },
  { label: 'Total Equity', value: (m) => m.financing.equityCommitment, fmt: (v) => fmtMoney(v), lowerIsBetter: true },
  { label: 'MF Sale Price', value: (m) => m.sale.mfSalePrice, fmt: (v) => fmtMoney(v) },
  { label: 'Net Sale Proceeds', value: (m) => m.sale.netSaleProceeds, fmt: (v) => fmtMoney(v) },
  { label: 'Total Profit', value: profit, fmt: (v) => fmtMoney(v) },
  { label: 'Project XIRR', value: (m) => m.returns.projectXirr ?? 0, fmt: (v) => fmtPct(v), deltaPp: true },
  { label: 'Project MOIC', value: (m) => m.returns.projectMoic, fmt: (v) => fmtX(v) },
  { label: 'LP IRR', value: (m) => m.waterfall.lpIrr ?? 0, fmt: (v) => fmtPct(v), deltaPp: true },
  { label: 'LP MOIC', value: (m) => m.waterfall.lpMoic, fmt: (v) => fmtX(v) },
  { label: 'GP IRR', value: (m) => m.waterfall.gpIrr ?? 0, fmt: (v) => fmtPct(v), deltaPp: true },
  { label: 'GP MOIC', value: (m) => m.waterfall.gpMoic, fmt: (v) => fmtX(v) },
  { label: 'Untrended ROC', value: (m) => m.operatingYield.untrended.returnOnCostGross, fmt: (v) => fmtPct(v), deltaPp: true },
  { label: 'Untrended Debt Yield', value: (m) => m.operatingYield.untrended.debtYield, fmt: (v) => fmtPct(v), deltaPp: true },
  { label: 'Untrended DSCR', value: (m) => m.operatingYield.untrended.dscr, fmt: (v) => fmtX(v) },
  { label: 'Stabilization Month', value: (m) => m.leaseUpEndMonth, fmt: (v) => `M${v}`, lowerIsBetter: true },
];

export const metric = (label: string): Metric => METRICS.find((x) => x.label === label)!;

/** Small colored "(+1.2pp)" / "(-3.4%)" suffix vs. a base value; empty when unchanged. */
export function Delta({ m, v, base }: { m: Metric; v: number; base: number | null }) {
  if (base == null) return null;
  const d = v - base;
  if (!Number.isFinite(d) || Math.abs(d) < 1e-9) return null;
  const pct = m.deltaPp ? d * 100 : base !== 0 ? (d / Math.abs(base)) * 100 : null;
  // Hide changes that round away (e.g. a few dollars on a $4.7M budget).
  if (pct == null || Math.abs(pct) < 0.05) return null;
  const text = `${pct > 0 ? '+' : ''}${pct.toFixed(1)}${m.deltaPp ? 'pp' : '%'}`;
  const good = m.lowerIsBetter ? d < 0 : d > 0;
  return <span className={`ml-1 text-[11px] font-medium ${good ? 'text-emerald-600' : 'text-red-500'}`}>({text})</span>;
}

/** Confirms before an action that would throw away the unsaved working draft. */
export function useGuardDirty() {
  const dirty = useModelStore((s) => s.dirty);
  return (): boolean => !dirty || confirm('You have unsaved model changes that will be discarded. Continue?');
}

/** Open a deal's base case (null) or scenario in the model pages. */
export function useOpenScenario() {
  const router = useRouter();
  const guard = useGuardDirty();
  return (projectId: string, scenarioId: string | null, href = '/summary') => {
    const s = useModelStore.getState();
    const already = s.activeProjectId === projectId && s.activeScenarioId === scenarioId;
    if (!already) {
      if (!guard()) return;
      s.openScenario(projectId, scenarioId);
    }
    router.push(href);
  };
}

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400';

export const btn = {
  primary: 'rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40',
  secondary: 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40',
  small: 'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100',
  danger: 'rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50',
};
