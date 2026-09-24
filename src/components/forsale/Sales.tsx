'use client';

import { Card, Field, NumberInput, Th, Td, Note } from '@/components/ui';
import { useForSale } from '@/store/useModelStore';
import { fmtDate, fmtMoney, fmtNum } from '@/lib/format';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

/** Sales & Delivery — Inputs §2 (delivery / closing pace) and the Unit Schedule tab. */
export function ForSaleSales() {
  const { a, m, update } = useForSale();
  const S = a.schedule;
  const setS = (patch: Partial<typeof S>) => update((d) => ({ ...d, schedule: { ...d.schedule, ...patch } }));
  const int = (v: number, min = 0) => Math.max(min, Math.round(v));
  const dateOf = (month: number) => m.monthly[month]?.date;

  const chart = m.monthly
    .filter((r) => r.month >= Math.max(0, m.schedule.firstCo - 2) && r.month <= m.schedule.sellout + 2)
    .map((r) => ({ month: `M${r.month}`, delivered: r.deliveredCum, closed: r.closedCum, carried: r.unsoldCarried }));

  return (
    <div className="space-y-5">
      <Card title="Delivery & Closing Pace" subtitle={`First CO M${m.schedule.firstCo} · last CO M${m.schedule.lastDelivery} · first closing M${m.schedule.firstClosing} · sellout M${m.schedule.sellout} (${m.schedule.selloutDate ? fmtDate(m.schedule.selloutDate) : '—'})`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Field label="First delivery / CO (month #)" hint="First month a home can close">
            <NumberInput value={S.firstCoMonth} onChange={(v) => setS({ firstCoMonth: int(v, 1) })} min={1} />
          </Field>
          <Field label="Delivery pace (homes / month)" hint="Set to the total when the whole community delivers at once">
            <NumberInput value={S.deliveryPace} onChange={(v) => setS({ deliveryPace: Math.max(0, v) })} min={0} />
          </Field>
          <Field label="First closing (month #)" hint="A home never closes before it is delivered">
            <NumberInput value={S.firstClosingMonth} onChange={(v) => setS({ firstClosingMonth: int(v, 1) })} min={1} />
          </Field>
          <Field label="Homes closed in the first month" hint="Pre-sales under contract at CO">
            <NumberInput value={S.firstClosingUnits} onChange={(v) => setS({ firstClosingUnits: int(v) })} min={0} />
          </Field>
          <Field label="Closing pace thereafter (homes / month)" hint="0.5 = one closing every two months">
            <NumberInput value={S.closingPace} onChange={(v) => setS({ closingPace: Math.max(0, v) })} min={0} step={0.25} />
          </Field>
        </div>
        <div className="mt-3">
          <Note>
            Construction start, duration and the hard-cost curve live on the Schedule &amp; Curve tab. Carry runs on homes delivered
            before the month that are still unsold at month end — the month a home closes it carries nothing.
          </Note>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Deliveries, Closings & Homes Carried">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ left: 0, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} width={32} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="delivered" fill="#9dbcd6" name="Delivered (cum.)" />
                <Bar dataKey="closed" fill="#0f2a43" name="Closed (cum.)" />
                <Bar dataKey="carried" fill="#dc2626" name="Carried (unsold)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Unit Schedule" subtitle="Every home dated in model months — delivery, scheduled and actual closing, price at closing">
          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-[640px]">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <Th>#</Th>
                  <Th right={false}>Plan</Th>
                  <Th>SF</Th>
                  <Th>Price Used (today)</Th>
                  <Th>CO Mo</Th>
                  <Th>Sched. Mo</Th>
                  <Th>Closing Mo</Th>
                  <Th>Closing</Th>
                  <Th>Gross Price</Th>
                </tr>
              </thead>
              <tbody>
                {m.unitSchedule.map((u) => (
                  <tr key={u.unit} className="border-t border-slate-100">
                    <Td>{u.unit}</Td>
                    <Td right={false}>{u.plan}</Td>
                    <Td>{fmtNum(u.sf)}</Td>
                    <Td>{fmtMoney(u.priceUsed)}</Td>
                    <Td>{u.deliveryMonth}</Td>
                    <Td>{u.scheduledMonth}</Td>
                    <Td className="font-semibold">{u.closingMonth}</Td>
                    <Td className="text-slate-500">{u.closingMonth <= 120 && dateOf(u.closingMonth) ? fmtDate(dateOf(u.closingMonth)!) : 'after grid'}</Td>
                    <Td>{fmtMoney(u.grossPrice)}</Td>
                  </tr>
                ))}
                <tr className="border-t border-slate-300 font-semibold">
                  <Td right={false} colSpan={3}>Total</Td>
                  <Td>{fmtMoney(m.unitSchedule.reduce((s, u) => s + u.priceUsed, 0))}</Td>
                  <Td colSpan={4} />
                  <Td>{fmtMoney(m.margin.trended.gross)}</Td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
