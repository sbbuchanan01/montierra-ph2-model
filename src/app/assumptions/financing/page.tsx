'use client';

import { Card, Field, NumberInput, PctInput, Select, Toggle, Th, Td, Money, Note } from '@/components/ui';
import { useModel, useModelStore } from '@/store/useModelStore';
import { fmtMoney, fmtPct } from '@/lib/format';
import { SOFR_FORWARD_CURVE } from '@/lib/model/curves';
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

export default function FinancingPage() {
  const a = useModelStore((s) => s.assumptions);
  const update = useModelStore((s) => s.update);
  const m = useModel();

  const C = a.financing.construction;
  const R = a.financing.refinance;
  const setC = (patch: Partial<typeof C>) =>
    update((d) => ({ ...d, financing: { ...d.financing, construction: { ...d.financing.construction, ...patch } } }));
  const setR = (patch: Partial<typeof R>) =>
    update((d) => ({ ...d, financing: { ...d.financing, refinance: { ...d.financing.refinance, ...patch } } }));

  const balanceData = m.monthly
    .filter((r) => r.month <= m.sale.month)
    .map((r) => ({
      month: r.month,
      balance: Math.round(r.loanEndBalance + r.refiEndBalance),
      rate: Math.round(r.loanRate * 10000) / 100,
    }));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Construction Loan" subtitle={`${fmtMoney(m.financing.loanAmount)} · first draw month ${m.financing.firstDrawMonth} · total interest ${fmtMoney(m.financing.totalInterest)}`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Field label="LTC">
              <PctInput value={C.ltc} onChange={(v) => setC({ ltc: v })} step={0.5} />
            </Field>
            <Field label="Rate type">
              <Select value={C.rateType} onChange={(v) => setC({ rateType: v })} options={['Floating', 'Fixed'] as const} />
            </Field>
            <Field label="Index quote (30-day SOFR)" hint={C.rateType === 'Floating' && C.useForwardCurve ? 'Floating uses the forward curve' : undefined}>
              <PctInput value={C.indexRate} onChange={(v) => setC({ indexRate: v })} step={0.05} />
            </Field>
            <Field label="Spread">
              <PctInput value={C.spread} onChange={(v) => setC({ spread: v })} step={0.05} />
            </Field>
            <Field label="Initial term (months)">
              <NumberInput value={C.termMonths} onChange={(v) => setC({ termMonths: Math.round(v) })} min={1} />
            </Field>
            <Field label="Interest-only (months)">
              <NumberInput value={C.ioMonths} onChange={(v) => setC({ ioMonths: Math.round(v) })} min={0} />
            </Field>
            <Field label="Amortization (years)">
              <NumberInput value={C.amortYears} onChange={(v) => setC({ amortYears: Math.round(v) })} min={1} />
            </Field>
            <Field label="Origination fee">
              <PctInput value={C.originationFeePct} onChange={(v) => setC({ originationFeePct: v })} step={0.05} />
            </Field>
            <div className="flex items-end pb-1">
              <Toggle checked={C.useForwardCurve} onChange={(v) => setC({ useForwardCurve: v })} label="SOFR forward curve" />
            </div>
            <Field label="Extension 1 (months)">
              <NumberInput value={C.extension1Months} onChange={(v) => setC({ extension1Months: Math.round(v) })} min={0} />
            </Field>
            <Field label="Extension 1 fee">
              <PctInput value={C.extension1FeePct} onChange={(v) => setC({ extension1FeePct: v })} step={0.05} />
            </Field>
            <Field label="Extension 2 (months) / fee">
              <div className="flex gap-2">
                <NumberInput value={C.extension2Months} onChange={(v) => setC({ extension2Months: Math.round(v) })} min={0} />
                <PctInput value={C.extension2FeePct} onChange={(v) => setC({ extension2FeePct: v })} step={0.05} />
              </div>
            </Field>
          </div>
          <div className="mt-3">
            <Note>
              Extension fees are display-only and never touch cash flow — matching the source model,
              where only the origination fee ({fmtMoney(m.financing.originationFee)}) is live.
            </Note>
          </div>
        </Card>

        <Card title="Loan Balance & Rate">
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={balanceData} margin={{ left: 10, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => `M${v}`} />
                <YAxis yAxisId="bal" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} width={52} />
                <YAxis yAxisId="rate" orientation="right" tick={{ fontSize: 11 }} unit="%" domain={[0, 8]} width={40} />
                <Tooltip
                  formatter={(v, name) => (name === 'All-in rate' ? `${v}%` : fmtMoney(Number(v)))}
                  labelFormatter={(l) => `Month ${l}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area yAxisId="bal" type="monotone" dataKey="balance" stroke="#0f2a43" fill="#c9dbea" name="Loan balance" />
                <Line yAxisId="rate" type="monotone" dataKey="rate" stroke="#b45309" dot={false} strokeWidth={1.5} name="All-in rate" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <table className="mt-3 w-full">
            <tbody>
              {(
                [
                  ['Loan amount', fmtMoney(m.financing.loanAmount)],
                  ['Equity commitment', fmtMoney(m.financing.equityCommitment)],
                  ['Origination fee', fmtMoney(m.financing.originationFee)],
                  ['Capitalized construction interest', fmtMoney(m.financing.capitalizedInterest)],
                  ['Payoff month', `${m.financing.payoffMonth} (${m.financing.payoffMonth === m.sale.month ? 'sale' : 'maturity'})`],
                  ['Forward curve (first / last)', `${fmtPct(SOFR_FORWARD_CURVE[0])} / ${fmtPct(SOFR_FORWARD_CURVE[SOFR_FORWARD_CURVE.length - 1])}`],
                ] as [string, string][]
              ).map(([label, value]) => (
                <tr key={label} className="border-t border-slate-100">
                  <Td right={false} className="text-slate-600">{label}</Td>
                  <Td>{value}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Card
        title="Permanent / Refinance Loan"
        subtitle="Optional takeout — sized at MIN(LTV, DSCR, Debt Yield constraints) against forward-12 NOI"
      >
        <div className="mb-4">
          <Toggle checked={R.enabled} onChange={(v) => setR({ enabled: v })} label={R.enabled ? 'Refinance ON' : 'Refinance OFF'} />
        </div>
        <div className={R.enabled ? '' : 'pointer-events-none opacity-40'}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="Refinance month">
              <NumberInput value={R.refinanceMonth} onChange={(v) => setR({ refinanceMonth: Math.round(v) })} min={1} />
            </Field>
            <Field label="Index (7-yr UST)">
              <PctInput value={R.indexRate} onChange={(v) => setR({ indexRate: v })} step={0.05} />
            </Field>
            <Field label="Spread">
              <PctInput value={R.spread} onChange={(v) => setR({ spread: v })} step={0.05} />
            </Field>
            <Field label="Term (months)">
              <NumberInput value={R.termMonths} onChange={(v) => setR({ termMonths: Math.round(v) })} min={1} />
            </Field>
            <Field label="I/O (months)">
              <NumberInput value={R.ioMonths} onChange={(v) => setR({ ioMonths: Math.round(v) })} min={0} />
            </Field>
            <Field label="Amortization (years)">
              <NumberInput value={R.amortYears} onChange={(v) => setR({ amortYears: Math.round(v) })} min={1} />
            </Field>
            <Field label="Max LTV">
              <PctInput value={R.ltv} onChange={(v) => setR({ ltv: v })} />
            </Field>
            <Field label="Min DSCR (x)">
              <NumberInput value={R.dscr} onChange={(v) => setR({ dscr: v })} step={0.05} min={0} />
            </Field>
            <Field label="Min debt yield">
              <PctInput value={R.debtYield} onChange={(v) => setR({ debtYield: v })} />
            </Field>
            <Field label="Implied-value cap rate">
              <PctInput value={R.capRate} onChange={(v) => setR({ capRate: v })} step={0.25} />
            </Field>
          </div>
          {R.enabled && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr>
                    <Th right={false}>Sizing Test</Th>
                    <Th>Constraint</Th>
                    <Th right={false} className="pl-8">Result</Th>
                    <Th>Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <Td right={false}>Forward-12 NOI (from month {R.refinanceMonth + 1})</Td>
                    <Td><Money v={m.financing.refi.noiForTest} /></Td>
                    <Td right={false} className="pl-8">Implied value @ {fmtPct(R.capRate)}</Td>
                    <Td><Money v={m.financing.refi.impliedValue} /></Td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <Td right={false}>LTV {fmtPct(R.ltv, 0)}</Td>
                    <Td><Money v={m.financing.refi.ltvConstraint} /></Td>
                    <Td right={false} className="pl-8">DSCR {R.dscr.toFixed(2)}x</Td>
                    <Td><Money v={m.financing.refi.dscrConstraint} /></Td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <Td right={false}>Debt yield {fmtPct(R.debtYield, 1)}</Td>
                    <Td><Money v={m.financing.refi.debtYieldConstraint} /></Td>
                    <Td right={false} className="pl-8 font-semibold">Proceeds (governing)</Td>
                    <Td className="font-semibold"><Money v={m.financing.refi.proceeds} /></Td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <Td right={false}>Equity paydown / (cash-out)</Td>
                    <Td><Money v={m.financing.refi.equityPaydown} colored /></Td>
                    <Td right={false} className="pl-8" />
                    <Td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="mt-3">
          <Note>
            The source workbook&apos;s &ldquo;Refinance Timing&rdquo; dropdown was decorative — it displayed but did
            nothing. Here the refinance month is a single direct input, per the review brief.
          </Note>
        </div>
      </Card>
    </div>
  );
}
