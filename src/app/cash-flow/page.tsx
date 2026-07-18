'use client';

import { useState } from 'react';
import { Card, Th, Td, Money } from '@/components/ui';
import { useModel } from '@/store/useModelStore';
import { fmtDate, fmtMoney, fmtPct } from '@/lib/format';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts';
import type { MonthlyRow } from '@/lib/model/types';

type Granularity = 'monthly' | 'annual';

const ROWS: { label: string; get: (r: MonthlyRow) => number; bold?: boolean; section?: string }[] = [
  { section: 'Capital', label: 'Total Capital Expenditures', get: (r) => -r.capex },
  { label: 'Equity Draw', get: (r) => r.equityDraw },
  { label: 'Construction Loan Draw', get: (r) => r.loanDraw },
  { label: 'Refinance Draw', get: (r) => r.refiDraw },
  { section: 'Debt Service', label: 'Interest', get: (r) => -(r.loanInterest + r.refiInterest) },
  { label: 'Principal', get: (r) => -(r.loanPrincipal + r.refiPrincipal) },
  { label: 'Balloon Repayment', get: (r) => -(r.loanBalloon + r.refiBalloon) },
  { label: 'Ending Loan Balance', get: (r) => r.loanEndBalance + r.refiEndBalance },
  { section: 'Operations', label: 'Net Rental Income', get: (r) => r.netRentalIncome },
  { label: 'Total Other Income', get: (r) => r.totalOtherIncome },
  { label: 'Total Income', get: (r) => r.totalIncome, bold: true },
  { label: 'Total Expenses', get: (r) => -r.totalExpenses },
  { label: 'MF Cash Flow from Operations', get: (r) => r.mfCashFlowFromOps, bold: true },
  { label: 'Retail Cash Flow', get: (r) => r.retailCashFlow },
  { section: 'Project', label: 'Sale Proceeds (net of closing)', get: (r) => r.saleProceeds },
  { label: 'Cash Outflow to Equity', get: (r) => r.cashOutflowToEquity },
  { label: 'PROJECT CASH FLOW', get: (r) => r.projectCashFlow, bold: true },
];

