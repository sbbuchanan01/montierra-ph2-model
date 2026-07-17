'use client';

import { Fragment, useMemo, useState } from 'react';
import { Card, NumberInput, PctInput, Th, Td, Money, Note, Field } from '@/components/ui';
import { useModel, useModelStore } from '@/store/useModelStore';
import { categoryForCode, DD_PREDEV_BUDGET } from '@/lib/model/costData';
import { fmtMoney } from '@/lib/format';

const CATEGORY_ORDER = [
  'Land',
  'Hard Costs',
  'Soft Costs - Consultants',
  'Soft Costs - Marketing & Leasing',
  'Soft Costs - Municipal',
  'Soft Costs - Financing',
  'Soft Costs - Operating',
  'Soft Costs - G&A',
];

export default function CostsPage() {
  const a = useModelStore((s) => s.assumptions);
  const update = useModelStore((s) => s.update);
  const m = useModel();
  const [open, setOpen] = useState<Record<string, boolean>>({ Land: true, 'Hard Costs': true });

  const byCategory = useMemo(() => {
    const map = new Map<string, typeof a.costs.lineItems>();
    for (const item of a.costs.lineItems) {
      const cat = categoryForCode(item.code.replace(/[ab]$/, ''));
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return map;
  }, [a.costs.lineItems]);

  const amountFor = (item: (typeof a.costs.lineItems)[number]): number => {
    const row = m.budget.rows.find((r) => r.code === item.code);
    switch (item.amountType) {
      case 'fixed':
        return item.value;
      case 'perUnit':
        return item.value * m.totalUnits;
      case 'hardCostContingencyPct':
        return row?.amount ?? 0;
      case 'computed':
        return row?.amount ?? 0;
    }
  };

  const categoryTotal = (cat: string) =>
    (byCategory.get(cat) ?? []).reduce((s, i) => s + amountFor(i), 0);

  const setItem = (id: string, value: number) =>
    update((d) => {
      d.costs.lineItems = d.costs.lineItems.map((i) => (i.id === id ? { ...i, value } : i));
      return d;
    });

  const ddTotal =
    DD_PREDEV_BUDGET.dueDiligence.reduce((s, i) => s + i.amount, 0) +
    DD_PREDEV_BUDGET.permittingDesign.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Total Project Costs (Gross)</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{fmtMoney(m.budget.totalGross)}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {fmtMoney(m.budget.totalGross / Math.max(1, m.totalUnits))} / unit · {fmtMoney(m.budget.totalGross / Math.max(1, m.totalNrsf), 0)} / NRSF
          </div>
        </Card>
        <Card>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Hard cost contingency %">
              <PctInput
                value={a.costs.hardCostContingencyPct}
                onChange={(v) => update((d) => ({ ...d, costs: { ...d.costs, hardCostContingencyPct: v } }))}
                step={0.25}
              />
            </Field>
            <Field label="Project contingency %">
              <PctInput
                value={a.costs.projectContingencyPct}
                onChange={(v) => update((d) => ({ ...d, costs: { ...d.costs, projectContingencyPct: v } }))}
                step={0.25}
              />
            </Field>
          </div>
        </Card>
        <Card>
          <Note>
            Rows marked <span className="font-semibold">computed</span> — construction interest, the loan
            origination fee, interim property taxes, vacancy/carrying costs, and the project
            contingency — are engine outputs of the iterative financing solve, not direct inputs.
          </Note>
        </Card>
      </div>

      <Card title="Development Budget" subtitle="Itemized cost input rolling up live to category and grand totals">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <Th right={false} className="w-8" />
                <Th right={false}>Line Item</Th>
                <Th right={false}>Code</Th>
                <Th right={false}>Basis</Th>
                <Th>Input</Th>
                <Th>Amount</Th>
                <Th>$/Unit</Th>
                <Th>% Total</Th>
              </tr>
            </thead>
            <tbody>
              {CATEGORY_ORDER.map((cat) => {
                const items = byCategory.get(cat) ?? [];
                const total = categoryTotal(cat);
                const isOpen = open[cat] ?? false;
                return (
                  <Fragment key={cat}>
                    <tr
                      className="cursor-pointer border-t border-slate-200 bg-slate-50 font-semibold hover:bg-slate-100"
                      onClick={() => setOpen((o) => ({ ...o, [cat]: !isOpen }))}
                    >
                      <Td right={false} className="text-slate-400">{isOpen ? '▾' : '▸'}</Td>
                      <Td right={false}>{cat}</Td>
                      <Td right={false} />
                      <Td right={false} />
                      <Td />
                      <Td><Money v={total} /></Td>
                      <Td>{fmtMoney(total / Math.max(1, m.totalUnits))}</Td>
                      <Td className="text-slate-400">{((total / Math.max(1, m.budget.totalGross)) * 100).toFixed(1)}%</Td>
                    </tr>
                    {isOpen &&
                      items.map((item) => {
                        const amount = amountFor(item);
                        const editable = item.amountType === 'fixed' || item.amountType === 'perUnit';
                        return (
                          <tr key={item.id} className="border-t border-slate-100">
                            <Td right={false} />
                            <Td right={false} className="text-slate-700">
                              <span className="text-slate-400">{item.group} · </span>
                              {item.label}
                            </Td>
                            <Td right={false} className="text-xs text-slate-400">{item.code}</Td>
                            <Td right={false} className="text-xs text-slate-500">
                              {item.amountType === 'fixed' && '$'}
                              {item.amountType === 'perUnit' && '$/unit'}
                              {item.amountType === 'hardCostContingencyPct' && '% of GC'}
                              {item.amountType === 'computed' && 'computed'}
                            </Td>
                            <Td>
                              {editable ? (
                                <div className="ml-auto w-28">
                                  <NumberInput value={item.value} onChange={(v) => setItem(item.id, v)} min={0} step={item.amountType === 'perUnit' ? 50 : 500} />
                                </div>
                              ) : item.amountType === 'hardCostContingencyPct' ? (
                                <span className="text-xs text-slate-400">{(a.costs.hardCostContingencyPct * 100).toFixed(1)}%</span>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </Td>
                            <Td><Money v={amount} /></Td>
                            <Td className="text-slate-500">{fmtMoney(amount / Math.max(1, m.totalUnits))}</Td>
                            <Td className="text-slate-400">{((amount / Math.max(1, m.budget.totalGross)) * 100).toFixed(2)}%</Td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}
              <tr className="border-t-2 border-slate-400 bg-slate-50 text-base font-bold">
                <Td right={false} />
                <Td right={false}>TOTAL PROJECT COSTS (GROSS)</Td>
                <Td right={false} />
                <Td right={false} />
                <Td />
                <Td><Money v={m.budget.totalGross} /></Td>
                <Td>{fmtMoney(m.budget.totalGross / Math.max(1, m.totalUnits))}</Td>
                <Td>100%</Td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="DD & Pre-Development Budget (informational)"
        subtitle={`Standalone due-diligence estimate — total ${fmtMoney(ddTotal)}. Does not roll into the project budget (matching the source model).`}
      >
        <div className="grid gap-6 md:grid-cols-2">
          {(
            [
              ['Due Diligence', DD_PREDEV_BUDGET.dueDiligence],
              ['Permitting & Design', DD_PREDEV_BUDGET.permittingDesign],
            ] as const
          ).map(([label, items]) => (
            <table key={label} className="w-full">
              <thead>
                <tr>
                  <Th right={false}>{label}</Th>
                  <Th>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.label} className="border-t border-slate-100">
                    <Td right={false} className="text-slate-600">{i.label}</Td>
                    <Td><Money v={i.amount} /></Td>
                  </tr>
                ))}
                <tr className="border-t border-slate-300 font-semibold">
                  <Td right={false}>Subtotal</Td>
                  <Td><Money v={items.reduce((s, i) => s + i.amount, 0)} /></Td>
                </tr>
              </tbody>
            </table>
          ))}
        </div>
      </Card>
    </div>
  );
}
