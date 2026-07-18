'use client';

import { Fragment, useMemo, useState } from 'react';
import { Card, NumberInput, PctInput, Th, Td, Money, Note, Field } from '@/components/ui';
import { useModel, useModelStore } from '@/store/useModelStore';
import { categoryForCode, DD_PREDEV_BUDGET } from '@/lib/model/costData';
import { fmtDate, fmtMoney } from '@/lib/format';
import type { CostAmountType, CostLineItem } from '@/lib/model/types';

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

/** Default cost code for user-added items, per category (prefix drives rollups). */
const NEW_ITEM_CODE: Record<string, string> = {
  Land: '100199',
  'Hard Costs': '200299',
  'Soft Costs - Consultants': '300399',
  'Soft Costs - Marketing & Leasing': '400499',
  'Soft Costs - Municipal': '500599',
  'Soft Costs - Financing': '600699',
  'Soft Costs - Operating': '700799',
  'Soft Costs - G&A': '800899',
};

const BASIS_OPTIONS: { value: CostAmountType; label: string }[] = [
  { value: 'fixed', label: 'Lump sum $' },
  { value: 'perUnit', label: '$ / unit' },
  { value: 'perRsf', label: '$ / RSF' },
  { value: 'hardCostContingencyPct', label: '% of GC contract' },
];

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export default function CostsPage() {
  const a = useModelStore((s) => s.assumptions);
  const update = useModelStore((s) => s.update);
  const m = useModel();
  const [open, setOpen] = useState<Record<string, boolean>>({ Land: true, 'Hard Costs': true });

  const rowByItemId = useMemo(() => {
    const map = new Map<string, (typeof m.budget.rows)[number]>();
    for (const row of m.budget.rows) map.set(row.key, row);
    return map;
  }, [m.budget.rows]);

  const byCategory = useMemo(() => {
    const map = new Map<string, CostLineItem[]>();
    for (const item of a.costs.lineItems) {
      const cat = categoryForCode(item.code.replace(/[ab]$/, ''));
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return map;
  }, [a.costs.lineItems]);

  const setItem = (id: string, patch: Partial<CostLineItem>) =>
    update((d) => {
      d.costs.lineItems = d.costs.lineItems.map((i) => (i.id === id ? { ...i, ...patch } : i));
      return d;
    });

  const addItem = (cat: string) =>
    update((d) => {
      d.costs.lineItems = [
        ...d.costs.lineItems,
        {
          id: uid(),
          code: NEW_ITEM_CODE[cat] ?? '800899',
          group: 'Custom',
          label: 'New line item',
          amountType: 'fixed',
          value: 0,
        },
      ];
      return d;
    });

  const deleteItem = (id: string) =>
    update((d) => {
      d.costs.lineItems = d.costs.lineItems.filter((i) => i.id !== id);
      return d;
    });

  const amountFor = (item: CostLineItem): number => rowByItemId.get(item.id)?.amount ?? 0;
  const categoryTotal = (cat: string) =>
    (byCategory.get(cat) ?? []).reduce((s, i) => s + amountFor(i), 0);

  const hcItem = a.costs.lineItems.find((i) => i.amountType === 'hardCostContingencyPct');
  const ddTotal =
    DD_PREDEV_BUDGET.dueDiligence.reduce((s, i) => s + i.amount, 0) +
    DD_PREDEV_BUDGET.permittingDesign.reduce((s, i) => s + i.amount, 0);

  const analysisStartLabel = m.monthly[0] ? fmtDate(m.monthly[0].date) : a.project.analysisStart;

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
            <Field label="Hard cost contingency %" hint="% of the GC contract">
              <PctInput
                value={hcItem?.value ?? 0}
                onChange={(v) => hcItem && setItem(hcItem.id, { value: v })}
                step={0.25}
              />
            </Field>
            <Field label="Project contingency %" hint="% of monthly spend (computed)">
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
            Start/End are analysis months anchored to the analysis start date ({analysisStartLabel} = M1).
            Blank defaults follow the project schedule (construction ends M{m.constructionEndMonth}, sale M
            {m.sale.month}). Rows marked <span className="font-semibold">computed</span> are outputs of the
            iterative financing solve.
          </Note>
        </Card>
      </div>

      <Card title="Development Budget" subtitle="Every line editable — basis, amount, timing. Add or delete lines; the model recalculates instantly.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr>
                <Th right={false} className="w-8" />
                <Th right={false}>Line Item</Th>
                <Th right={false}>Basis</Th>
                <Th>Input</Th>
                <Th>Start (mo)</Th>
                <Th>End (mo)</Th>
                <Th>Amount</Th>
                <Th>$/Unit</Th>
                <Th>% Total</Th>
                <Th className="w-8" />
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
                      <Td right={false} className="text-xs font-normal text-slate-400">{items.length} lines</Td>
                      <Td />
                      <Td />
                      <Td />
                      <Td><Money v={total} /></Td>
                      <Td>{fmtMoney(total / Math.max(1, m.totalUnits))}</Td>
                      <Td className="text-slate-400">{((total / Math.max(1, m.budget.totalGross)) * 100).toFixed(1)}%</Td>
                      <Td />
                    </tr>
                    {isOpen && (
                      <>
                        {items.map((item) => {
                          const row = rowByItemId.get(item.id);
                          const amount = row?.amount ?? 0;
                          const isComputed = item.amountType === 'computed';
                          const isCurve = row?.phasing === 'curve';
                          const hasOverride = item.startMonth != null && item.endMonth != null;
                          return (
                            <tr key={item.id} className="border-t border-slate-100">
                              <Td right={false} />
                              <Td right={false}>
                                <input
                                  className="w-56 rounded border border-transparent px-1.5 py-1 text-sm text-slate-800 hover:border-slate-200 focus:border-slate-400 focus:outline-none"
                                  value={item.label}
                                  onChange={(e) => setItem(item.id, { label: e.target.value })}
                                  disabled={isComputed}
                                />
                              </Td>
                              <Td right={false}>
                                {isComputed ? (
                                  <span className="text-xs text-slate-400">computed</span>
                                ) : (
                                  <select
                                    className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700"
                                    value={item.amountType}
                                    onChange={(e) => setItem(item.id, { amountType: e.target.value as CostAmountType })}
                                  >
                                    {BASIS_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                  </select>
                                )}
                              </Td>
                              <Td>
                                {isComputed ? (
                                  <span className="text-xs text-slate-400">—</span>
                                ) : item.amountType === 'hardCostContingencyPct' ? (
                                  <div className="ml-auto w-24">
                                    <PctInput value={item.value} onChange={(v) => setItem(item.id, { value: v })} step={0.25} />
                                  </div>
                                ) : (
                                  <div className="ml-auto w-28">
                                    <NumberInput
                                      value={item.value}
                                      onChange={(v) => setItem(item.id, { value: v })}
                                      min={0}
                                      step={item.amountType === 'fixed' ? 500 : item.amountType === 'perRsf' ? 1 : 50}
                                    />
                                  </div>
                                )}
                              </Td>
                              {isComputed || isCurve ? (
                                <Td className="text-xs text-slate-400" colSpan={2}>
                                  {isCurve ? `curve M${row?.startMonth}–M${row?.finishMonth}` : 'engine-timed'}
                                </Td>
                              ) : (
                                <>
                                  <Td>
                                    <div className="ml-auto w-16">
                                      <NumberInput
                                        value={row?.startMonth ?? 1}
                                        onChange={(v) =>
                                          setItem(item.id, {
                                            startMonth: Math.max(1, Math.round(v)),
                                            endMonth: item.endMonth ?? row?.finishMonth ?? Math.max(1, Math.round(v)),
                                          })
                                        }
                                        min={1}
                                      />
                                    </div>
                                  </Td>
                                  <Td>
                                    <div className="ml-auto flex items-center justify-end gap-1">
                                      <div className="w-16">
                                        <NumberInput
                                          value={row?.finishMonth ?? 1}
                                          onChange={(v) =>
                                            setItem(item.id, {
                                              endMonth: Math.max(1, Math.round(v)),
                                              startMonth: item.startMonth ?? row?.startMonth ?? 1,
                                            })
                                          }
                                          min={1}
                                        />
                                      </div>
                                      {hasOverride && (
                                        <button
                                          title="Reset to schedule-derived timing"
                                          className="text-xs text-slate-400 hover:text-slate-700"
                                          onClick={() => setItem(item.id, { startMonth: null, endMonth: null })}
                                        >
                                          ↺
                                        </button>
                                      )}
                                    </div>
                                  </Td>
                                </>
                              )}
                              <Td><Money v={amount} /></Td>
                              <Td className="text-slate-500">{fmtMoney(amount / Math.max(1, m.totalUnits))}</Td>
                              <Td className="text-slate-400">{((amount / Math.max(1, m.budget.totalGross)) * 100).toFixed(2)}%</Td>
                              <Td>
                                {!isComputed && (
                                  <button
                                    title="Delete line item"
                                    className="text-slate-300 hover:text-red-600"
                                    onClick={() => {
                                      if (amount === 0 || confirm(`Delete "${item.label}" (${fmtMoney(amount)})?`)) {
                                        deleteItem(item.id);
                                      }
                                    }}
                                  >
                                    ✕
                                  </button>
                                )}
                              </Td>
                            </tr>
                          );
                        })}
                        <tr className="border-t border-slate-100">
                          <Td right={false} />
                          <Td right={false} colSpan={9}>
                            <button
                              className="rounded-lg border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700"
                              onClick={() => addItem(cat)}
                            >
                              ＋ Add line to {cat}
                            </button>
                          </Td>
                        </tr>
                      </>
                    )}
                  </Fragment>
                );
              })}
              <tr className="border-t-2 border-slate-400 bg-slate-50 text-base font-bold">
                <Td right={false} />
                <Td right={false}>TOTAL PROJECT COSTS (GROSS)</Td>
                <Td right={false} />
                <Td />
                <Td />
                <Td />
                <Td><Money v={m.budget.totalGross} /></Td>
                <Td>{fmtMoney(m.budget.totalGross / Math.max(1, m.totalUnits))}</Td>
                <Td>100%</Td>
                <Td />
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
            <div key={label} className="overflow-x-auto">
              <table className="w-full">
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
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
