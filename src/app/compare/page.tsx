'use client';

import { useMemo } from 'react';
import { Card, Th, Td, Note } from '@/components/ui';
import { tryRunModel, useActiveProject, useModelStore } from '@/store/useModelStore';
import { fmtMoney, fmtPct, fmtX } from '@/lib/format';
import type { ModelOutput } from '@/lib/model/types';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

interface Metric {
  label: string;
  value: (m: ModelOutput) => number;
  fmt: (v: number) => string;
  deltaPp?: boolean; // show delta in percentage points
}

const METRICS: Metric[] = [
  { label: 'Total Project Cost', value: (m) => m.budget.totalGross, fmt: (v) => fmtMoney(v) },
  { label: 'Construction Loan', value: (m) => m.financing.loanAmount, fmt: (v) => fmtMoney(v) },
  { label: 'Total Equity', value: (m) => m.financing.equityCommitment, fmt: (v) => fmtMoney(v) },
  { label: 'MF Sale Price', value: (m) => m.sale.mfSalePrice, fmt: (v) => fmtMoney(v) },
  { label: 'Net Sale Proceeds', value: (m) => m.sale.netSaleProceeds, fmt: (v) => fmtMoney(v) },
  { label: 'Total Profit', value: (m) => m.returns.totalDistributions - m.returns.totalEquityInvested, fmt: (v) => fmtMoney(v) },
  { label: 'Project XIRR', value: (m) => m.returns.projectXirr ?? 0, fmt: (v) => fmtPct(v), deltaPp: true },
  { label: 'Project MOIC', value: (m) => m.returns.projectMoic, fmt: (v) => fmtX(v) },
  { label: 'LP IRR', value: (m) => m.waterfall.lpIrr ?? 0, fmt: (v) => fmtPct(v), deltaPp: true },
  { label: 'LP MOIC', value: (m) => m.waterfall.lpMoic, fmt: (v) => fmtX(v) },
  { label: 'GP IRR', value: (m) => m.waterfall.gpIrr ?? 0, fmt: (v) => fmtPct(v), deltaPp: true },
  { label: 'GP MOIC', value: (m) => m.waterfall.gpMoic, fmt: (v) => fmtX(v) },
  { label: 'Untrended ROC', value: (m) => m.operatingYield.untrended.returnOnCostGross, fmt: (v) => fmtPct(v), deltaPp: true },
  { label: 'Untrended Debt Yield', value: (m) => m.operatingYield.untrended.debtYield, fmt: (v) => fmtPct(v), deltaPp: true },
  { label: 'Untrended DSCR', value: (m) => m.operatingYield.untrended.dscr, fmt: (v) => fmtX(v) },
  { label: 'Stabilization Month', value: (m) => m.leaseUpEndMonth, fmt: (v) => `M${v}` },
];

export default function ComparePage() {
  const project = useActiveProject();
  const activeScenarioId = useModelStore((s) => s.activeScenarioId);
  const dirty = useModelStore((s) => s.dirty);
  const { deleteScenario, renameScenario, switchScenario } = useModelStore.getState();

  const columns = useMemo(
    () => [
      { id: null as string | null, name: 'Base case', model: tryRunModel(project.baseCase) },
      ...project.scenarios.map((sc) => ({
        id: sc.id as string | null,
        name: sc.name,
        model: tryRunModel(sc.assumptions),
      })),
    ],
    [project],
  );

  const base = columns[0].model;

  const chartData = columns
    .filter((c) => c.model)
    .map((c) => ({
      name: c.name,
      xirr: Math.round((c.model!.returns.projectXirr ?? 0) * 10000) / 100,
      lpIrr: Math.round((c.model!.waterfall.lpIrr ?? 0) * 10000) / 100,
      gpIrr: Math.round((c.model!.waterfall.gpIrr ?? 0) * 10000) / 100,
    }));

  if (project.scenarios.length === 0) {
    return (
      <div className="space-y-5">
        <Card title="Scenario Comparison" subtitle={`Project: ${project.name}`}>
          <Note>
            No saved scenarios yet. Change any assumptions, then use{' '}
            <span className="font-semibold">Save as scenario…</span> in the bar above — saved
            scenarios appear here side-by-side against the base case. Use the{' '}
            <span className="font-semibold">Projects</span> tab to compare across projects.
          </Note>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card
        title="Scenario Comparison"
        subtitle={`Project: ${project.name} · base case + ${project.scenarios.length} scenario${project.scenarios.length === 1 ? '' : 's'}${dirty ? ' · note: your unsaved edits are NOT reflected here — save first' : ''}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <Th right={false}>Metric</Th>
                {columns.map((c) => (
                  <Th key={c.id ?? '__base__'} className={c.id === activeScenarioId ? 'text-slate-900' : ''}>
                    {c.name}
                    {c.id === activeScenarioId && <span className="ml-1 text-emerald-600">●</span>}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((metric) => (
                <tr key={metric.label} className="border-t border-slate-100">
                  <Td right={false} className="text-slate-700">{metric.label}</Td>
                  {columns.map((c, ci) => {
                    if (!c.model) return <Td key={c.id ?? '__base__'}>—</Td>;
                    const v = metric.value(c.model);
                    let delta = '';
                    if (ci > 0 && base) {
                      const b = metric.value(base);
                      const d = v - b;
                      if (Math.abs(d) > 1e-9) {
                        delta = metric.deltaPp
                          ? ` (${d > 0 ? '+' : ''}${(d * 100).toFixed(1)}pp)`
                          : b !== 0
                            ? ` (${d > 0 ? '+' : ''}${((d / Math.abs(b)) * 100).toFixed(1)}%)`
                            : '';
                      }
                    }
                    return (
                      <Td key={c.id ?? '__base__'}>
                        {metric.fmt(v)}
                        {delta && (
                          <span className={`ml-1 text-[11px] ${delta.includes('+') ? 'text-emerald-600' : 'text-red-500'}`}>
                            {delta}
                          </span>
                        )}
                      </Td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t border-slate-200">
                <Td right={false} className="text-slate-400">Actions</Td>
                {columns.map((c) => (
                  <Td key={c.id ?? '__base__'}>
                    <div className="flex justify-end gap-1">
                      <button
                        className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
                        onClick={() => switchScenario(c.id)}
                      >
                        Open
                      </button>
                      {c.id !== null && (
                        <>
                          <button
                            className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
                            onClick={() => {
                              const name = prompt('Rename scenario:', c.name);
                              if (name?.trim()) renameScenario(c.id!, name.trim());
                            }}
                          >
                            Rename
                          </button>
                          <button
                            className="rounded border border-red-200 px-1.5 py-0.5 text-[11px] text-red-600 hover:bg-red-50"
                            onClick={() => {
                              if (confirm(`Delete scenario "${c.name}"?`)) deleteScenario(c.id!);
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </Td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Returns by Scenario">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ left: 0, right: 10, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" width={44} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="xirr" fill="#0f2a43" name="Project XIRR" radius={[3, 3, 0, 0]} />
              <Bar dataKey="lpIrr" fill="#3f6b94" name="LP IRR" radius={[3, 3, 0, 0]} />
              <Bar dataKey="gpIrr" fill="#9dbcd6" name="GP IRR" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
