'use client';

import { Card, Field, NumberInput, PctInput, Select, Th, Td, Money, Note } from '@/components/ui';
import { useForSale } from '@/store/useModelStore';
import { fmtDate, fmtMoney, fmtPct } from '@/lib/format';
import type { HardCostCurve } from '@/lib/forsale/types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const textCls = 'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm tabular-nums';

/** Schedule & Curve — Inputs §2 (land closing, predevelopment, construction) and §9 (custom hard-cost curve) plus the Draw Schedule. */
export function ForSaleCurve() {
  const { a, m, update } = useForSale();
  const S = a.schedule;
  const setS = (patch: Partial<typeof S>) => update((d) => ({ ...d, schedule: { ...d.schedule, ...patch } }));
  const setCurve = (i: number, v: number) =>
    update((d) => {
      const customCurve = [...d.schedule.customCurve];
      while (customCurve.length < 36) customCurve.push(0);
      customCurve[i] = v;
      return { ...d, schedule: { ...d.schedule, customCurve } };
    });
  const customTotal = S.customCurve.reduce((s, v) => s + v, 0);

  const chart = m.draw.filter((d) => d.month <= Math.min(120, m.schedule.sellout)).map((d) => ({
    month: `M${d.month}`,
    hard: Math.round(d.construction),
    soft: Math.round(d.predevelopment + d.straightLine + d.delivery + d.salesPeriod),
    land: Math.round(d.landUpFront),
    carry: Math.round(d.interest + d.taxes),
  }));

  return (
    <div className="space-y-5">
      <Card title="Development Schedule" subtitle={`Construction M${m.schedule.constructionStart}–M${m.schedule.constructionEnd} · model month 1 = ${fmtDate(m.schedule.modelStart)}`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Field label="Land closing date (YYYY-MM-DD)" hint="Month 0 — land, closing costs and up-front fees fund here">
            <input
              className={textCls}
              value={S.landClosingDate}
              onChange={(e) => setS({ landClosingDate: e.target.value })}
              onBlur={(e) => {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setS({ landClosingDate: '2025-12-31' });
              }}
            />
          </Field>
          <Field label="Predevelopment (months)" hint="0 = build immediately">
            <NumberInput value={S.predevMonths} onChange={(v) => setS({ predevMonths: Math.max(0, Math.round(v)) })} min={0} />
          </Field>
          <Field label="Construction duration (months)" hint="Notice to proceed through final CO">
            <NumberInput value={S.constructionMonths} onChange={(v) => setS({ constructionMonths: Math.max(1, Math.round(v)) })} min={1} />
          </Field>
          <Field label="Hard-cost spend curve" hint="S-Curve = smoothstep; Custom = the month-by-month % below">
            <Select value={S.hardCostCurve} onChange={(v: HardCostCurve) => setS({ hardCostCurve: v })} options={['Custom', 'S-Curve', 'Straight-Line'] as const} />
          </Field>
          <div className="text-xs text-slate-500">
            <div className="mb-1 font-medium text-slate-600">Deliveries & closings</div>
            First CO M{m.schedule.firstCo}, last CO M{m.schedule.lastDelivery}; first closing M{m.schedule.firstClosing}, sellout M{m.schedule.sellout}. Edit on Sales &amp; Delivery.
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Custom Hard-Cost Curve"
          subtitle={S.hardCostCurve === 'Custom' ? `% of hard costs by construction month · sums to ${fmtPct(customTotal, 1)}${Math.abs(customTotal - 1) > 0.0001 ? ' (normalized to 100%)' : ''}` : 'Not in use — curve is ' + S.hardCostCurve}
        >
          <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
            {Array.from({ length: Math.max(S.constructionMonths, 1) }, (_, i) => (
              <Field key={i} label={`Month ${i + 1}`}>
                <PctInput value={S.customCurve[i] ?? 0} onChange={(v) => setCurve(i, v)} step={1} />
              </Field>
            ))}
          </div>
          {S.customCurve.slice(S.constructionMonths).some((v) => v > 0) && (
            <div className="mt-3">
              <Note tone="warn">The custom curve carries percentages beyond the construction duration — those months are still spent. Keep the curve inside the duration.</Note>
            </div>
          )}
        </Card>

        <Card title="Monthly Draw" subtitle="Development spend by curve, through sellout">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ left: 10, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1e3).toFixed(0)}K`} width={52} />
                <Tooltip formatter={(v) => fmtMoney(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="land" stackId="a" fill="#94a3b8" name="Land & up-front" />
                <Bar dataKey="hard" stackId="a" fill="#0f2a43" name="Hard (curve)" />
                <Bar dataKey="soft" stackId="a" fill="#6b93b8" name="Soft, delivery & sales" />
                <Bar dataKey="carry" stackId="a" fill="#b45309" name="Interest & taxes (capitalized)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Draw Schedule" subtitle="Monthly development spend by spend curve">
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full min-w-[980px]">
            <thead className="sticky top-0 bg-white">
              <tr>
                <Th>Mo</Th>
                <Th>Period End</Th>
                <Th>Constr. %</Th>
                <Th>Land & Up-Front</Th>
                <Th>Predev.</Th>
                <Th>Hard (curve)</Th>
                <Th>Delivery</Th>
                <Th>Sales Period</Th>
                <Th>Straight-Line</Th>
                <Th>Interest</Th>
                <Th>RE Taxes</Th>
                <Th>Total</Th>
                <Th>Cumulative</Th>
                <Th>% Budget</Th>
              </tr>
            </thead>
            <tbody>
              {m.draw.filter((d) => d.month <= Math.min(120, m.schedule.sellout)).map((d) => (
                <tr key={d.month} className="border-t border-slate-100">
                  <Td>{d.month}</Td>
                  <Td className="text-slate-500">{fmtDate(d.date)}</Td>
                  <Td className="text-slate-500">{fmtPct(d.constructionPct, 1)}</Td>
                  <Td><Money v={d.landUpFront} /></Td>
                  <Td><Money v={d.predevelopment} /></Td>
                  <Td><Money v={d.construction} /></Td>
                  <Td><Money v={d.delivery} /></Td>
                  <Td><Money v={d.salesPeriod} /></Td>
                  <Td><Money v={d.straightLine} /></Td>
                  <Td><Money v={d.interest} /></Td>
                  <Td><Money v={d.taxes} /></Td>
                  <Td className="font-semibold"><Money v={d.total} /></Td>
                  <Td><Money v={d.cumulative} /></Td>
                  <Td className="text-slate-500">{fmtPct(d.pctOfBudget, 1)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
