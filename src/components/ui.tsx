'use client';

import { type ReactNode } from 'react';
import { fmtMoney, moneyClass } from '@/lib/format';

export function Card({ title, subtitle, children, className = '' }: { title?: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {title && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${accent ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Th({ children, right = true, className = '' }: { children?: ReactNode; right?: boolean; className?: string }) {
  return (
    <th className={`whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${right ? 'text-right' : 'text-left'} ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, right = true, className = '' }: { children?: ReactNode; right?: boolean; className?: string }) {
  return (
    <td className={`whitespace-nowrap px-3 py-1.5 text-sm tabular-nums ${right ? 'text-right' : 'text-left'} ${className}`}>
      {children}
    </td>
  );
}

export function Money({ v, digits = 0, colored = false }: { v: number; digits?: number; colored?: boolean }) {
  return <span className={colored ? moneyClass(v) : undefined}>{fmtMoney(v, digits)}</span>;
}

/* ------------------------------ form fields ------------------------------ */

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-right text-sm tabular-nums text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400';

export function NumberInput({
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      className={inputCls}
      value={Number.isFinite(value) ? value : 0}
      step={step}
      min={min}
      max={max}
      onChange={(e) => {
        const v = e.target.valueAsNumber;
        if (Number.isFinite(v)) onChange(v);
        else if (e.target.value === '') onChange(0);
      }}
    />
  );
}

/** Percent input displayed in % units, stored as a decimal. */
export function PctInput({ value, onChange, step = 0.05 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="relative">
      <input
        type="number"
        className={`${inputCls} pr-7`}
        value={Number.isFinite(value) ? Number((value * 100).toFixed(6)) : 0}
        step={step}
        onChange={(e) => {
          const v = e.target.valueAsNumber;
          if (Number.isFinite(v)) onChange(v / 100);
          else if (e.target.value === '') onChange(0);
        }}
      />
      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-slate-400">%</span>
    </div>
  );
}

export function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: readonly T[] | T[] }) {
  return (
    <select
      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        checked ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-600'
      }`}
    >
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${checked ? 'bg-emerald-600' : 'bg-slate-300'}`} />
      {label}
    </button>
  );
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
        tone === 'warn' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-sky-200 bg-sky-50 text-sky-900'
      }`}
    >
      {children}
    </div>
  );
}
