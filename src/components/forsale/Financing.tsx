'use client';

import { Card, Field, NumberInput, PctInput, Select, Th, Td, Money, Note } from '@/components/ui';
import { useForSale } from '@/store/useModelStore';
import { fmtMoney, fmtPct } from '@/lib/format';
import type { FundingOrder, InterestBudgetMode, LtcBasis } from '@/lib/forsale/types';
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

/** Construction loan — Inputs §7 and the Debt Schedule tab. */
export function ForSaleFinancing() {
  const { a, m, update } = useForSale();
  const F = a.financing;
  const setF = (patch: Partial<typeof F>) => update((d) => ({ ...d, financing: { ...d.financing, ...patch } }));
  const Z = m.financing;

  const data = m.debt.filter((d) => d.month <= Math.min(120, m.schedule.sellout + 2)).map((d) => ({
    month: d.month,
    balance: Math.round(d.eop),
    rate: Math.round(d.rate * 10000) / 100,
  }));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Construction Loan — Sizing & Terms" subtitle={`${fmtMoney(Z.commitment)} commitment · ${Z.binding} binds · sizing rate ${fmtPct(Z.sizingRate)}`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Field label="Maximum loan-to-cost"><PctInput value={F.maxLtc} onChange={(v) => setF({ maxLtc: v })} step={0.5} /></Field>
            <Field label="LTC sizing basis" hint="Total Project Cost = all-in incl. interest & fees">
              <Select value={F.ltcBasis} onChange={(v: LtcBasis) => setF({ ltcBasis: v })} options={['Total Project Cost', 'Land + Hard + Soft'] as const} />
            </Field>
            <Field label="Max loan-to-gross-sellout (today)"><PctInput value={F.maxLoanToSellout} onChange={(v) => setF({ maxLoanToSellout: v })} step={0.5} /></Field>
            <Field label="Rate type">
              <Select value={F.rateType} onChange={(v) => setF({ rateType: v })} options={['Floating', 'Fixed'] as const} />
            </Field>
            <Field label="Fixed rate (annual)"><PctInput value={F.fixedRate} onChange={(v) => setF({ fixedRate: v })} step={0.05} /></Field>
            <Field label="Floating spread over SOFR" hint="SOFR by model year is on Program & Pricing"><PctInput value={F.spread} onChange={(v) => setF({ spread: v })} step={0.05} /></Field>
            <Field label="Rate cap strike (SOFR, 0 = none)"><PctInput value={F.capStrike} onChange={(v) => setF({ capStrike: v })} step={0.05} /></Field>
            <Field label="Loan term (months)"><NumberInput value={F.termMonths} onChange={(v) => setF({ termMonths: Math.max(1, Math.round(v)) })} min={1} /></Field>
            <Field label="Origination fee (% of commitment)"><PctInput value={F.originationFeePct} onChange={(v) => setF({ originationFeePct: v })} step={0.05} /></Field>
            <Field label="Funding order" hint="Equity First = equity funds the first dollars, the loan the balance">
              <Select value={F.fundingOrder} onChange={(v: FundingOrder) => setF({ fundingOrder: v })} options={['Equity First', 'Pari Passu'] as const} />
            </Field>
            <Field label="Loan release — % of net closing proceeds"><PctInput value={F.releasePct} onChange={(v) => setF({ releasePct: v })} step={5} /></Field>
            <Field label="Construction interest budget" hint="Circular = the engine's interest before the first closing">
              <Select value={F.interestBudget} onChange={(v: InterestBudgetMode) => setF({ interestBudget: v })} options={['Circular', 'Manual'] as const} />
            </Field>
            <Field label="Manual interest amount ($)" hint={F.interestBudget === 'Circular' ? `Not in use — the loop converged at ${fmtMoney(m.budget.interestBudget)}` : undefined}>
              <NumberInput value={F.manualInterest} onChange={(v) => setF({ manualInterest: v })} min={0} step={500} />
            </Field>
          </div>
        </Card>

        <Card title="Loan Sizing" subtitle="Lesser of the two tests">
          <table className="w-full">
            <tbody>
              {(
                [
                  ['Total project cost (budget)', fmtMoney(m.budget.total)],
                  ['  Project cost excluding the origination fee', fmtMoney(m.budget.costExFee)],
                  ['  Land + hard + soft costs', fmtMoney(m.budget.landHardSoft)],
                  ['Max proceeds — loan-to-cost test', fmtMoney(Z.maxLtcProceeds)],
                  ['Max proceeds — loan-to-gross-sellout test', fmtMoney(Z.maxSelloutProceeds)],
                  ['CONSTRUCTION LOAN COMMITMENT', fmtMoney(Z.commitment)],
                  ['  Binding constraint', Z.binding],
                  ['  Commitment as % of total project cost', fmtPct(Z.commitmentPctOfCost, 1)],
                  ['  Commitment as % of gross sellout (today)', fmtPct(Z.commitmentPctOfSellout, 1)],
                  ['  Loan per home', fmtMoney(Z.loanPerUnit)],
                  ['TOTAL EQUITY REQUIRED (budget)', fmtMoney(Z.equity)],
                  ['Peak funded balance', fmtMoney(Z.peakBalance)],
                  ['Loan fully repaid (month #)', Z.repaidMonth === null ? 'n/a' : `M${Z.repaidMonth}`],
                  ['Total interest / capitalized in the budget / paid from sales', `${fmtMoney(Z.totalInterest)} / ${fmtMoney(Z.capitalizedInterest)} / ${fmtMoney(Z.interestFromSales)}`],
                ] as [string, string][]
              ).map(([label, v]) => (
                <tr key={label} className={`border-t border-slate-100 ${label === label.toUpperCase() ? 'font-semibold' : ''}`}>
                  <Td right={false} className="text-slate-700">{label}</Td>
                  <Td>{v}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3">
            <Note>
              Interest is paid current. Before the first closing it is a budget line funded by the draw (equity first, then the
              loan); from the first closing it is paid from sales cash while the lender sweeps the release percentage of net
              sellout cash. Anything left at the last closing is paid off that month.
            </Note>
          </div>
        </Card>
      </div>

      <Card title="Loan Balance & Rate">
        <div className="h-64">
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ left: 10, right: 10, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => `M${v}`} />
              <YAxis yAxisId="l" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} width={52} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} unit="%" width={44} domain={['auto', 'auto']} />
              <Tooltip formatter={(v, n) => (n === 'Rate' ? `${v}%` : fmtMoney(Number(v)))} labelFormatter={(l) => `Month ${l}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area yAxisId="l" type="monotone" dataKey="balance" fill="#c7d7e6" stroke="#0f2a43" name="Loan balance" />
              <Line yAxisId="r" type="stepAfter" dataKey="rate" stroke="#b45309" dot={false} name="Rate" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Debt Schedule" subtitle="Monthly through sellout">
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full min-w-[900px]">
            <thead className="sticky top-0 bg-white">
              <tr>
                <Th>Mo</Th>
                <Th right={false}>Phase</Th>
                <Th>Rate</Th>
                <Th>BOP</Th>
                <Th>Interest</Th>
                <Th>Budget-Funded</Th>
                <Th>From Sales</Th>
                <Th>Draw</Th>
                <Th>Repayment</Th>
                <Th>Payoff</Th>
                <Th>EOP</Th>
                <Th>Undrawn</Th>
              </tr>
            </thead>
            <tbody>
              {m.debt.filter((d) => d.month <= Math.min(120, m.schedule.sellout)).map((d) => (
                <tr key={d.month} className="border-t border-slate-100">
                  <Td>{d.month}</Td>
                  <Td right={false} className="text-slate-500">{d.phase}</Td>
                  <Td>{fmtPct(d.rate)}</Td>
                  <Td><Money v={d.bop} /></Td>
                  <Td><Money v={d.interest} /></Td>
                  <Td><Money v={d.interestBudgetFunded} /></Td>
                  <Td><Money v={d.interestFromSales} /></Td>
                  <Td><Money v={d.draw} /></Td>
                  <Td><Money v={d.repayment} colored /></Td>
                  <Td><Money v={d.payoff} colored /></Td>
                  <Td><Money v={d.eop} /></Td>
                  <Td className="text-slate-500"><Money v={d.undrawn} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
