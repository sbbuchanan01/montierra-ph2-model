'use client';

import { Card, StatCard, Th, Td, Money } from '@/components/ui';
import { useForSale } from '@/store/useModelStore';
import { fmtDate, fmtMoney, fmtNum, fmtPct, fmtX } from '@/lib/format';
import { ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { CTh, CTd, Checks, fmtMonth } from './common';

export function ForSaleSummary() {
  const { a, m } = useForSale();
  const B = m.budget;
  const F = m.financing;
  const T = m.margin.trended;
  const U = m.margin.untrended;
  const R = m.returns;
  const perUnit = (v: number) => fmtMoney(v / Math.max(1, m.units));
  const perSf = (v: number) => (m.nsf > 0 ? fmtMoney(v / m.nsf, 2) : '—');

  const uses: [string, number][] = [
    ['Land & Acquisition', B.landSubtotal],
    ['Hard Costs', B.hardSubtotal],
    ['Soft Costs', B.softSubtotal],
    ['Financing Costs', B.financingSubtotal],
    ['Reserves & Carry', B.reservesSubtotal],
  ];
  const sources: [string, number][] = [
    ['Construction Loan', F.commitment],
    ['GP / Sponsor Equity', F.gpEquity],
    ['LP / Investor Equity', F.lpEquity],
  ];

  const cumCf = m.monthly.filter((r) => r.month <= m.schedule.sellout + 3).map((r) => ({ month: r.month, cum: Math.round(r.cumulativeLevered) }));
  const S = m.schedule;
  const dateOf = (month: number) => m.monthly[month]?.date ?? '';
  const milestones: [string, number][] = [
    ['Land Closing', 0],
    ['Construction Start', S.constructionStart],
    ['Construction Complete', S.constructionEnd],
    ['First CO', S.firstCo],
    ['Last CO', S.lastDelivery],
    ['First Closing', S.firstClosing],
    ['Sellout — Last Closing', S.sellout],
  ];

  const marginRows: [string, keyof typeof T, boolean?, boolean?][] = [
    ['Gross Sellout Value', 'gross'],
    ['less Sales Commissions', 'commissions'],
    ['less Litigation / Defect Allowance', 'litigation'],
    ['less Operational Escrow / HOA Capitalization', 'escrow'],
    ['less Seller Closing Costs & Title', 'sellerClosing'],
    ['less Buyer Incentives / Concessions', 'incentives'],
    ['NET SALES PROCEEDS', 'netSales', true],
    ['less Direct Carry on Unsold Inventory', 'directCarry'],
    ['less Real Estate Taxes on Unsold Inventory', 'taxes'],
    ['less Warranty / Defect Reserve', 'warranty'],
    ['NET SELLOUT PROCEEDS', 'netSellout', true],
    ['less Development Cost excl. Construction Interest', 'costExInterest'],
    ['PROFIT BEFORE CONSTRUCTION INTEREST (unlevered)', 'profitBeforeInterest', true],
    ['less Construction Interest', 'interest'],
    ['NET PROFIT (levered, before promote)', 'netProfit', true],
    ['Margin on Gross Sales', 'marginOnGross', false, true],
    ['Margin on Net Sales Proceeds', 'marginOnNet', false, true],
    ['Return on Cost', 'returnOnCost', false, true],
    ['Annualized Return on Cost', 'annualizedRoc', false, true],
    ['Price Cushion to Break Even', 'priceCushion', false, true],
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <StatCard label="Total Development Cost" value={fmtMoney(B.total)} sub={`${perUnit(B.total)} / home · ${perSf(B.total)} / SF`} />
        <StatCard label="Construction Loan" value={fmtMoney(F.commitment)} sub={`${fmtPct(F.commitmentPctOfCost, 1)} LTC · ${F.binding} binds`} />
        <StatCard label="Total Equity" value={fmtMoney(F.equity)} sub={`GP ${fmtMoney(F.gpEquity)} · LP ${fmtMoney(F.lpEquity)}`} />
        <StatCard label="Net Sales Proceeds" value={fmtMoney(T.netSales)} sub={`Sellout ${fmtDate(S.selloutDate)} · ${fmtMoney(T.gross)} gross`} />
        <StatCard label="Levered IRR" value={fmtPct(R.leveredIrr)} sub={`MOIC ${fmtX(R.leveredMoic)} · profit ${fmtMoney(R.leveredProfit)}`} accent />
        <StatCard label="Margin on Gross Sales" value={fmtPct(T.marginOnGross, 1)} sub={`ROC ${fmtPct(T.returnOnCost, 1)} · ${fmtPct(T.annualizedRoc, 1)} annualized`} />
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card title="Sources & Uses" subtitle={`${fmtMoney(B.total)} · $/SF on ${fmtNum(m.nsf)} net saleable SF`}>
          <table className="w-full">
            <thead>
              <tr>
                <CTh left>Uses</CTh>
                <CTh>Amount</CTh>
                <CTh>$/Home</CTh>
                <CTh>$/SF</CTh>
                <CTh>%</CTh>
              </tr>
            </thead>
            <tbody>
              {uses.map(([name, v]) => (
                <tr key={name} className="border-t border-slate-100">
                  <CTd left className="text-slate-600">{name}</CTd>
                  <CTd><Money v={v} /></CTd>
                  <CTd className="text-slate-500">{perUnit(v)}</CTd>
                  <CTd className="text-slate-500">{perSf(v)}</CTd>
                  <CTd className="text-slate-400">{fmtPct(B.total ? v / B.total : 0, 1)}</CTd>
                </tr>
              ))}
              <tr className="border-t border-slate-300 font-semibold">
                <CTd left>Total Uses</CTd>
                <CTd><Money v={B.total} /></CTd>
                <CTd>{perUnit(B.total)}</CTd>
                <CTd>{perSf(B.total)}</CTd>
                <CTd className="text-slate-400">100.0%</CTd>
              </tr>
              <tr>
                <CTh left className="pt-3">Sources</CTh>
                <CTh className="pt-3" /><CTh className="pt-3" /><CTh className="pt-3" /><CTh className="pt-3" />
              </tr>
              {sources.map(([name, v]) => (
                <tr key={name} className="border-t border-slate-100">
                  <CTd left className="text-slate-600">{name}</CTd>
                  <CTd><Money v={v} /></CTd>
                  <CTd className="text-slate-500">{perUnit(v)}</CTd>
                  <CTd className="text-slate-500">{perSf(v)}</CTd>
                  <CTd className="text-slate-400">{fmtPct(B.total ? v / B.total : 0, 1)}</CTd>
                </tr>
              ))}
              <tr className="border-t border-slate-300 font-semibold">
                <CTd left>Total Sources</CTd>
                <CTd><Money v={F.commitment + F.equity} /></CTd>
                <CTd>{perUnit(F.commitment + F.equity)}</CTd>
                <CTd>{perSf(F.commitment + F.equity)}</CTd>
                <CTd className="text-slate-400">100.0%</CTd>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card title="Cumulative Levered Cash Flow" subtitle="Project (pre-promote) cash flow to/from equity — the XIRR series">
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
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Equity Invested</div>
              <div className="text-sm font-bold tabular-nums">{fmtMoney(R.totalEquityInvested)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Peak Outstanding</div>
              <div className="text-sm font-bold tabular-nums">{fmtMoney(R.peakEquityOutstanding)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Levered Profit</div>
              <div className="text-sm font-bold tabular-nums text-emerald-700">{fmtMoney(R.leveredProfit)}</div>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card title="Project Schedule">
            <table className="w-full">
              <thead>
                <tr>
                  <Th right={false}>Milestone</Th>
                  <Th>Month</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {milestones.map(([label, month]) => (
                  <tr key={label} className="border-t border-slate-100">
                    <Td right={false} className="text-slate-700">{label}</Td>
                    <Td>{month}</Td>
                    <Td>{dateOf(month) ? fmtDate(dateOf(month)) : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-slate-500">
              Loan fully repaid {F.repaidMonth === null ? 'never' : fmtMonth(F.repaidMonth, dateOf(F.repaidMonth))} · sellout {S.selloutDuration} months
              at {fmtNum(R.avgClosingsPerMonth, 1)} closings / month
            </p>
          </Card>
          <Card title="Program" subtitle={`${fmtNum(m.units)} homes · ${fmtNum(m.nsf)} SF · ${fmtMoney(m.waPrice)} / home today (${fmtMoney(m.waPsf, 2)}/SF)`}>
            <table className="w-full">
              <thead>
                <tr>
                  <CTh left>Plan</CTh>
                  <CTh>Homes</CTh>
                  <CTh>Avg SF</CTh>
                  <CTh>Base $/SF</CTh>
                  <CTh>Base Price</CTh>
                </tr>
              </thead>
              <tbody>
                {a.plans.filter((p) => p.count > 0).map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <CTd left>{p.code} <span className="text-slate-400">{p.description}</span></CTd>
                    <CTd>{p.count}</CTd>
                    <CTd>{fmtNum(p.avgSf)}</CTd>
                    <CTd>${p.basePsf.toFixed(2)}</CTd>
                    <CTd>{fmtMoney(p.avgSf * p.basePsf)}</CTd>
                  </tr>
                ))}
                <tr className="border-t border-slate-300 font-semibold">
                  <CTd left>Total / Wtd. Avg.</CTd>
                  <CTd>{fmtNum(m.units)}</CTd>
                  <CTd>{fmtNum(m.avgSf)}</CTd>
                  <CTd>${m.waPsf.toFixed(2)}</CTd>
                  <CTd>{fmtMoney(m.waPrice)}</CTd>
                </tr>
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Margin on Cost" subtitle="Untrended = today's prices and carry rates · Trended = the monthly engine, each home at the price in the year it closes">
          <table className="w-full">
            <thead>
              <tr>
                <Th right={false} />
                <Th>Untrended</Th>
                <Th>Trended</Th>
              </tr>
            </thead>
            <tbody>
              {marginRows.map(([label, key, bold, pct]) => (
                <tr key={key} className={`border-t border-slate-100 ${bold ? 'bg-slate-50 font-semibold' : ''}`}>
                  <Td right={false} className="text-slate-700">{label}</Td>
                  <Td>{pct ? fmtPct(U[key], 1) : <Money v={U[key]} colored />}</Td>
                  <Td>{pct ? fmtPct(T[key], 1) : <Money v={T[key]} colored />}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="space-y-5">
          <Card title="Key Financial Metrics">
            <table className="w-full">
              <thead>
                <tr>
                  <Th right={false} />
                  <Th>Unlevered</Th>
                  <Th>Levered</Th>
                  <Th>JV Partner (LP)</Th>
                  <Th>Sponsor (GP)</Th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <Td right={false} className="text-slate-600">Profit</Td>
                  <Td><Money v={R.unleveredProfit} colored /></Td>
                  <Td><Money v={R.leveredProfit} colored /></Td>
                  <Td><Money v={R.lpProfit} colored /></Td>
                  <Td><Money v={R.gpProfit} colored /></Td>
                </tr>
                <tr className="border-t border-slate-100">
                  <Td right={false} className="text-slate-600">XIRR</Td>
                  <Td>{fmtPct(R.unleveredIrr)}</Td>
                  <Td>{fmtPct(R.leveredIrr)}</Td>
                  <Td>{fmtPct(R.lpIrr)}</Td>
                  <Td>{fmtPct(R.gpIrr)}</Td>
                </tr>
                <tr className="border-t border-slate-100">
                  <Td right={false} className="text-slate-600">Equity Multiple</Td>
                  <Td>{fmtX(R.unleveredMoic)}</Td>
                  <Td>{fmtX(R.leveredMoic)}</Td>
                  <Td>{fmtX(R.lpMoic)}</Td>
                  <Td>{fmtX(R.gpMoic)}</Td>
                </tr>
              </tbody>
            </table>
            <div className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">
              GP promote {fmtMoney(R.gpPromote)} · preferred return paid {fmtMoney(R.prefPaid)} · construction interest {fmtMoney(F.totalInterest)} (
              {fmtMoney(F.capitalizedInterest)} capitalized, {fmtMoney(F.interestFromSales)} paid from sales) · circular solve converged in {m.iterations} passes
            </div>
          </Card>
          <Card title="Model Checks">
            <Checks checks={m.checks} />
          </Card>
        </div>
      </div>
    </div>
  );
}
