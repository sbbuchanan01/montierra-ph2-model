'use client';

import { type ReactNode } from 'react';
import type { ModelCheck } from '@/lib/forsale/types';
import { fmtDate } from '@/lib/format';

/** Compact cells for dense for-sale tables (mirror the summary page's CTh/CTd). */
export function CTh({ children, left = false, className = '' }: { children?: ReactNode; left?: boolean; className?: string }) {
  return (
    <th className={`whitespace-nowrap px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 first:pl-0 last:pr-0 ${left ? 'text-left' : 'text-right'} ${className}`}>
      {children}
    </th>
  );
}

export function CTd({ children, left = false, className = '', colSpan }: { children?: ReactNode; left?: boolean; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={`whitespace-nowrap px-1.5 py-1 text-xs tabular-nums first:pl-0 last:pr-0 ${left ? 'text-left' : 'text-right'} ${className}`}>
      {children}
    </td>
  );
}

/** "M16 · Apr 2027" */
export const fmtMonth = (month: number, date?: string) => (date ? `M${month} · ${fmtDate(date)}` : `M${month}`);

export function Checks({ checks }: { checks: ModelCheck[] }) {
  const tone = { ok: 'text-emerald-700', note: 'text-amber-700', check: 'text-red-600' } as const;
  const word = { ok: 'OK', note: 'NOTE', check: 'CHECK' } as const;
  return (
    <table className="w-full">
      <tbody>
        {checks.map((c) => (
          <tr key={c.label} className="border-t border-slate-100">
            <td className="py-1 pr-3 text-xs text-slate-700">{c.label}</td>
            <td className={`whitespace-nowrap py-1 text-right text-xs font-semibold ${tone[c.status]}`}>
              {word[c.status]}
              {c.detail && <span className="ml-1 font-normal text-slate-500">— {c.detail}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const SECTION_LABEL = {
  land: 'Land & Acquisition',
  hard: 'Hard Costs',
  soft: 'Soft Costs',
  financing: 'Financing Costs',
  reserves: 'Reserves & Carry',
} as const;
