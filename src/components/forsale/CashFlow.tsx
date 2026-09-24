'use client';

import { useState } from 'react';
import { Card, Th, Td, Money } from '@/components/ui';
import { useForSale } from '@/store/useModelStore';
import { fmtDate, fmtMoney } from '@/lib/format';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from 'recharts';
import type { SalesMonth } from '@/lib/forsale/types';

type Granularity = 'monthly' | 'annual';
type Row = { label: string; get: (r: SalesMonth) => number; bold?: boolean; section?: string; balance?: boolean; count?: boolean };

/** Sales CF — the monthly cash flow rolled up annually or shown month by month. */
export function ForSaleCashFlow() {
  const { a, m } = useForSale();
  const [gran, setGran] = useState<Granularity>('annual');
  const [detail, setDetail] = useState(false);

  const rows: Row[] = [
    { section: 'Homes', label: 'Homes Closed', get: (r) => r.closed, count: true },
    { label: 'Homes Not Yet Closed (period end)', get: (r) => r.notYetClosed, count: true, balance: true },
    { section: 'Sales', label: 'Gross Sales Revenue', get: (r) => r.grossSales, bold: true },
    ...(detail
      ? [
          { label: '  Sales Commissions', get: (r: SalesMonth) => r.commissions },
          { label: '  Litigation / Defect Allowance', get: (r: SalesMonth) => r.litigation },
          { label: '  Operational Escrow / HOA Capitalization', get: (r: SalesMonth) => r.escrow },
          { label: '  Seller Closing Costs & Title', get: (r: SalesMonth) => r.sellerClosing },
          { label: '  Buyer Incentives / Concessions', get: (r: SalesMonth) => r.incentives },
        ]
      : [{ label: '  Total Closing Deductions', get: (r: SalesMonth) => r.totalDeductions }]),
    { label: 'Net Sales Proceeds', get: (r) => r.netSales, bold: true },
    ...(detail
      ? a.carry.map((c, i) => ({ label: `  ${c.label}`, get: (r: SalesMonth) => r.carryItems[i] ?? 0 }))
      : [{ label: '  Direct Carry on Unsold Inventory', get: (r: SalesMonth) => r.carryItems.reduce((s, v) => s + v, 0) }]),
    { label: '  Real Estate Taxes on Unsold Inventory', get: (r) => r.taxesOnUnsold },
    { label: '  Warranty / Defect Reserve', get: (r) => r.warranty },
    { label: 'NET SELLOUT CASH FLOW', get: (r) => r.netSellout, bold: true },
    { section: 'Development', label: '  Land, Fees & Up-Front Costs', get: (r) => r.devLand },
    { label: '  Predevelopment Soft Costs', get: (r) => r.devPredev },
    { label: '  Hard Costs (curve)', get: (r) => r.devHard },
    { label: '  Delivery & Sales-Period Costs', get: (r) => r.devDeliverySales },
    { label: '  Straight-Line Construction-Period Costs', get: (r) => r.devStraightLine },
    { label: '  Real Estate Taxes — Capitalized', get: (r) => r.devTaxes },
    { label: 'Total Development Spend (excl. interest)', get: (r) => r.devTotal, bold: true },
    { label: 'UNLEVERED NET CASH FLOW', get: (r) => r.unlevered, bold: true },
    { section: 'Financing', label: '  Loan Draws', get: (r) => r.loanDraw },
    { label: '  Construction Interest (paid current)', get: (r) => r.interest },
    { label: '  Loan Repayment from Closings', get: (r) => r.repayment },
    { label: '  Loan Payoff at Sellout', get: (r) => r.payoff },
    { label: 'Total Financing Cash Flow', get: (r) => r.financing, bold: true },
    { label: 'EOP Loan Balance', get: (r) => r.loanBalance, balance: true },
    { label: 'LEVERED NET CASH FLOW', get: (r) => r.levered, bold: true },
    { label: 'Cumulative Levered Net Cash Flow', get: (r) => r.cumulativeLevered, balance: true },
  ];

  const last = Math.min(120, m.schedule.sellout);
  const periods =
    gran === 'monthly'
      ? m.monthly.filter((r) => r.month <= last).map((r) => ({ key: `M${r.month}`, label: r.month === 0 ? 'M0 · Land' : `M${r.month} · ${fmtDate(r.date)}`, rows: [r] }))
      : m.annual
          .filter((y) => y.year === 0 || (y.year - 1) * 12 < last)
          .map((y) => ({ key: `Y${y.year}`, label: y.year === 0 ? 'Year 0 (land)' : `Year ${y.year}`, rows: m.monthly.filter((r) => r.year === y.year) }));

  const chart = periods.map((p) => ({ label: p.key, cf: Math.round(p.rows.reduce((s, r) => s + r.levered, 0)) }));
  const allRows = periods.flatMap((p) => p.rows);
  const fmtCell = (row: Row, v: number) => (row.count ? v.toLocaleString() : <Money v={v} colored />);

  return (
    <div className="space-y-5">
      <Card title="Levered Net Cash Flow" subtitle="Pre-promote cash flow to/from equity (the XIRR / waterfall series)">
        <div className="mb-3 flex gap-2">
          {(['annual', 'monthly'] as Granularity[]).map((g) => (
            <button key={g} onClick={() => setGran(g)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${gran === g ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-100'}`}>
              {g === 'annual' ? 'Annual' : 'Monthly'}
            </button>
          ))}
          <button onClick={() => setDetail((v) => !v)} className={`ml-auto rounded-lg border px-3 py-1.5 text-sm font-medium ${detail ? 'border-slate-900 text-slate-900' : 'border-slate-300 text-slate-600'}`}>
            {detail ? 'Hide' : 'Show'} deduction & carry detail
          </button>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={chart} margin={{ left: 10, right: 10, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={gran === 'monthly' ? 2 : 0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} width={52} />
              <Tooltip formatter={(v) => fmtMoney(Number(v))} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Bar dataKey="cf" name="Levered CF" radius={[3, 3, 0, 0]}>
                {chart.map((d, i) => <Cell key={i} fill={d.cf < 0 ? '#dc2626' : '#0f2a43'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title={gran === 'annual' ? 'Annual Summary' : 'Monthly Cash Flow'} subtitle="Through sellout; the grid runs 120 months">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th right={false} className="sticky left-0 bg-white">Line</Th>
                {periods.map((p) => <Th key={p.key}>{p.label}</Th>)}
                <Th className="border-l border-slate-200">Total</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const total = row.balance ? row.get(allRows[allRows.length - 1]) : allRows.reduce((s, r) => s + row.get(r), 0);
                return (
                  <tr key={row.label} className={`border-t border-slate-100 ${row.bold ? 'bg-slate-50 font-semibold' : ''}`}>
                    <Td right={false} className={`sticky left-0 ${row.bold ? 'bg-slate-50' : 'bg-white'} text-slate-700`}>
                      {row.section && <span className="mr-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{row.section}</span>}
                      {row.label}
                    </Td>
                    {periods.map((p) => {
                      const v = row.balance ? row.get(p.rows[p.rows.length - 1]) : p.rows.reduce((s, r) => s + row.get(r), 0);
                      return <Td key={p.key}>{fmtCell(row, v)}</Td>;
                    })}
                    <Td className="border-l border-slate-200 font-semibold">{row.balance ? <span className="text-slate-400">—</span> : fmtCell(row, total)}</Td>
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
