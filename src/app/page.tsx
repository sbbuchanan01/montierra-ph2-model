'use client';

import { Card, StatCard, Th, Td, Money } from '@/components/ui';
import { useModel, useModelStore } from '@/store/useModelStore';
import { fmtDate, fmtMoney, fmtNum, fmtPct, fmtX } from '@/lib/format';
import {
  ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';

export default function DealSummaryPage() {
  const m = useModel();
  const a = useModelStore((s) => s.assumptions);

  const uses = [
    { name: 'Land', value: m.budget.landTotal },
    { name: 'Hard Costs', value: m.budget.hardCostTotal },
    {
      name: 'Soft Costs (Consultants, Etc.)',
      value: m.budget.softCostConsultants + m.budget.softCostMarketing + m.budget.softCostMunicipal,
    },
    { name: 'Soft Costs (Financing)', value: m.budget.softCostFinancing },
    { name: 'Soft Costs (Operating, G&A)', value: m.budget.softCostOperating + m.budget.softCostGa },
  ];

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

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Sources & Uses" subtitle={`Uses total ${fmtMoney(m.budget.totalGross)}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th right={false}>Uses</Th>
                  <Th>Amount</Th>
                  <Th>$ / Unit</Th>
                  <Th>%</Th>
                </tr>
              </thead>
              <tbody>
                {uses.map((row) => (
                  <tr key={row.name} className="border-t border-slate-100">
                    <Td right={false} className="text-slate-600">{row.name}</Td>
                    <Td><Money v={row.value} /></Td>
                    <Td className="text-slate-500">{fmtMoney(row.value / Math.max(1, m.totalUnits))}</Td>
                    <Td className="text-slate-400">{fmtPct(row.value / m.budget.totalGross, 1)}</Td>
                  </tr>
                ))}
                <tr className="border-t border-slate-300 font-semibold">
                  <Td right={false}>Total Uses (gross)</Td>
                  <Td><Money v={m.budget.totalGross} /></Td>
                  <Td>{fmtMoney(m.budget.totalGross / Math.max(1, m.totalUnits))}</Td>
                  <Td className="text-slate-400">100.0%</Td>
                </tr>
                <tr className="border-t border-slate-200">
                  <Td right={false} className="pt-3 text-slate-600">Construction Loan</Td>
                  <Td className="pt-3"><Money v={m.financing.loanAmount} /></Td>
                  <Td className="pt-3 text-slate-500">{fmtMoney(m.financing.loanAmount / Math.max(1, m.totalUnits))}</Td>
                  <Td className="pt-3 text-slate-400">{fmtPct(a.financing.construction.ltc, 1)}</Td>
                </tr>
                <tr className="border-t border-slate-100">
                  <Td right={false} className="text-slate-600">Equity</Td>
                  <Td><Money v={m.financing.equityCommitment} /></Td>
                  <Td className="text-slate-500">{fmtMoney(m.financing.equityCommitment / Math.max(1, m.totalUnits))}</Td>
                  <Td className="text-slate-400">{fmtPct(1 - a.financing.construction.ltc, 1)}</Td>
                </tr>
                <tr className="border-t border-slate-300 font-semibold">
                  <Td right={false}>Total Capital Sources</Td>
                  <Td><Money v={m.financing.loanAmount + m.financing.equityCommitment} /></Td>
                  <Td>{fmtMoney((m.financing.loanAmount + m.financing.equityCommitment) / Math.max(1, m.totalUnits))}</Td>
                  <Td className="text-slate-400">100.0%</Td>
                </tr>
              </tbody>
            </table>
          </div>
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
                    <Td>{date ? fmtDate(date) : 'â€”'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
          <Card title="Unit Mix Summary" subtitle={`${fmtNum(m.totalUnits)} units · ${fmtNum(m.totalNrsf)} SF · avg rent ${fmtMoney(m.avgRent)}/mo`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th right={false}>Type</Th>
                    <Th>Units</Th>
                    <Th>Avg SF</Th>
                    <Th>Rent</Th>
                    <Th>PSF</Th>
                  </tr>
                </thead>
                <tbody>
                  {a.unitMix.filter((r) => r.count > 0).map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <Td right={false}>{r.unitType}</Td>
                      <Td>{r.count}</Td>
                      <Td>{fmtNum(r.avgSf)}</Td>
                      <Td>{fmtMoney(r.avgSf * r.rentPsf)}</Td>
                      <Td>${r.rentPsf.toFixed(2)}</Td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-300 font-semibold">
                    <Td right={false}>Total / Average</Td>
                    <Td>{fmtNum(m.totalUnits)}</Td>
                    <Td>{fmtNum(m.totalUnits > 0 ? m.totalNrsf / m.totalUnits : 0)}</Td>
                    <Td>{fmtMoney(m.avgRent)}</Td>
                    <Td>
                      ${(m.totalNrsf > 0 ? (m.avgRent * m.totalUnits) / m.totalNrsf : 0).toFixed(2)}
                    </Td>
                  </tr>
                </tbody>
              </table>
            </div>
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

