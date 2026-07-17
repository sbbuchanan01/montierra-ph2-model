'use client';

import { Card, Field, NumberInput, Select, Note } from '@/components/ui';
import { useModel, useModelStore } from '@/store/useModelStore';
import { CURVE_NAMES, CURVE_TEMPLATES, type CurveName } from '@/lib/model/curves';
import { fmtDate, fmtMoney } from '@/lib/format';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

export default function CurvePage() {
  const a = useModelStore((s) => s.assumptions);
  const update = useModelStore((s) => s.update);
  const m = useModel();

  const selected = a.constructionCurve.selected;
  const curve = selected === 'Custom' ? a.constructionCurve.customCurve : [...CURVE_TEMPLATES[selected]];
  const total = curve.reduce((s, v) => s + v, 0);

  let cum = 0;
  const data = curve.map((pct, i) => {
    cum += pct;
    return { month: i + 1, pct: Math.round(pct * 100) / 100, cum: Math.round(cum * 10) / 10 };
  });

  const setCustom = (i: number, v: number) =>
    update((d) => {
      const arr = [...d.constructionCurve.customCurve];
      arr[i] = v;
      d.constructionCurve.customCurve = arr;
      return d;
    });

  return (
    <div className="space-y-5">
      <Card
        title="Construction Draw Curve"
        subtitle={`Applies to the General Construction Contract only (${fmtMoney(
          m.budget.rows.find((r) => r.code === '200202')?.amount ?? 0,
        )}). Construction runs months 1–${m.constructionEndMonth} (completion ${fmtDate(
          m.monthly[m.constructionEndMonth - 1]?.date ?? m.sale.date,
        )}).`}
      >
        <div className="mb-4 max-w-xs">
          <Field label="Curve template">
            <Select
              value={selected}
              onChange={(v: CurveName) =>
                update((d) => ({ ...d, constructionCurve: { ...d.constructionCurve, selected: v } }))
              }
              options={CURVE_NAMES}
            />
          </Field>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ left: 0, right: 10, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => `M${v}`} />
              <YAxis yAxisId="pct" tick={{ fontSize: 11 }} unit="%" width={40} />
              <YAxis yAxisId="cum" orientation="right" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} width={44} />
              <Tooltip formatter={(v) => `${v}%`} labelFormatter={(l) => `Construction month ${l}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="pct" dataKey="pct" fill="#3f6b94" name="Monthly draw %" radius={[3, 3, 0, 0]} />
              <Line yAxisId="cum" type="monotone" dataKey="cum" stroke="#0f2a43" strokeWidth={2} dot={{ r: 2 }} name="Cumulative %" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {Math.abs(total - 100) > 0.01 && (
          <div className="mt-3">
            <Note tone="warn">
              This curve sums to {total.toFixed(2)}% — draws are applied as %/100 of the GC contract,
              so a curve that doesn&apos;t total 100% under- or over-draws the contract.
            </Note>
          </div>
        )}
      </Card>

      {selected === 'Custom' && (
        <Card title="Custom Curve (monthly draw %)">
          <div className="grid grid-cols-4 gap-2 md:grid-cols-8 lg:grid-cols-10">
            {a.constructionCurve.customCurve.map((v, i) => (
              <Field key={i} label={`M${i + 1}`}>
                <NumberInput value={v} onChange={(x) => setCustom(i, x)} step={0.5} min={0} />
              </Field>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              onClick={() =>
                update((d) => {
                  d.constructionCurve.customCurve = [...d.constructionCurve.customCurve, 0];
                  return d;
                })
              }
            >
              + Add month
            </button>
            <button
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              onClick={() =>
                update((d) => {
                  d.constructionCurve.customCurve = d.constructionCurve.customCurve.slice(0, -1);
                  return d;
                })
              }
            >
              − Remove month
            </button>
          </div>
        </Card>
      )}

      <Card title="Monthly GC Draws ($)">
        <div className="h-56">
          <ResponsiveContainer>
            <ComposedChart
              data={m.monthly.filter((r) => r.month <= m.constructionEndMonth + 2).map((r) => ({
                month: r.month,
                gc: Math.round(m.budget.rows.find((b) => b.code === '200202')?.monthly[r.month - 1] ?? 0),
                total: Math.round(r.capex),
              }))}
              margin={{ left: 10, right: 10, top: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => `M${v}`} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={48} />
              <Tooltip formatter={(v) => fmtMoney(Number(v))} labelFormatter={(l) => `Month ${l}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="total" fill="#c9dbea" name="Total monthly capex" radius={[3, 3, 0, 0]} />
              <Bar dataKey="gc" fill="#0f2a43" name="GC contract draw" radius={[3, 3, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
