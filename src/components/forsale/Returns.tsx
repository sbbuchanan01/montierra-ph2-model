'use client';

import { Card, StatCard, Th, Td, Money } from '@/components/ui';
import { useForSale } from '@/store/useModelStore';
import { fmtDate, fmtMoney, fmtPct, fmtX } from '@/lib/format';
import { fmtMonth } from './common';

/** Returns — development economics, sellout, unlevered / levered roll-ups, partnership and the static sensitivities. */
export function ForSaleReturns() {
  const { m } = useForSale();
  const R = m.returns;
  const T = m.margin.trended;
  const years = m.annual.filter((y) => y.year === 0 || (y.year - 1) * 12 < Math.min(120, m.schedule.sellout));
  const dateOf = (month: number) => m.monthly[month]?.date ?? '';

  const rollup = (label: string, rows: [string, (y: (typeof years)[number]) => number, boolean?][]) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead>
          <tr>
            <Th right={false}>{label}</Th>
            {years.map((y) => <Th key={y.year}>Y{y.year}</Th>)}
            <Th className="border-l border-slate-200">Total</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, get, bold]) => (
            <tr key={name} className={`border-t border-slate-100 ${bold ? 'bg-slate-50 font-semibold' : ''}`}>
              <Td right={false} className="text-slate-700">{name}</Td>
              {years.map((y) => <Td key={y.year}><Money v={get(y)} colored /></Td>)}
              <Td className="border-l border-slate-200 font-semibold"><Money v={years.reduce((s, y) => s + get(y), 0)} colored /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const grid = (title: string, values: number[][], fmt: (v: number) => string) => (
    <Card title={title} subtitle="Rows: sales price change · Columns: hard cost change (with soft contingency). Static — timing, carry and loan sizing held at the base case.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr>
              <Th right={false}>Price ↓ / Hard cost →</Th>
              {m.sensitivity.steps.map((s) => <Th key={s}>{fmtPct(s, 1)}</Th>)}
            </tr>
          </thead>
          <tbody>
            {m.sensitivity.steps.map((dp, i) => (
              <tr key={dp} className={`border-t border-slate-100 ${dp === 0 ? 'bg-slate-50 font-semibold' : ''}`}>
                <Td right={false}>{fmtPct(dp, 1)}</Td>
                {values[i].map((v, j) => (
                  <Td key={j} className={`${v < 0 ? 'text-red-600' : ''} ${m.sensitivity.steps[j] === 0 ? 'bg-slate-50 font-semibold' : ''}`}>{fmt(v)}</Td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <StatCard label="Unlevered IRR" value={fmtPct(R.unleveredIrr)} sub={`MOIC ${fmtX(R.unleveredMoic)} · profit ${fmtMoney(R.unleveredProfit)}`} />
        <StatCard label="Levered IRR" value={fmtPct(R.leveredIrr)} sub={`MOIC ${fmtX(R.leveredMoic)} · profit ${fmtMoney(R.leveredProfit)}`} accent />
        <StatCard label="LP IRR" value={fmtPct(R.lpIrr)} sub={`MOIC ${fmtX(R.lpMoic)}`} accent />
        <StatCard label="GP IRR" value={fmtPct(R.gpIrr)} sub={`MOIC ${fmtX(R.gpMoic)} · promote ${fmtMoney(R.gpPromote)}`} />
        <StatCard label="Margin on Gross Sales" value={fmtPct(T.marginOnGross, 1)} sub={`on net proceeds ${fmtPct(T.marginOnNet, 1)}`} />
        <StatCard label="Return on Cost" value={fmtPct(T.returnOnCost, 1)} sub={`${fmtPct(T.annualizedRoc, 1)} annualized · cushion ${fmtPct(T.priceCushion, 1)}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Development Economics, Profit & Sellout">
          <table className="w-full">
            <tbody>
              {(
                [
                  ['Total development cost (all-in)', fmtMoney(m.budget.total)],
                  ['Cost per home / per net SF', `${fmtMoney(m.budget.total / Math.max(1, m.units))} / ${fmtMoney(m.budget.total / Math.max(1, m.nsf), 2)}`],
                  ['Land & acquisition / hard costs', `${fmtMoney(m.budget.landSubtotal)} / ${fmtMoney(m.budget.hardSubtotal)}`],
                  ['Gross sellout (at closing prices)', fmtMoney(T.gross)],
                  ['Net sales proceeds', fmtMoney(T.netSales)],
                  ['Carry, taxes & warranty on unsold inventory', fmtMoney(T.directCarry + T.taxes + T.warranty)],
                  ['NET PROFIT (levered, before promote)', fmtMoney(T.netProfit)],
                  ['Net profit per home', fmtMoney(T.profitPerUnit)],
                ] as [string, string][]
              ).map(([label, v]) => (
                <tr key={label} className={`border-t border-slate-100 ${label === label.toUpperCase() ? 'font-semibold' : ''}`}>
                  <Td right={false} className="text-slate-700">{label}</Td>
                  <Td>{v}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Sellout">
          <table className="w-full">
            <tbody>
              {(
                [
                  ['First closing', fmtMonth(m.schedule.firstClosing, dateOf(m.schedule.firstClosing))],
                  ['Sellout — last closing', fmtMonth(m.schedule.sellout, m.schedule.selloutDate)],
                  ['Sellout duration (months)', `${m.schedule.selloutDuration}`],
                  ['Average closings per month', R.avgClosingsPerMonth.toFixed(2)],
                  ['Average gross price per home / per SF', `${fmtMoney(R.avgPricePerHome)} / ${fmtMoney(R.avgPricePsf, 2)}`],
                  ['Carry, taxes & warranty per home', fmtMoney(R.carryPerHome)],
                  ['Construction loan fully repaid', m.financing.repaidMonth === null ? 'n/a' : fmtMonth(m.financing.repaidMonth, dateOf(m.financing.repaidMonth))],
                  ['Peak cumulative equity outstanding', fmtMoney(R.peakEquityOutstanding)],
                  ['Equity at the land closing', fmtMoney(R.equityAtLandClosing)],
                  ['TOTAL EQUITY INVESTED (every capital call)', fmtMoney(R.totalEquityInvested)],
                ] as [string, string][]
              ).map(([label, v]) => (
                <tr key={label} className={`border-t border-slate-100 ${label === label.toUpperCase() ? 'font-semibold' : ''}`}>
                  <Td right={false} className="text-slate-700">{label}</Td>
                  <Td>{v}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Unlevered Returns — annual roll-up" subtitle={`Model year ends ${years.map((y) => fmtDate(y.yearEnd)).slice(1, 3).join(', ')}…`}>
        {rollup('Unlevered', [
          ['Development spend', (y) => y.devTotal],
          ['Net sellout cash flow', (y) => y.netSellout],
          ['TOTAL UNLEVERED NET CASH FLOW', (y) => y.unlevered, true],
        ])}
      </Card>
      <Card title="Levered Returns — annual roll-up">
        {rollup('Levered', [
          ['Development spend', (y) => y.devTotal],
          ['Loan draws', (y) => y.loanDraws],
          ['Net sellout cash flow', (y) => y.netSellout],
          ['Construction interest', (y) => y.interest],
          ['Loan repayment & payoff', (y) => y.repayment],
          ['TOTAL LEVERED NET CASH FLOW', (y) => y.levered, true],
        ])}
      </Card>
      <Card title="Partnership Summary — LP / GP" subtitle={`Pref paid ${fmtMoney(R.prefPaid)} · return of capital ${fmtMoney(R.returnOfCapital)} · tiers 2 & 3 ${fmtMoney(R.tier23Distributed)} · promote ${fmtMoney(R.gpPromote)}`}>
        {rollup('Partners', [
          ['LP distributions', (y) => y.lpDistributions],
          ['LP contributions', (y) => y.lpContributions],
          ['LP NET CASH FLOW', (y) => y.lpNet, true],
          ['GP distributions', (y) => y.gpDistributions],
          ['GP contributions', (y) => y.gpContributions],
          ['GP NET CASH FLOW', (y) => y.gpNet, true],
        ])}
      </Card>

      {grid('Net Profit Sensitivity', m.sensitivity.profit, (v) => fmtMoney(v))}
      {grid('Margin on Gross Sales Sensitivity', m.sensitivity.margin, (v) => fmtPct(v, 1))}
    </div>
  );
}
