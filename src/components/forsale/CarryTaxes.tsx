'use client';

import { Card, Field, NumberInput, PctInput, Th, Td, Money, Note } from '@/components/ui';
import { useForSale } from '@/store/useModelStore';
import { fmtMoney, fmtPct } from '@/lib/format';
import type { CarryBasis, CarryItem } from '@/lib/forsale/types';

const BASIS_LABEL: Record<CarryBasis, string> = { psfMo: '$/SF/month', perUnitYr: '$/home/year', perMonthProject: '$/month (project)' };
const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

/** Carry on unsold inventory (Inputs §5) and real estate taxes (Inputs §6 + the Taxes tab). */
export function ForSaleCarryTaxes() {
  const { a, m, update } = useForSale();
  const setItem = (id: string, patch: Partial<CarryItem>) =>
    update((d) => ({ ...d, carry: d.carry.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const addItem = () => update((d) => ({ ...d, carry: [...d.carry, { id: uid(), label: 'New carry item', input: 0, basis: 'perUnitYr' }] }));
  const deleteItem = (id: string) => update((d) => ({ ...d, carry: d.carry.filter((c) => c.id !== id) }));
  const T = a.taxes;
  const setT = (patch: Partial<typeof T>) => update((d) => ({ ...d, taxes: { ...d.taxes, ...patch } }));
  const setJ = (id: string, patch: { ratePer100?: number; assessmentPct?: number }) =>
    update((d) => ({ ...d, taxes: { ...d.taxes, jurisdictions: d.taxes.jurisdictions.map((j) => (j.id === id ? { ...j, ...patch } : j)) } }));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Carry on Unsold Inventory" subtitle={`${fmtMoney(m.carry.perUnitYr)} / home / year · ${fmtMoney(m.carry.perUnitMo)} / home / month · ${fmtMoney(m.carry.annual)} / year at 100% unsold`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <Th right={false}>Item</Th>
                  <Th>Input</Th>
                  <Th right={false}>Basis</Th>
                  <Th>$/Home/Yr</Th>
                  <Th>$/Home/Mo</Th>
                  <Th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {a.carry.map((c, i) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <Td right={false}>
                      <input className="w-56 rounded border border-transparent px-1.5 py-1 text-sm text-slate-800 hover:border-slate-200 focus:border-slate-400 focus:outline-none" value={c.label} onChange={(e) => setItem(c.id, { label: e.target.value })} title={c.notes} />
                    </Td>
                    <Td><div className="ml-auto w-24"><NumberInput value={c.input} onChange={(v) => setItem(c.id, { input: v })} min={0} step={c.basis === 'psfMo' ? 0.05 : 25} /></div></Td>
                    <Td right={false}>
                      <select className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700" value={c.basis} onChange={(e) => setItem(c.id, { basis: e.target.value as CarryBasis })}>
                        {(Object.keys(BASIS_LABEL) as CarryBasis[]).map((b) => <option key={b} value={b}>{BASIS_LABEL[b]}</option>)}
                      </select>
                    </Td>
                    <Td>{fmtMoney(m.carry.items[i]?.perUnitYr ?? 0)}</Td>
                    <Td>{fmtMoney(m.carry.items[i]?.perUnitMo ?? 0)}</Td>
                    <Td><button className="text-slate-300 hover:text-red-600" onClick={() => deleteItem(c.id)} title="Delete">✕</button></Td>
                  </tr>
                ))}
                <tr className="border-t border-slate-300 font-semibold">
                  <Td right={false} colSpan={3}>Total direct carry</Td>
                  <Td>{fmtMoney(m.carry.perUnitYr)}</Td>
                  <Td>{fmtMoney(m.carry.perUnitMo)}</Td>
                  <Td />
                </tr>
              </tbody>
            </table>
          </div>
          <button className="mt-3 rounded-lg border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700" onClick={addItem}>
            ＋ Add carry item
          </button>
          <div className="mt-3">
            <Note>
              Carry runs on homes delivered before the month that are still unsold at month end, grown by the carry-cost index.
              Real estate taxes on unsold homes come from the tax schedule below.
            </Note>
          </div>
        </Card>

        <Card title="Real Estate Taxes" subtitle={`Combined rate ${fmtPct(m.taxes.combinedRate, 4)} of assessed value`}>
          <table className="w-full">
            <thead>
              <tr>
                <Th right={false}>Jurisdiction</Th>
                <Th>Rate per $100</Th>
                <Th>Assessment %</Th>
                <Th>Effective</Th>
              </tr>
            </thead>
            <tbody>
              {T.jurisdictions.map((j) => (
                <tr key={j.id} className="border-t border-slate-100">
                  <Td right={false} className="text-slate-700">{j.name}</Td>
                  <Td><div className="ml-auto w-28"><NumberInput value={j.ratePer100} onChange={(v) => setJ(j.id, { ratePer100: v })} step={0.01} min={0} /></div></Td>
                  <Td><div className="ml-auto w-24"><PctInput value={j.assessmentPct} onChange={(v) => setJ(j.id, { assessmentPct: v })} step={5} /></div></Td>
                  <Td className="text-slate-500">{fmtPct((j.ratePer100 / 100) * j.assessmentPct, 4)}</Td>
                </tr>
              ))}
              <tr className="border-t border-slate-300 font-semibold">
                <Td right={false} colSpan={3}>Combined</Td>
                <Td>{fmtPct(m.taxes.combinedRate, 4)}</Td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="Land assessed value" hint="Assessed at 100% every year">
              <NumberInput value={T.landAssessedValue} onChange={(v) => setT({ landAssessedValue: v })} min={0} step={5000} />
            </Field>
            <Field label="Improvements assessed — % of hard costs spent to date">
              <PctInput value={T.improvementsPctOfHard} onChange={(v) => setT({ improvementsPctOfHard: v })} step={5} />
            </Field>
          </div>
          <div className="mt-3">
            <Note>
              Model year 1 is capitalized into the budget; months after year 1 but before the first closing are not charged;
              from the first closing the tax runs pro rata on homes not yet closed, and the sold homes&rsquo; share passes to buyers.
            </Note>
          </div>
        </Card>
      </div>

      <Card title="Tax Schedule by Model Year" subtitle={`Total ${fmtMoney(m.taxes.totalTax)} · capitalized ${fmtMoney(m.taxes.capitalized)} · not charged ${fmtMoney(m.taxes.notCharged)} · carried ${fmtMoney(m.taxes.carried)} · buyers ${fmtMoney(m.taxes.buyers)}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                <Th right={false}>Year</Th>
                <Th>Hard Spent</Th>
                <Th>Cum. Hard</Th>
                <Th>Assessed Improvements</Th>
                <Th>Land</Th>
                <Th>Assessed Value</Th>
                <Th>Index</Th>
                <Th>Annual Tax</Th>
                <Th>Capitalized</Th>
                <Th>Not Charged</Th>
                <Th>Carried</Th>
                <Th>Buyers</Th>
              </tr>
            </thead>
            <tbody>
              {m.taxes.years.map((y) => (
                <tr key={y.year} className="border-t border-slate-100">
                  <Td right={false}>Year {y.year}</Td>
                  <Td><Money v={y.hardSpent} /></Td>
                  <Td><Money v={y.cumHard} /></Td>
                  <Td><Money v={y.assessedImprovements} /></Td>
                  <Td><Money v={y.land} /></Td>
                  <Td><Money v={y.assessedValue} /></Td>
                  <Td>{y.index.toFixed(3)}</Td>
                  <Td className="font-semibold"><Money v={y.annualTax} /></Td>
                  <Td><Money v={y.capitalized} /></Td>
                  <Td className="text-slate-500"><Money v={y.notCharged} /></Td>
                  <Td><Money v={y.carried} /></Td>
                  <Td className="text-slate-500"><Money v={y.buyers} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
