'use client';

import { Card, Field, NumberInput, PctInput, Th, Td, Note } from '@/components/ui';
import { useModel, useModelStore } from '@/store/useModelStore';
import { fmtMoney, fmtNum } from '@/lib/format';

export default function UnitMixPage() {
  const a = useModelStore((s) => s.assumptions);
  const update = useModelStore((s) => s.update);
  const m = useModel();

  const setRow = (id: string, patch: Partial<(typeof a.unitMix)[number]>) =>
    update((d) => {
      d.unitMix = d.unitMix.map((r) => (r.id === id ? { ...r, ...patch } : r));
      return d;
    });

  const P = a.project;
  const setP = (patch: Partial<typeof P>) =>
    update((d) => ({ ...d, project: { ...d.project, ...patch } }));

  return (
    <div className="space-y-5">
      <Card
        title="Site & Timing"
        subtitle="Project name, city, state, and construction type are edited on the Projects tab."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Field label="Site acres">
            <NumberInput value={P.siteAcres} onChange={(v) => setP({ siteAcres: v })} step={0.01} min={0} />
          </Field>
          <Field label="Analysis start (YYYY-MM-01)">
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm tabular-nums"
              value={P.analysisStart}
              onChange={(e) => {
                const v = e.target.value;
                setP({ analysisStart: v });
              }}
              onBlur={(e) => {
                if (!/^\d{4}-\d{2}-01$/.test(e.target.value)) setP({ analysisStart: '2028-01-01' });
              }}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Unit Mix (Rents = Asking Today)"
        subtitle={`${fmtNum(m.totalUnits)} units · ${fmtNum(m.totalNrsf)} NRSF · avg asking rent ${fmtMoney(m.avgRent)}/mo`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <Th right={false}>Unit Type</Th>
                <Th right={false}>Code</Th>
                <Th>Count</Th>
                <Th>Avg SF</Th>
                <Th>Rent $/SF</Th>
                <Th>Rent / Mo</Th>
                <Th>Total / Mo</Th>
                <Th>Total / Yr</Th>
              </tr>
            </thead>
            <tbody>
              {a.unitMix.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <Td right={false}>
                    <input
                      className="w-24 rounded border border-slate-200 px-2 py-1 text-sm"
                      value={r.unitType}
                      onChange={(e) => setRow(r.id, { unitType: e.target.value })}
                    />
                  </Td>
                  <Td right={false} className="text-slate-500">{r.unitCode}</Td>
                  <Td><div className="w-20 ml-auto"><NumberInput value={r.count} onChange={(v) => setRow(r.id, { count: v })} min={0} /></div></Td>
                  <Td><div className="w-24 ml-auto"><NumberInput value={r.avgSf} onChange={(v) => setRow(r.id, { avgSf: v })} min={0} step={10} /></div></Td>
                  <Td><div className="w-24 ml-auto"><NumberInput value={r.rentPsf} onChange={(v) => setRow(r.id, { rentPsf: v })} min={0} step={0.05} /></div></Td>
                  <Td>{fmtMoney(r.avgSf * r.rentPsf)}</Td>
                  <Td>{fmtMoney(r.count * r.avgSf * r.rentPsf)}</Td>
                  <Td>{fmtMoney(r.count * r.avgSf * r.rentPsf * 12)}</Td>
                </tr>
              ))}
              <tr className="border-t border-slate-300 font-semibold">
                <Td right={false}>Total / Average</Td>
                <Td right={false} />
                <Td>{fmtNum(m.totalUnits)}</Td>
                <Td>{fmtNum(m.totalUnits ? m.totalNrsf / m.totalUnits : 0)}</Td>
                <Td />
                <Td>{fmtMoney(m.avgRent)}</Td>
                <Td>{fmtMoney(m.avgRent * m.totalUnits)}</Td>
                <Td>{fmtMoney(m.avgRent * m.totalUnits * 12)}</Td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Rent Growth Schedule" subtitle="Year-over-year growth, compounding off the prior year (year 1 = construction)">
        <div className="grid grid-cols-5 gap-3 md:grid-cols-10">
          {a.rentGrowth.map((g, i) => (
            <Field key={i} label={`Year ${i + 1}`}>
              <PctInput
                value={g}
                onChange={(v) =>
                  update((d) => {
                    d.rentGrowth = d.rentGrowth.map((x, j) => (j === i ? v : x));
                    return d;
                  })
                }
              />
            </Field>
          ))}
        </div>
        <div className="mt-4">
          <Note>
            Beyond year 10 the model continues compounding monthly at the year-9 rate, matching the
            source workbook&apos;s Monthly PF convention. General other-income growth is set on the
            Leasing page.
          </Note>
        </div>
      </Card>
    </div>
  );
}
