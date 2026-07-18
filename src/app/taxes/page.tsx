'use client';

import { Card, Field, NumberInput, PctInput, Th, Td, Money, Note } from '@/components/ui';
import { useModel, useModelStore } from '@/store/useModelStore';
import { fmtMoney, fmtPct } from '@/lib/format';

export default function TaxesPage() {
  const a = useModelStore((s) => s.assumptions);
  const update = useModelStore((s) => s.update);
  const m = useModel();

  const T = a.taxes;
  const setT = (patch: Partial<typeof T>) => update((d) => ({ ...d, taxes: { ...d.taxes, ...patch } }));
  const setJur = (id: string, millageRate: number) =>
    update((d) => {
      d.taxes.jurisdictions = d.taxes.jurisdictions.map((j) => (j.id === id ? { ...j, millageRate } : j));
      return d;
    });

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Taxing Jurisdictions" subtitle={`Effective rate ${fmtPct(m.effectiveTaxRate, 4)}`}>
          <table className="w-full">
            <thead>
              <tr>
                <Th right={false}>Jurisdiction</Th>
                <Th>Millage (per $100)</Th>
              </tr>
            </thead>
            <tbody>
              {T.jurisdictions.map((j) => (
                <tr key={j.id} className="border-t border-slate-100">
                  <Td right={false} className="text-slate-700">{j.name}</Td>
                  <Td>
                    <div className="ml-auto w-32">
                      <NumberInput value={j.millageRate} onChange={(v) => setJur(j.id, v)} step={0.01} min={0} />
                    </div>
                  </Td>
                </tr>
              ))}
              <tr className="border-t border-slate-300 font-semibold">
                <Td right={false}>Total</Td>
                <Td>{(m.effectiveTaxRate * 100).toFixed(6)}%</Td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="Construction assessment ratio">
              <PctInput value={T.assessmentRatio} onChange={(v) => setT({ assessmentRatio: v })} />
            </Field>
            <Field label="Stabilized base cap rate" hint="Loaded-cap assessment: value = NOI ÷ (cap + tax rate)">
              <PctInput value={T.mfBaseCapRate} onChange={(v) => setT({ mfBaseCapRate: v })} step={0.25} />
            </Field>
            <Field label="State income tax rate" hint="0% for Texas">
              <PctInput value={T.stateTaxRate} onChange={(v) => setT({ stateTaxRate: v })} />
            </Field>
            <Field label="Depreciable life (years)" hint="Model convention is 30; the standard US residential convention is 27.5">
              <NumberInput value={T.depreciationYears} onChange={(v) => setT({ depreciationYears: Math.max(1, Math.round(v)) })} min={1} />
            </Field>
            <Field label="DSCR test rate" hint="Debt constant used in the coverage test">
              <PctInput value={T.dscrTestRate} onChange={(v) => setT({ dscrTestRate: v })} step={0.25} />
            </Field>
          </div>
        </Card>

        <div className="space-y-5">
          <Card title="Methodology">
            <div className="space-y-2 text-sm leading-relaxed text-slate-600">
              <p>
                <span className="font-semibold text-slate-900">During construction:</span> taxable value =
                land value + {fmtPct(T.assessmentRatio, 0)} × cumulative accrued GC contract cost. Taxes are
                charged through the first stabilization year (a one-year assessment catch-up), then the
                stabilized method takes over.
              </p>
              <p>
                <span className="font-semibold text-slate-900">Once stabilized:</span> taxable value = NOI
                before tax ÷ ({fmtPct(T.mfBaseCapRate, 2)} + {fmtPct(m.effectiveTaxRate, 3)}) — the
                &ldquo;loaded cap rate&rdquo; self-consistent assessment convention — floored at the
                construction-method value.
              </p>
            </div>
          </Card>
          <Card title="Gain on Sale — stub">
            <Note tone="warn">
              Gain on sale is intentionally a $0 stub. In the source workbook this formula references a
              deleted Project Summary cell (silently $0 via IFERROR) and its surviving fragment sums the
              NOI row rather than a tax-basis row. Texas has no state income tax, so the real-world impact
              is zero. If this model is reused for a state with income tax, complete the sale-price /
              adjusted-basis inputs before relying on the state tax line.
            </Note>
          </Card>
        </div>
      </div>

      <Card title="Property Tax Schedule" subtitle="Annual, by analysis year">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px]">
            <thead>
              <tr>
                <Th right={false}>Year</Th>
                <Th>Op Yr</Th>
                <Th>Improvements Accrued</Th>
                <Th>Construction TV</Th>
                <Th>Interim Taxes Due</Th>
                <Th>NOI Before Tax</Th>
                <Th>Income-Approach TV</Th>
                <Th>Stabilized TV</Th>
                <Th>Stabilized Taxes</Th>
              </tr>
            </thead>
            <tbody>
              {m.taxes.map((t) => (
                <tr key={t.analysisYear} className="border-t border-slate-100">
                  <Td right={false}>Year {t.analysisYear}</Td>
                  <Td>{t.operationYear}</Td>
                  <Td><Money v={t.improvementsAccrued} /></Td>
                  <Td><Money v={t.taxableValueConstruction} /></Td>
                  <Td><Money v={t.taxesDueDuringConstruction} colored /></Td>
                  <Td><Money v={t.noiBeforeTax} /></Td>
                  <Td><Money v={t.incomeApproachValue} /></Td>
                  <Td><Money v={t.stabilizedTaxableValue} /></Td>
                  <Td><Money v={t.stabilizedTaxesDue} colored /></Td>
                </tr>
              ))}
              <tr className="border-t border-slate-300 font-semibold">
                <Td right={false}>Total</Td>
                <Td />
                <Td />
                <Td />
                <Td><Money v={m.taxes.reduce((s, t) => s + t.taxesDueDuringConstruction, 0)} colored /></Td>
                <Td />
                <Td />
                <Td />
                <Td><Money v={m.taxes.reduce((s, t) => s + t.stabilizedTaxesDue, 0)} colored /></Td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Income Tax Build (inert for TX)" subtitle={`State rate ${fmtPct(T.stateTaxRate, 2)} — the schedule is computed but produces $0 of tax`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <Th right={false}>Year</Th>
                <Th>NOI</Th>
                <Th>Interest Expense</Th>
                <Th>Depreciation ({T.depreciationYears}-yr SL)</Th>
                <Th>Taxable Income</Th>
                <Th>State Tax Due</Th>
              </tr>
            </thead>
            <tbody>
              {m.taxes.map((t) => (
                <tr key={t.analysisYear} className="border-t border-slate-100">
                  <Td right={false}>Year {t.analysisYear}</Td>
                  <Td><Money v={t.taxableNoi} /></Td>
                  <Td><Money v={-t.interestExpense} colored /></Td>
                  <Td><Money v={t.depreciation} colored /></Td>
                  <Td><Money v={t.taxableIncome} /></Td>
                  <Td>{fmtMoney(t.stateTaxDue)}</Td>
                </tr>
              ))}
              <tr className="border-t border-slate-300 font-semibold">
                <Td right={false}>Total</Td>
                <Td><Money v={m.taxes.reduce((s, t) => s + t.taxableNoi, 0)} /></Td>
                <Td><Money v={-m.taxes.reduce((s, t) => s + t.interestExpense, 0)} colored /></Td>
                <Td><Money v={m.taxes.reduce((s, t) => s + t.depreciation, 0)} colored /></Td>
                <Td><Money v={m.taxes.reduce((s, t) => s + t.taxableIncome, 0)} /></Td>
                <Td>{fmtMoney(m.taxes.reduce((s, t) => s + t.stateTaxDue, 0))}</Td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
