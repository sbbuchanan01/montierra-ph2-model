'use client';

import { Card, StatCard, Th, Td, Money, Field, PctInput, NumberInput } from '@/components/ui';
import { useModel, useModelStore } from '@/store/useModelStore';
import { fmtMoney, fmtPct, fmtX } from '@/lib/format';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import type { OperatingYieldCol } from '@/lib/model/types';

function YieldColumn({ col }: { col: OperatingYieldCol }) {
  const rows: [string, number, boolean?][] = [
    ['Potential Gross Rent', col.potentialGrossRent],
    ['less Lease-Up Vacancy', col.leaseUpVacancy],
    ['less Concessions / LTL / Admin', col.concessions + col.lossToLease + col.adminUnits],
    ['Net Effective Rents', col.netEffectiveRents, true],
    ['Vacancy Loss', col.vacancyLoss],
    ['Collection Loss', col.collectionLoss],
    ['Net Rental Income', col.netRentalIncome, true],
    ...Object.entries(col.otherIncome).map(([k, v]) => [k, v] as [string, number]),
    ['Total Income', col.totalIncome, true],
    ...Object.entries(col.controllable).map(([k, v]) => [`— ${k}`, -v] as [string, number]),
    ['Property Taxes', -col.propertyTaxes],
    ['Management Fees', -col.managementFees],
    ['Insurance', -col.insurance],
    ['Total Expenses', -col.totalExpenses, true],
    ['NOI', col.combinedNoi, true],
    ['less Capital Reserves', -col.capitalReserves],
    ['Net Cash Flow', col.netCashFlow, true],
  ];
  return (
    <table className="w-full">
      <thead>
        <tr>
          <Th right={false}>{col.label}</Th>
          <Th>Amount</Th>
          <Th>$/Unit/Mo</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, v, bold]) => (
          <tr key={label} className={`border-t border-slate-100 ${bold ? 'bg-slate-50 font-semibold' : ''}`}>
            <Td right={false} className="text-slate-700">{label}</Td>
            <Td><Money v={v} colored /></Td>
            <Td className="text-slate-400">{fmtMoney(v / 20 / 12)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ReturnsPage() {
  const m = useModel();
  const a = useModelStore((s) => s.assumptions);
  const update = useModelStore((s) => s.update);
  const wf = m.waterfall;

  const dist = m.annual
    .filter((y) => y.startMonth <= m.sale.month)
    .map((y) => {
      const rows = wf.months.filter((r) => Math.ceil(r.month / 12) === y.year);
      return {
        label: `Y${y.year}`,
        lp: Math.round(rows.reduce((s, r) => s + r.lpTotal, 0)),
        gp: Math.round(rows.reduce((s, r) => s + r.gpTotal, 0)),
      };
    });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <StatCard label="LP IRR" value={fmtPct(wf.lpIrr)} sub={`MOIC ${fmtX(wf.lpMoic)}`} accent />
        <StatCard label="GP IRR" value={fmtPct(wf.gpIrr)} sub={`MOIC ${fmtX(wf.gpMoic)}`} accent />
        <StatCard label="Project XIRR" value={fmtPct(m.returns.projectXirr)} sub={`MOIC ${fmtX(m.returns.projectMoic)}`} />
        <StatCard label="Untrended ROC" value={fmtPct(m.operatingYield.untrended.returnOnCostGross)} sub={`Net ${fmtPct(m.operatingYield.untrended.returnOnCostNet)}`} />
        <StatCard label="Stabilized ROC (Yr 3)" value={fmtPct(m.operatingYield.stabilized.returnOnCostGross)} sub={`DY ${fmtPct(m.operatingYield.stabilized.debtYield)}`} />
        <StatCard label="Untrended DSCR" value={fmtX(m.operatingYield.untrended.dscr)} sub={`@ ${fmtPct(a.taxes.dscrTestRate, 1)} constant`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Annual Distributions (post-promote)">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={dist} margin={{ left: 10, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} width={52} />
                <Tooltip formatter={(v) => fmtMoney(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="lp" stackId="a" fill="#0f2a43" name="LP" />
                <Bar dataKey="gp" stackId="a" fill="#6b93b8" name="GP" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="MF exit cap rate">
              <PctInput value={a.exit.mfCapRate} onChange={(v) => update((d) => ({ ...d, exit: { ...d.exit, mfCapRate: v } }))} step={0.25} />
            </Field>
            <Field label="Closing costs %">
              <PctInput value={a.exit.closingCostPct} onChange={(v) => update((d) => ({ ...d, exit: { ...d.exit, closingCostPct: v } }))} step={0.5} />
            </Field>
            <Field label="Hold period (months)">
              <NumberInput
                value={a.schedule.saleMonth}
                onChange={(v) => update((d) => ({ ...d, schedule: { ...d.schedule, saleMonth: Math.max(2, Math.round(v)) } }))}
                min={2}
              />
            </Field>
            <Field label="Retail exit cap rate">
              <PctInput value={a.exit.retailCapRate} onChange={(v) => update((d) => ({ ...d, exit: { ...d.exit, retailCapRate: v } }))} step={0.25} />
            </Field>
          </div>
        </Card>

        <Card title="Operating Yield — Untrended (Yr 1)">
          <YieldColumn col={m.operatingYield.untrended} />
        </Card>
        <Card title={`Operating Yield — Stabilized (Yr ${m.operatingYield.stabilizedYearLabel})`}>
          <YieldColumn col={m.operatingYield.stabilized} />
        </Card>
      </div>
    </div>
  );
}
