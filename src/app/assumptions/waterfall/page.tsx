'use client';

import { Card, Field, PctInput, Th, Td, Money, Note } from '@/components/ui';
import { useModel, useModelStore } from '@/store/useModelStore';
import { fmtMoney, fmtPct, fmtX } from '@/lib/format';

export default function WaterfallAssumptionsPage() {
  const a = useModelStore((s) => s.assumptions);
  const update = useModelStore((s) => s.update);
  const m = useModel();

  const W = a.waterfall;
  const setW = (patch: Partial<typeof W>) =>
    update((d) => ({ ...d, waterfall: { ...d.waterfall, ...patch } }));

  const wf = m.waterfall;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="JV Structure" subtitle={`LP ${fmtMoney(wf.lpEquity)} · GP ${fmtMoney(wf.gpEquity)}`}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="GP ownership %" hint="LP = 1 − GP">
              <PctInput value={W.gpOwnershipPct} onChange={(v) => setW({ gpOwnershipPct: v })} />
            </Field>
            <Field label="Preferred return (IRR)">
              <PctInput value={W.preferredReturn} onChange={(v) => setW({ preferredReturn: v })} />
            </Field>
            <Field label="Hurdle 1 IRR target">
              <PctInput value={W.hurdle1Rate} onChange={(v) => setW({ hurdle1Rate: v })} />
            </Field>
            <Field label="LP share at Hurdle 1">
              <PctInput value={W.lpShareHurdle1} onChange={(v) => setW({ lpShareHurdle1: v })} />
            </Field>
            <Field label="Hurdle 2 IRR target">
              <PctInput value={W.hurdle2Rate} onChange={(v) => setW({ hurdle2Rate: v })} />
            </Field>
            <Field label="LP share at Hurdle 2">
              <PctInput value={W.lpShareHurdle2} onChange={(v) => setW({ lpShareHurdle2: v })} />
            </Field>
            <Field label="LP share — final tier">
              <PctInput value={W.lpShareFinal} onChange={(v) => setW({ lpShareFinal: v })} />
            </Field>
          </div>
          <div className="mt-4">
            <Note>
              Hurdle 2 is independently editable here. The source workbook hard-linked it to Hurdle 1
              (collapsing the 4-tier template to 3 effective tiers); defaults are kept equal so results
              match, but you can now diverge them.
            </Note>
          </div>
        </Card>

        <Card title="Tier Structure">
          <table className="w-full">
            <thead>
              <tr>
                <Th right={false}>Tier</Th>
                <Th>IRR up to</Th>
                <Th>LP</Th>
                <Th>GP</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <Td right={false}>Preferred Return</Td>
                <Td>{fmtPct(W.preferredReturn, 1)}</Td>
                <Td>{fmtPct(1 - W.gpOwnershipPct, 0)}</Td>
                <Td>{fmtPct(W.gpOwnershipPct, 0)}</Td>
              </tr>
              <tr className="border-t border-slate-100">
                <Td right={false}>Hurdle 1</Td>
                <Td>{fmtPct(W.hurdle1Rate, 1)}</Td>
                <Td>{fmtPct(W.lpShareHurdle1, 0)}</Td>
                <Td>{fmtPct(1 - W.lpShareHurdle1, 0)}</Td>
              </tr>
              <tr className="border-t border-slate-100">
                <Td right={false}>Hurdle 2</Td>
                <Td>{fmtPct(W.hurdle2Rate, 1)}</Td>
                <Td>{fmtPct(W.lpShareHurdle2, 0)}</Td>
                <Td>{fmtPct(1 - W.lpShareHurdle2, 0)}</Td>
              </tr>
              <tr className="border-t border-slate-100">
                <Td right={false}>Final Split ({fmtPct(W.hurdle2Rate, 0)}+)</Td>
                <Td>∞</Td>
                <Td>{fmtPct(W.lpShareFinal, 0)}</Td>
                <Td>{fmtPct(1 - W.lpShareFinal, 0)}</Td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Distributions by Tier" subtitle="Lifetime totals across all periods">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr>
                <Th right={false}>Partner</Th>
                <Th>Preferred</Th>
                <Th>Hurdle 1</Th>
                <Th>Hurdle 2</Th>
                <Th>Final</Th>
                <Th>Total Net CF</Th>
                <Th>XIRR</Th>
                <Th>MOIC</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <Td right={false} className="font-medium">JV Partner (LP)</Td>
                <Td><Money v={wf.tierTotals.lp.pref} colored /></Td>
                <Td><Money v={wf.tierTotals.lp.hurdle1} colored /></Td>
                <Td><Money v={wf.tierTotals.lp.hurdle2} colored /></Td>
                <Td><Money v={wf.tierTotals.lp.final} colored /></Td>
                <Td className="font-semibold"><Money v={wf.lpNetCashFlow} colored /></Td>
                <Td>{fmtPct(wf.lpIrr)}</Td>
                <Td>{fmtX(wf.lpMoic)}</Td>
              </tr>
              <tr className="border-t border-slate-100">
                <Td right={false} className="font-medium">Sponsor (GP)</Td>
                <Td><Money v={wf.tierTotals.gp.pref} colored /></Td>
                <Td><Money v={wf.tierTotals.gp.hurdle1} colored /></Td>
                <Td><Money v={wf.tierTotals.gp.hurdle2} colored /></Td>
                <Td><Money v={wf.tierTotals.gp.final} colored /></Td>
                <Td className="font-semibold"><Money v={wf.gpNetCashFlow} colored /></Td>
                <Td>{fmtPct(wf.gpIrr)}</Td>
                <Td>{fmtX(wf.gpMoic)}</Td>
              </tr>
              <tr className="border-t border-slate-300 font-semibold">
                <Td right={false}>Project (blended)</Td>
                <Td><Money v={wf.tierTotals.lp.pref + wf.tierTotals.gp.pref} colored /></Td>
                <Td><Money v={wf.tierTotals.lp.hurdle1 + wf.tierTotals.gp.hurdle1} colored /></Td>
                <Td><Money v={wf.tierTotals.lp.hurdle2 + wf.tierTotals.gp.hurdle2} colored /></Td>
                <Td><Money v={wf.tierTotals.lp.final + wf.tierTotals.gp.final} colored /></Td>
                <Td><Money v={wf.lpNetCashFlow + wf.gpNetCashFlow} colored /></Td>
                <Td>{fmtPct(wf.projectIrr)}</Td>
                <Td>{fmtX(wf.projectMoic)}</Td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Distributions run through a month-by-month look-back: each tier pays pro-rata cash through
          while the partner&apos;s NPV at the tier&apos;s monthly-equivalent rate is underwater, pays a one-time
          catch-up in the month it crosses, then passes residual cash to the next tier.
        </p>
      </Card>
    </div>
  );
}
