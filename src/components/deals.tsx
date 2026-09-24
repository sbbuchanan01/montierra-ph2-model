'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode } from 'react';
import { useModelStore } from '@/store/useModelStore';
import { fmtMoney, fmtPct, fmtX } from '@/lib/format';
import { headline, isForSaleOutput, type AnyOutput } from '@/lib/any';

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

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'navy' | 'green' | 'amber' | 'sky' }) {
  const cls = {
    slate: 'bg-slate-100 text-slate-600',
    navy: 'bg-slate-900 text-white',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-800',
    sky: 'bg-sky-100 text-sky-800',
  }[tone];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

/**
 * A comparison metric that works across rental and for-sale cases. `value` returns null when the
 * metric does not apply to that kind (shown as "—", no delta).
 */
export interface Metric {
  label: string;
  value: (m: AnyOutput) => number | null;
  fmt: (v: number) => string;
  /** show the delta in percentage points instead of % change */
  deltaPp?: boolean;
  /** a lower value is the better outcome (colors the delta) */
  lowerIsBetter?: boolean;
}

const rental = <T,>(f: (m: Extract<AnyOutput, { totalUnits: number }>) => T) => (m: AnyOutput) => (isForSaleOutput(m) ? null : f(m));
const forSale = <T,>(f: (m: Extract<AnyOutput, { kind: 'forSale' }>) => T) => (m: AnyOutput) => (isForSaleOutput(m) ? f(m) : null);

export const METRICS: Metric[] = [
  { label: 'Units', value: (m) => headline(m).units, fmt: (v) => v.toLocaleString() },
  { label: 'Total Project Cost', value: (m) => headline(m).totalCost, fmt: (v) => fmtMoney(v), lowerIsBetter: true },
  { label: 'Cost / Unit', value: (m) => { const h = headline(m); return h.units > 0 ? h.totalCost / h.units : 0; }, fmt: (v) => fmtMoney(v), lowerIsBetter: true },
  { label: 'Construction Loan', value: (m) => headline(m).loan, fmt: (v) => fmtMoney(v) },
  { label: 'Total Equity', value: (m) => headline(m).equity, fmt: (v) => fmtMoney(v), lowerIsBetter: true },
  { label: 'Sale Price / Gross Sellout', value: (m) => headline(m).grossExit, fmt: (v) => fmtMoney(v) },
  { label: 'Net Sale / Sales Proceeds', value: (m) => headline(m).netExit, fmt: (v) => fmtMoney(v) },
  { label: 'Total Profit', value: (m) => headline(m).profit, fmt: (v) => fmtMoney(v) },
  { label: 'Project XIRR', value: (m) => headline(m).projectIrr ?? 0, fmt: (v) => fmtPct(v), deltaPp: true },
  { label: 'Project MOIC', value: (m) => headline(m).projectMoic, fmt: (v) => fmtX(v) },
  { label: 'LP IRR', value: (m) => headline(m).lpIrr ?? 0, fmt: (v) => fmtPct(v), deltaPp: true },
  { label: 'LP MOIC', value: (m) => headline(m).lpMoic, fmt: (v) => fmtX(v) },
  { label: 'GP IRR', value: (m) => headline(m).gpIrr ?? 0, fmt: (v) => fmtPct(v), deltaPp: true },
  { label: 'GP MOIC', value: (m) => headline(m).gpMoic, fmt: (v) => fmtX(v) },
  { label: 'Untrended ROC', value: rental((m) => m.operatingYield.untrended.returnOnCostGross), fmt: (v) => fmtPct(v), deltaPp: true },
  { label: 'Untrended Debt Yield', value: rental((m) => m.operatingYield.untrended.debtYield), fmt: (v) => fmtPct(v), deltaPp: true },
  { label: 'Untrended DSCR', value: rental((m) => m.operatingYield.untrended.dscr), fmt: (v) => fmtX(v) },
  { label: 'Margin on Gross Sales', value: forSale((m) => m.margin.trended.marginOnGross), fmt: (v) => fmtPct(v), deltaPp: true },
  { label: 'Return on Cost (for-sale)', value: forSale((m) => m.margin.trended.returnOnCost), fmt: (v) => fmtPct(v), deltaPp: true },
  { label: 'Stabilization / Sellout Month', value: (m) => headline(m).endMonth, fmt: (v) => `M${v}`, lowerIsBetter: true },
];

export const metric = (label: string): Metric => METRICS.find((x) => x.label === label)!;

/** Small colored "(+1.2pp)" / "(-3.4%)" suffix vs. a base value; empty when unchanged or not comparable. */
export function Delta({ m, v, base }: { m: Metric; v: number | null; base: number | null }) {
  if (base == null || v == null) return null;
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
