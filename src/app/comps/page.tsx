'use client';

import { Card, Th, Td, Note } from '@/components/ui';
import { useModel } from '@/store/useModelStore';
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format';
import { CLASS_A_COMPS, RENT_COMPS, SUBJECT_COMP, TAX_COMPS, type RentComp } from '@/lib/model/comps';

function CompTable({ comps }: { comps: RentComp[] }) {
  const totUnits = comps.reduce((s, c) => s + c.units, 0);
  const wAvg = (f: (c: RentComp) => number) => comps.reduce((s, c) => s + f(c) * c.units, 0) / totUnits;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead>
          <tr>
            <Th right={false}>#</Th>
            <Th right={false}>Property</Th>
            <Th right={false}>Address</Th>
            <Th>Vintage</Th>
            <Th>Units</Th>
            <Th>Avg SF</Th>
            <Th>Eff. Rent</Th>
            <Th>Eff. $/SF</Th>
            <Th>Occ</Th>
            <Th>Distance</Th>
          </tr>
        </thead>
        <tbody>
          {comps.map((c) => (
            <tr key={c.name} className="border-t border-slate-100">
              <Td right={false} className="text-slate-400">{c.map}</Td>
              <Td right={false} className="font-medium text-slate-800">{c.name}</Td>
              <Td right={false} className="text-slate-500">{c.address}</Td>
              <Td>{c.vintage}</Td>
              <Td>{c.units}</Td>
              <Td>{fmtNum(c.avgSf)}</Td>
              <Td>{fmtMoney(c.effRent)}</Td>
              <Td>${(c.effRent / c.avgSf).toFixed(2)}</Td>
              <Td>{fmtPct(c.occ, 1)}</Td>
              <Td>{typeof c.distanceMi === 'number' ? `${c.distanceMi} mi` : c.distanceMi}</Td>
            </tr>
          ))}
          <tr className="border-t border-slate-300 font-semibold">
            <Td right={false} />
            <Td right={false}>Total / Wtd. Average</Td>
            <Td right={false} />
            <Td />
            <Td>{totUnits}</Td>
            <Td>{fmtNum(wAvg((c) => c.avgSf))}</Td>
            <Td>{fmtMoney(wAvg((c) => c.effRent))}</Td>
            <Td>${(wAvg((c) => c.effRent) / wAvg((c) => c.avgSf)).toFixed(2)}</Td>
            <Td>{fmtPct(wAvg((c) => c.occ), 1)}</Td>
            <Td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function CompsPage() {
  const m = useModel();
  const compAvgPsf =
    RENT_COMPS.reduce((s, c) => s + (c.effRent / c.avgSf) * c.units, 0) /
    RENT_COMPS.reduce((s, c) => s + c.units, 0);
  const subjectPsf = m.totalUnits > 0 ? m.avgRent / (m.totalNrsf / m.totalUnits) : 0;

  return (
    <div className="space-y-5">
      <Note>
        Rent and tax comps are reference tables only — nothing in the calculation engine depends on
        them (verified against the source workbook).
      </Note>

      <Card
        title="Rent Comps — Competitive Set"
        subtitle={`Subject: ${SUBJECT_COMP.name}, ${SUBJECT_COMP.address} · ${SUBJECT_COMP.units} units @ ${SUBJECT_COMP.avgSf} SF`}
      >
        <CompTable comps={RENT_COMPS} />
        <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm">
          Subject asking rent <span className="font-semibold">${subjectPsf.toFixed(2)}/SF</span> vs. comp
          set weighted average <span className="font-semibold">${compAvgPsf.toFixed(2)}/SF</span> —{' '}
          <span className={subjectPsf > compAvgPsf ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>
            {fmtPct(subjectPsf / compAvgPsf - 1, 1)} {subjectPsf > compAvgPsf ? 'premium' : 'discount'}
          </span>
        </div>
      </Card>

      <Card title="Rent Comps — Class A Set">
        <CompTable comps={CLASS_A_COMPS} />
      </Card>

      <Card
        title="Tax Comps"
        subtitle="Placeholder template values from the source workbook — replace with county records when available"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <Th right={false}>Existing Comp</Th>
                <Th>Units</Th>
                <Th>Avg Unit SF</Th>
                <Th>Assessed Value</Th>
                <Th>AV / Unit</Th>
                <Th>Tax Expense @ {fmtPct(m.effectiveTaxRate, 3)}</Th>
                <Th>Expense / Unit</Th>
              </tr>
            </thead>
            <tbody>
              {TAX_COMPS.map((c) => {
                const tax = c.assessedValue * m.effectiveTaxRate;
                return (
                  <tr key={c.name} className="border-t border-slate-100">
                    <Td right={false} className="text-slate-700">{c.name}</Td>
                    <Td>{c.units}</Td>
                    <Td>{fmtNum(c.avgSf)}</Td>
                    <Td>{fmtMoney(c.assessedValue)}</Td>
                    <Td>{fmtMoney(c.assessedValue / c.units)}</Td>
                    <Td>{fmtMoney(tax)}</Td>
                    <Td>{fmtMoney(tax / c.units)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
