'use client';

import { ForSaleSummary } from '@/components/forsale/Summary';
import { useModelKind } from '@/store/useModelStore';
import { type ReactNode } from 'react';
import { Card, StatCard, Th, Td, Money } from '@/components/ui';
import { useModel, useModelStore, useRentalAssumptions } from '@/store/useModelStore';
import { fmtDate, fmtMoney, fmtNum, fmtPct, fmtX } from '@/lib/format';
import {
  ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';

function DealSummaryPage() {
  const m = useModel();
  const a = useRentalAssumptions();

  const uses = [
    { name: 'Land', value: m.budget.landTotal },
    { name: 'Hard Costs', value: m.budget.hardCostTotal },
    {
      name: 'Soft – Consultants',
      value: m.budget.softCostConsultants + m.budget.softCostMarketing + m.budget.softCostMunicipal,
    },
    { name: 'Soft – Financing', value: m.budget.softCostFinancing },
    { name: 'Soft – Oper./G&A', value: m.budget.softCostOperating + m.budget.softCostGa },
  ];
  const perUnit = (v: number) => fmtMoney(v / Math.max(1, m.totalUnits));
  const perSf = (v: number) => (m.totalNrsf > 0 ? fmtMoney(v / m.totalNrsf) : '—');
  const sources: [string, number, number][] = [
    ['Construction Loan', m.financing.loanAmount, a.financing.construction.ltc],
    ['Equity', m.financing.equityCommitment, 1 - a.financing.construction.ltc],
  ];
  const totalSources = m.financing.loanAmount + m.financing.equityCommitment;

  let cum = 0;
  const cumCf = m.monthly
    .filter((r) => r.month <= m.sale.month + 6)
    .map((r) => {
      cum += r.projectCashFlow;
      return { month: r.month, cum: Math.round(cum) };
    });

  const milestones: [string, number, string][] = [
    ['Land Closing', a.schedule.landClosingMonth, m.monthly[a.schedule.landClosingMonth - 1]?.date ?? ''],
    ['Construction Start', a.schedule.softCostStartMonth, m.monthly[a.schedule.softCostStartMonth - 1]?.date ?? ''],
    ['Construction Complete', m.constructionEndMonth, m.monthly[m.constructionEndMonth - 1]?.date ?? ''],
    ['Lease-Up Start', a.schedule.leaseUpStartMonth, m.monthly[a.schedule.leaseUpStartMonth - 1]?.date ?? ''],
    ['Stabilization', m.leaseUpEndMonth, m.stabilizationDate],
    ['Sale', m.sale.month, m.sale.date],
  ];

  const u = m.operatingYield.untrended;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <StatCard label="Total Project Cost" value={fmtMoney(m.budget.totalGross)} sub={`${fmtMoney(m.budget.totalGross / m.totalUnits)} / unit`} />
        <StatCard label="Construction Loan" value={fmtMoney(m.financing.loanAmount)} sub={`${fmtPct(a.financing.construction.ltc, 1)} LTC`} />
        <StatCard label="Total Equity" value={fmtMoney(m.financing.equityCommitment)} sub={`GP ${fmtMoney(m.financing.gpEquity)} · LP ${fmtMoney(m.financing.lpEquity)}`} />
        <StatCard label="Net Sale Proceeds" value={fmtMoney(m.sale.netSaleProceeds)} sub={`Sale ${fmtDate(m.sale.date)} @ ${fmtPct(a.exit.mfCapRate, 2)} cap`} />
        <StatCard label="Project XIRR" value={fmtPct(m.returns.projectXirr)} sub={`MOIC ${fmtX(m.returns.projectMoic)}`} accent />
        <StatCard label="Untrended ROC" value={fmtPct(u.returnOnCostGross)} sub={`DY ${fmtPct(u.debtYield)} · DSCR ${fmtX(u.dscr)}`} />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Sources & Uses" subtitle={`${fmtMoney(m.budget.totalGross)} · $/SF on ${fmtNum(m.totalNrsf)} NRSF`}>
          <table className="w-full">
            <thead>
              <tr>
                <CTh left>Uses</CTh>
                <CTh>Amount</CTh>
                <CTh>$/Unit</CTh>
                <CTh>$/SF</CTh>
                <CTh>%</CTh>
              </tr>
            </thead>
            <tbody>
              {uses.map((row) => (
                <tr key={row.name} className="border-t border-slate-100">
                  <CTd left className="text-slate-600">{row.name}</CTd>
                  <CTd><Money v={row.value} /></CTd>
                  <CTd className="text-slate-500">{perUnit(row.value)}</CTd>
                  <CTd className="text-slate-500">{perSf(row.value)}</CTd>
                  <CTd className="text-slate-400">{fmtPct(row.value / m.budget.totalGross, 1)}</CTd>
                </tr>
              ))}
              <tr className="border-t border-slate-300 font-semibold">
                <CTd left>Total Uses</CTd>
                <CTd><Money v={m.budget.totalGross} /></CTd>
                <CTd>{perUnit(m.budget.totalGross)}</CTd>
                <CTd>{perSf(m.budget.totalGross)}</CTd>
                <CTd className="text-slate-400">100.0%</CTd>
              </tr>
              <tr>
                <CTh left className="pt-3">Sources</CTh>
                <CTh className="pt-3" />
                <CTh className="pt-3" />
                <CTh className="pt-3" />
                <CTh className="pt-3" />
              </tr>
              {sources.map(([name, v, pct]) => (
                <tr key={name} className="border-t border-slate-100">
                  <CTd left className="text-slate-600">{name}</CTd>
                  <CTd><Money v={v} /></CTd>
                  <CTd className="text-slate-500">{perUnit(v)}</CTd>
                  <CTd className="text-slate-500">{perSf(v)}</CTd>
                  <CTd className="text-slate-400">{fmtPct(pct, 1)}</CTd>
                </tr>
              ))}
              <tr className="border-t border-slate-300 font-semibold">
                <CTd left>Total Sources</CTd>
                <CTd><Money v={totalSources} /></CTd>
                <CTd>{perUnit(totalSources)}</CTd>
                <CTd>{perSf(totalSources)}</CTd>
                <CTd className="text-slate-400">100.0%</CTd>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card title="Cumulative Equity Cash Flow" subtitle="Project (pre-promote) cash flow to/from equity">
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={cumCf} margin={{ left: 10, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => `M${v}`} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} width={52} />
                <Tooltip formatter={(v) => fmtMoney(Number(v))} labelFormatter={(l) => `Month ${l}`} />
                <Line type="monotone" dataKey="cum" stroke="#0f2a43" strokeWidth={2} dot={false} name="Cumulative CF" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Contributions</div>
              <div className="text-sm font-bold tabular-nums">{fmtMoney(m.returns.totalEquityInvested)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Distributions</div>
              <div className="text-sm font-bold tabular-nums">{fmtMoney(m.returns.totalDistributions)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Profit</div>
              <div className="text-sm font-bold tabular-nums text-emerald-700">
                {fmtMoney(m.returns.totalDistributions - m.returns.totalEquityInvested)}
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card title="Project Schedule">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th right={false}>Milestone</Th>
                  <Th>Month</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {milestones.map(([label, month, date]) => (
                  <tr key={label} className="border-t border-slate-100">
                    <Td right={false} className="text-slate-700">{label}</Td>
                    <Td>{month}</Td>
                    <Td>{date ? fmtDate(date) : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
          <Card title="Unit Mix Summary" subtitle={`${fmtNum(m.totalUnits)} units · ${fmtNum(m.totalNrsf)} SF · avg rent ${fmtMoney(m.avgRent)}/mo`}>
            <table className="w-full">
              <thead>
                <tr>
                  <CTh left>Type</CTh>
                  <CTh>Units</CTh>
                  <CTh>Avg SF</CTh>
                  <CTh>Rent</CTh>
                  <CTh>$/SF</CTh>
                </tr>
              </thead>
              <tbody>
                {a.unitMix.filter((r) => r.count > 0).map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <CTd left>{r.unitType}</CTd>
                    <CTd>{r.count}</CTd>
                    <CTd>{fmtNum(r.avgSf)}</CTd>
                    <CTd>{fmtMoney(r.avgSf * r.rentPsf)}</CTd>
                    <CTd>${r.rentPsf.toFixed(2)}</CTd>
                  </tr>
                ))}
                <tr className="border-t border-slate-300 font-semibold">
                  <CTd left>Total / Avg</CTd>
                  <CTd>{fmtNum(m.totalUnits)}</CTd>
                  <CTd>{fmtNum(m.totalUnits > 0 ? m.totalNrsf / m.totalUnits : 0)}</CTd>
                  <CTd>{fmtMoney(m.avgRent)}</CTd>
                  <CTd>${(m.totalNrsf > 0 ? (m.avgRent * m.totalUnits) / m.totalNrsf : 0).toFixed(2)}</CTd>
                </tr>
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Value Creation" subtitle="Sale waterfall at exit">
          <table className="w-full">
            <tbody>
              {(
                [
                  [`MF Sale Price (F-12 NOI ${fmtMoney(m.sale.forwardNoiMf)} / ${fmtPct(a.exit.mfCapRate)} cap)`, m.sale.mfSalePrice],
                  ['Retail Sale Price', m.sale.retailSalePrice],
                  [`Less: Closing Costs (${fmtPct(a.exit.closingCostPct, 1)})`, m.sale.closingCosts],
                  ['Less: State Tax Liability', -m.sale.stateTaxOnSale],
                  ['Less: Loan Balance', -m.sale.loanBalanceRetired],
                  ['Net Sale Proceeds', m.sale.netSaleProceeds],
                  ['Less: Equity Return', -m.financing.equityCommitment],
                  ['Net Profit from Sale', m.sale.netProfitFromSale],
                ] as [string, number][]
              ).map(([label, v], i) => (
                <tr key={label} className={`border-t border-slate-100 ${i >= 5 ? 'font-semibold' : ''}`}>
                  <Td right={false} className="text-slate-700">{label}</Td>
                  <Td><Money v={v} colored /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Key Financial Metrics">
          <table className="w-full">
            <thead>
              <tr>
                <Th right={false} />
                <Th>Project</Th>
                <Th>JV Partner (LP)</Th>
                <Th>Sponsor (GP)</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <Td right={false} className="text-slate-600">Contributions</Td>
                <Td><Money v={m.waterfall.totalEquity} /></Td>
                <Td><Money v={m.waterfall.lpEquity} /></Td>
                <Td><Money v={m.waterfall.gpEquity} /></Td>
              </tr>
              <tr className="border-t border-slate-100">
                <Td right={false} className="text-slate-600">Profits</Td>
                <Td><Money v={m.waterfall.lpNetCashFlow + m.waterfall.gpNetCashFlow} colored /></Td>
                <Td><Money v={m.waterfall.lpNetCashFlow} colored /></Td>
                <Td><Money v={m.waterfall.gpNetCashFlow} colored /></Td>
              </tr>
              <tr className="border-t border-slate-100">
                <Td right={false} className="text-slate-600">XIRR</Td>
                <Td>{fmtPct(m.waterfall.projectIrr)}</Td>
                <Td>{fmtPct(m.waterfall.lpIrr)}</Td>
                <Td>{fmtPct(m.waterfall.gpIrr)}</Td>
              </tr>
              <tr className="border-t border-slate-100">
                <Td right={false} className="text-slate-600">MOIC</Td>
                <Td>{fmtX(m.waterfall.projectMoic)}</Td>
                <Td>{fmtX(m.waterfall.lpMoic)}</Td>
                <Td>{fmtX(m.waterfall.gpMoic)}</Td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">
            Iterative solve converged in {m.iterations} passes · capitalized construction interest{' '}
            {fmtMoney(m.financing.capitalizedInterest)} · first loan draw month {m.financing.firstDrawMonth}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* Compact cells for the narrow 1/3-width cards — sized to fit without horizontal scroll. */
function CTh({ children, left = false, className = '' }: { children?: ReactNode; left?: boolean; className?: string }) {
  return (
    <th className={`whitespace-nowrap px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 first:pl-0 last:pr-0 ${left ? 'text-left' : 'text-right'} ${className}`}>
      {children}
    </th>
  );
}

function CTd({ children, left = false, className = '' }: { children?: ReactNode; left?: boolean; className?: string }) {
  return (
    <td className={`whitespace-nowrap px-1.5 py-1 text-xs tabular-nums first:pl-0 last:pr-0 ${left ? 'text-left' : 'text-right'} ${className}`}>
      {children}
    </td>
  );
}

/** Rental or for-sale — the working draft decides which page renders. */
export default function Page() {
  return useModelKind() === 'forSale' ? <ForSaleSummary /> : <DealSummaryPage />;
}
