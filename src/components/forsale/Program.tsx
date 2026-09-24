'use client';

import { Card, Field, NumberInput, PctInput, Select, Th, Td, Note } from '@/components/ui';
import { useForSale } from '@/store/useModelStore';
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format';
import type { ForSalePlan, PricingMethod } from '@/lib/forsale/types';

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

const textCls = 'w-full rounded border border-slate-200 px-2 py-1 text-sm text-slate-800 focus:border-slate-400 focus:outline-none';

/** Program & Pricing — the workbook's Unit Mix tab plus Inputs §1, §3 and §4. */
export function ForSaleProgram() {
  const { a, m, update } = useForSale();
  const P = a.project;
  const setP = (patch: Partial<typeof P>) => update((d) => ({ ...d, project: { ...d.project, ...patch } }));
  const setPlan = (id: string, patch: Partial<ForSalePlan>) =>
    update((d) => ({ ...d, plans: d.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const addPlan = () =>
    update((d) => ({
      ...d,
      plans: [...d.plans, { id: uid(), code: `P${d.plans.length + 1}`, description: 'New plan', beds: 2, baths: 2, count: 0, avgSf: 0, basePsf: 0 }],
    }));
  const deletePlan = (id: string) => update((d) => ({ ...d, plans: d.plans.filter((p) => p.id !== id) }));
  const R = a.pricing;
  const setR = (patch: Partial<typeof R>) => update((d) => ({ ...d, pricing: { ...d.pricing, ...patch } }));
  const setGrowth = (key: 'price' | 'carry' | 'tax' | 'sofr', year: number, v: number) =>
    update((d) => {
      const arr = [...d.growth[key]];
      arr[year - 1] = v;
      return { ...d, growth: { ...d.growth, [key]: arr } };
    });

  return (
    <div className="space-y-5">
      <Card title="Project & Site" subtitle="Deal name, city, state and construction type are edited on the deal dashboard.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <div className="col-span-2">
            <Field label="Product type" hint="Attached TH / detached cottage / condo — labels the model">
              <input className={textCls} value={P.productType} onChange={(e) => setP({ productType: e.target.value })} />
            </Field>
          </div>
          <Field label="Site area (acres)">
            <NumberInput value={P.siteAcres} onChange={(v) => setP({ siteAcres: v })} step={0.01} min={0} />
          </Field>
          <Field label="Parking spaces" hint="Basis for a $/space hard-cost line">
            <NumberInput value={P.parkingSpaces} onChange={(v) => setP({ parkingSpaces: Math.round(v) })} min={0} />
          </Field>
          <Field label="Net-to-gross efficiency" hint="Saleable SF ÷ gross building SF">
            <PctInput value={P.netToGross} onChange={(v) => setP({ netToGross: v })} step={1} />
          </Field>
          <div className="text-xs text-slate-500">
            <div className="mb-1 font-medium text-slate-600">Derived</div>
            {fmtNum(m.units)} homes · {fmtNum(m.nsf)} net SF · {fmtNum(m.gsf)} gross SF
            <br />
            {fmtNum(m.density, 1)} homes / acre · {fmtNum(m.parkingRatio, 2)} spaces / home
          </div>
        </div>
      </Card>

      <Card
        title="Unit Mix — Floor Plans, Size & Base Sale Price"
        subtitle={`${fmtNum(m.units)} homes · ${fmtNum(m.nsf)} SF · wtd. avg. ${fmtMoney(m.waPrice)} / home (${fmtMoney(m.waPsf, 2)}/SF) · gross sellout today ${fmtMoney(m.grossSelloutToday)}`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr>
                <Th right={false}>Plan</Th>
                <Th right={false}>Description</Th>
                <Th>Beds</Th>
                <Th>Baths</Th>
                <Th>Homes</Th>
                <Th>% Mix</Th>
                <Th>Avg SF</Th>
                <Th>Base $/SF</Th>
                <Th>Base Price</Th>
                <Th>Gross Sellout</Th>
                <Th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {a.plans.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <Td right={false}><input className="w-16 rounded border border-slate-200 px-2 py-1 text-sm" value={p.code} onChange={(e) => setPlan(p.id, { code: e.target.value })} /></Td>
                  <Td right={false}><input className="w-40 rounded border border-slate-200 px-2 py-1 text-sm" value={p.description} onChange={(e) => setPlan(p.id, { description: e.target.value })} /></Td>
                  <Td><div className="ml-auto w-14"><NumberInput value={p.beds} onChange={(v) => setPlan(p.id, { beds: v })} min={0} /></div></Td>
                  <Td><div className="ml-auto w-14"><NumberInput value={p.baths} onChange={(v) => setPlan(p.id, { baths: v })} min={0} step={0.5} /></div></Td>
                  <Td><div className="ml-auto w-16"><NumberInput value={p.count} onChange={(v) => setPlan(p.id, { count: Math.max(0, Math.round(v)) })} min={0} /></div></Td>
                  <Td className="text-slate-500">{fmtPct(m.units ? p.count / m.units : 0, 1)}</Td>
                  <Td><div className="ml-auto w-20"><NumberInput value={p.avgSf} onChange={(v) => setPlan(p.id, { avgSf: v })} min={0} step={10} /></div></Td>
                  <Td><div className="ml-auto w-20"><NumberInput value={p.basePsf} onChange={(v) => setPlan(p.id, { basePsf: v })} min={0} step={1} /></div></Td>
                  <Td>{fmtMoney(p.avgSf * p.basePsf)}</Td>
                  <Td>{fmtMoney(p.count * p.avgSf * p.basePsf)}</Td>
                  <Td>
                    <button className="text-slate-300 hover:text-red-600" title="Delete plan" onClick={() => (p.count === 0 || confirm(`Delete plan ${p.code}?`)) && deletePlan(p.id)}>
                      ✕
                    </button>
                  </Td>
                </tr>
              ))}
              <tr className="border-t border-slate-300 font-semibold">
                <Td right={false} colSpan={4}>Total / Wtd. Avg.</Td>
                <Td>{fmtNum(m.units)}</Td>
                <Td>100%</Td>
                <Td>{fmtNum(m.avgSf)}</Td>
                <Td>${m.waPsf.toFixed(2)}</Td>
                <Td>{fmtMoney(m.waPrice)}</Td>
                <Td>{fmtMoney(m.grossSelloutToday)}</Td>
                <Td />
              </tr>
            </tbody>
          </table>
        </div>
        <button className="mt-3 rounded-lg border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700" onClick={addPlan}>
          ＋ Add floor plan
        </button>
        <div className="mt-3">
          <Note>
            Prices are today&rsquo;s asking prices at month 1 and step up by the Sales Price Growth below in the model year each home
            closes. Homes deliver and close in the order of these rows.
          </Note>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Sales Pricing & Closing Deductions" subtitle={`Total closing deductions ${fmtPct(m.totalDeductionsPct, 1)} of gross price`}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="col-span-2 md:col-span-3">
              <Field label="Pricing method" hint="Blended Average = every closing at the unit-weighted average price (the mix sells pro rata). By Floor Plan = each home at its own plan price, in unit order">
                <Select value={R.method} onChange={(v: PricingMethod) => setR({ method: v })} options={['Blended Average', 'By Floor Plan'] as const} />
              </Field>
            </div>
            <Field label="Sales commissions"><PctInput value={R.commissionsPct} onChange={(v) => setR({ commissionsPct: v })} step={0.25} /></Field>
            <Field label="Litigation / defect allowance" hint="Deducted at each closing, not released"><PctInput value={R.litigationPct} onChange={(v) => setR({ litigationPct: v })} step={0.25} /></Field>
            <Field label="Operational escrow / HOA capitalization"><PctInput value={R.escrowPct} onChange={(v) => setR({ escrowPct: v })} step={0.25} /></Field>
            <Field label="Seller closing costs & title"><PctInput value={R.sellerClosingPct} onChange={(v) => setR({ sellerClosingPct: v })} step={0.25} /></Field>
            <Field label="Buyer incentives / concessions"><PctInput value={R.incentivesPct} onChange={(v) => setR({ incentivesPct: v })} step={0.25} /></Field>
            <Field label="Warranty / defect reserve" hint="Held back below the net sellout line"><PctInput value={R.warrantyPct} onChange={(v) => setR({ warrantyPct: v })} step={0.1} /></Field>
          </div>
        </Card>

        <Card title="Annual Assumptions by Model Year" subtitle="Cumulative indices step up each model year; prices step up by the year of the CLOSING">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <Th right={false}>Assumption</Th>
                  {Array.from({ length: 10 }, (_, i) => <Th key={i}>Y{i + 1}</Th>)}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['price', 'Sales price growth'],
                    ['carry', 'Carry cost growth'],
                    ['tax', 'RE tax growth (after completion)'],
                    ['sofr', 'Index rate — SOFR'],
                  ] as const
                ).map(([key, label]) => (
                  <tr key={key} className="border-t border-slate-100">
                    <Td right={false} className="text-slate-700">{label}</Td>
                    {Array.from({ length: 10 }, (_, i) => (
                      <Td key={i}>
                        {key !== 'sofr' && i === 0 ? (
                          <span className="text-xs text-slate-400">n/a</span>
                        ) : (
                          <div className="ml-auto w-[4.5rem]">
                            <PctInput value={a.growth[key][i] ?? 0} onChange={(v) => setGrowth(key, i + 1, v)} step={0.25} />
                          </div>
                        )}
                      </Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