export default function CashFlowPage() {
  const m = useModel();
  const [gran, setGran] = useState<Granularity>('annual');
  const [showOps, setShowOps] = useState(false);

  const periods =
    gran === 'monthly'
      ? m.monthly.filter((r) => r.month <= m.sale.month).map((r) => ({ key: `M${r.month}`, label: fmtDate(r.date), rows: [r] }))
      : m.annual
          .filter((y) => y.startMonth <= m.sale.month)
          .map((y) => ({
            key: `Y${y.year}`,
            label: `Year ${y.year}`,
            rows: m.monthly.filter((r) => r.analysisYear === y.year),
          }));

  const chart = periods.map((p) => ({
    label: p.key,
    cf: Math.round(p.rows.reduce((s, r) => s + r.projectCashFlow, 0)),
  }));

  const opsRows: { label: string; get: (r: MonthlyRow) => number }[] = [
    { label: 'Potential Gross Rent', get: (r) => r.potentialGrossRent },
    { label: 'less Lease-Up Vacancy', get: (r) => r.leaseUpVacancy },
    { label: 'Effective Gross Rent', get: (r) => r.effectiveGrossRent },
    { label: 'less Concessions / LTL / Admin', get: (r) => r.leaseUpConcessions + r.stabilizedConcessions + r.lossToLease + r.adminUnits },
    { label: 'less Stabilized Vacancy', get: (r) => r.stabilizedVacancy },
    { label: 'less Collection Loss', get: (r) => r.collectionLoss },
    { label: 'RUBS', get: (r) => r.rubs },
    { label: 'Fees / Other Income', get: (r) => r.adminFees + r.petFee + r.petRent + r.bulkWifi + r.trash + r.pest + r.storageIncome + r.parkingIncome },
    { label: 'Controllable Expenses', get: (r) => -(r.salary + r.marketingExp + r.leasingCommissionsExp + r.repairsMaintenance + r.turnoverExp + r.contractServices + r.utilities + r.generalAdmin) },
    { label: 'Property Taxes', get: (r) => -r.propertyTaxes },
    { label: 'Management Fees', get: (r) => -r.managementFees },
    { label: 'Insurance', get: (r) => -r.insurance },
  ];

  return (
    <div className="space-y-5">
      <Card
        title="Project Cash Flow"
        subtitle="Pre-promote cash flow to/from equity (the XIRR / waterfall series)"
      >
        <div className="mb-3 flex gap-2">
          {(['annual', 'monthly'] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGran(g)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                gran === g ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {g === 'annual' ? 'Annual' : 'Monthly'}
            </button>
          ))}
          <button
            onClick={() => setShowOps((v) => !v)}
            className={`ml-auto rounded-lg border px-3 py-1.5 text-sm font-medium ${
              showOps ? 'border-slate-900 text-slate-900' : 'border-slate-300 text-slate-600'
            }`}
          >
            {showOps ? 'Hide' : 'Show'} operating detail
          </button>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={chart} margin={{ left: 10, right: 10, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={gran === 'monthly' ? 5 : 0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} width={52} />
              <Tooltip formatter={(v) => fmtMoney(Number(v))} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Bar dataKey="cf" name="Project CF" radius={[3, 3, 0, 0]}>
                {chart.map((d, i) => (
                  <Cell key={i} fill={d.cf < 0 ? '#dc2626' : '#0f2a43'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title={gran === 'annual' ? 'Annual Pro Forma' : 'Monthly Pro Forma'}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th right={false} className="sticky left-0 bg-white">Line</Th>
                {periods.map((p) => (
                  <Th key={p.key}>{gran === 'annual' ? p.label : p.label}</Th>
                ))}
                <Th className="border-l border-slate-200">Total</Th>
              </tr>
            </thead>
            <tbody>
              {gran === 'annual' && (
                <tr className="border-t border-slate-100 text-xs text-slate-400">
                  <Td right={false} className="sticky left-0 bg-white">Avg Occupancy</Td>
                  {m.annual.filter((y) => y.startMonth <= m.sale.month).map((y) => (
                    <Td key={y.year}>{fmtPct(y.avgOccupancy, 0)}</Td>
                  ))}
                  <Td className="border-l border-slate-200">
                    {fmtPct(
                      periods.reduce((s, p) => s + p.rows.reduce((x, r) => x + r.occupancy, 0), 0) /
                        Math.max(1, periods.reduce((s, p) => s + p.rows.length, 0)),
                      0,
                    )}
                  </Td>
                </tr>
              )}
              {(showOps ? [...opsRows.map((r) => ({ ...r, bold: false, section: undefined as string | undefined })), ...ROWS] : ROWS).map((row) => {
                const isBalance = row.label === 'Ending Loan Balance';
                const allRows = periods.flatMap((p) => p.rows);
                const total = isBalance
                  ? row.get(allRows[allRows.length - 1])
                  : allRows.reduce((s, r) => s + row.get(r), 0);
                return (
                <tr key={row.label} className={`border-t border-slate-100 ${row.bold ? 'bg-slate-50 font-semibold' : ''}`}>
                  <Td right={false} className={`sticky left-0 ${row.bold ? 'bg-slate-50' : 'bg-white'} text-slate-700`}>
                    {row.label}
                  </Td>
                  {periods.map((p) => {
                    const v = isBalance
                      ? row.get(p.rows[p.rows.length - 1])
                      : p.rows.reduce((s, r) => s + row.get(r), 0);
                    return (
                      <Td key={p.key}>
                        <Money v={v} colored />
                      </Td>
                    );
                  })}
                  <Td className="border-l border-slate-200 font-semibold">
                    {isBalance ? <span className="text-slate-400">—</span> : <Money v={total} colored />}
                  </Td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
