'use client';

import { Fragment, useState } from 'react';
import { Card, Field, NumberInput, PctInput, Th, Td, Money, Note } from '@/components/ui';
import { useForSale } from '@/store/useModelStore';
import { fmtMoney, fmtPct } from '@/lib/format';
import { SPEND_CURVES, type BudgetBasis, type BudgetSection, type ForSaleBudgetLine, type SpendCurve } from '@/lib/forsale/types';
import { SECTION_LABEL } from './common';

const SECTIONS: BudgetSection[] = ['land', 'hard', 'soft', 'financing', 'reserves'];

const BASIS_LABEL: Record<BudgetBasis, string> = {
  lump: 'Lump sum',
  pctOfLand: '% of land price',
  leaseback: '$/month (predevelopment)',
  perUnit: '$ / home',
  perGsf: '$ / gross SF',
  perSpace: '$ / space',
  pctOfDirectHard: '% of direct hard',
  pctOfHardBeforeContingency: '% of hard (pre-contingency)',
  pctOfHard: '% of hard',
  pctOfHardAndSoft: '% of hard + soft',
  pctOfSoft: '% of soft',
  originationFee: '% of commitment',
  constructionInterest: 'Calculated (circular)',
  capitalizedTaxes: 'Calculated',
};

/** Bases a user may pick for an editable line, by section. */
const PICKABLE: Record<BudgetSection, BudgetBasis[]> = {
  land: ['lump', 'pctOfLand', 'leaseback', 'perUnit'],
  hard: ['lump', 'perUnit', 'perGsf', 'perSpace', 'pctOfDirectHard', 'pctOfHardBeforeContingency'],
  soft: ['lump', 'perUnit', 'perGsf', 'pctOfHard', 'pctOfHardAndSoft', 'pctOfSoft'],
  financing: ['lump', 'perUnit'],
  reserves: ['lump', 'perUnit'],
};

const isPct = (b: BudgetBasis) => b.startsWith('pct') || b === 'originationFee';

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

/** Development Budget — every line editable (basis, rate, spend curve); computed lines come from the engine. */
export function ForSaleBudget() {
  const { a, m, update } = useForSale();
  const [open, setOpen] = useState<Record<string, boolean>>({ land: true, hard: true, soft: true, financing: true, reserves: true });
  const B = m.budget;
  const amountOf = (id: string) => B.lines.find((l) => l.id === id);

  const setLine = (id: string, patch: Partial<ForSaleBudgetLine>) =>
    update((d) => ({ ...d, budget: d.budget.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const addLine = (section: BudgetSection) =>
    update((d) => {
      const idx = d.budget.map((l) => l.section).lastIndexOf(section);
      const line: ForSaleBudgetLine = {
        id: uid(),
        section,
        label: 'New line item',
        basis: 'lump',
        rate: 0,
        curve: section === 'hard' ? 'Construction' : section === 'land' ? 'Month 0' : 'Straight-Line',
      };
      const budget = [...d.budget];
      budget.splice(idx + 1, 0, line);
      return { ...d, budget };
    });
  const deleteLine = (id: string) => update((d) => ({ ...d, budget: d.budget.filter((l) => l.id !== id) }));

  const subtotal: Record<BudgetSection, number> = {
    land: B.landSubtotal,
    hard: B.hardSubtotal,
    soft: B.softSubtotal,
    financing: B.financingSubtotal,
    reserves: B.reservesSubtotal,
  };
  const hardCont = a.budget.find((l) => l.basis === 'pctOfHardBeforeContingency');
  const softCont = a.budget.find((l) => l.basis === 'pctOfSoft');

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Total Uses of Funds</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{fmtMoney(B.total)}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {fmtMoney(B.total / Math.max(1, m.units))} / home · {fmtMoney(B.total / Math.max(1, m.nsf), 2)} / net SF · hard {fmtMoney(B.hardSubtotal / Math.max(1, m.gsf), 2)} / gross SF
          </div>
        </Card>
        <Card>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Hard cost contingency" hint="% of direct hard + general conditions">
              <PctInput value={hardCont?.rate ?? 0} onChange={(v) => hardCont && setLine(hardCont.id, { rate: v })} step={0.5} />
            </Field>
            <Field label="Soft cost contingency" hint="% of soft costs incl. the development fee">
              <PctInput value={softCont?.rate ?? 0} onChange={(v) => softCont && setLine(softCont.id, { rate: v })} step={0.5} />
            </Field>
          </div>
        </Card>
        <Card>
          <Note>
            The Spend Curve drives the draw: <span className="font-semibold">Month 0</span> funds at the land closing, <span className="font-semibold">Predevelopment</span> spreads over the predevelopment months,
            <span className="font-semibold"> Construction</span> follows the hard-cost curve, <span className="font-semibold">Straight-Line</span> spreads evenly over construction, <span className="font-semibold">Delivery</span> follows COs and
            <span className="font-semibold"> Sales Period</span> spreads from the first closing to sellout.
          </Note>
        </Card>
      </div>

      <Card title="Development Budget" subtitle="Uses of funds — percentage lines apply to the basis shown; computed lines (fee, interest, capitalized taxes) come from the engine">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px]">
            <thead>
              <tr>
                <Th right={false} className="w-6" />
                <Th right={false}>Line Item</Th>
                <Th right={false}>Basis</Th>
                <Th>Rate / Amount</Th>
                <Th right={false}>Spend Curve</Th>
                <Th>Amount</Th>
                <Th>$/Home</Th>
                <Th>$/NSF</Th>
                <Th>% Total</Th>
                <Th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map((section) => {
                const lines = a.budget.filter((l) => l.section === section);
                const isOpen = open[section];
                return (
                  <Fragment key={section}>
                    <tr className="cursor-pointer border-t border-slate-200 bg-slate-50 font-semibold hover:bg-slate-100" onClick={() => setOpen((o) => ({ ...o, [section]: !isOpen }))}>
                      <Td right={false} className="text-slate-400">{isOpen ? '▾' : '▸'}</Td>
                      <Td right={false}>{SECTION_LABEL[section]}</Td>
                      <Td right={false} className="text-xs font-normal text-slate-400">{lines.length} lines</Td>
                      <Td /><Td />
                      <Td><Money v={subtotal[section]} /></Td>
                      <Td>{fmtMoney(subtotal[section] / Math.max(1, m.units))}</Td>
                      <Td>{fmtMoney(subtotal[section] / Math.max(1, m.nsf), 2)}</Td>
                      <Td className="text-slate-400">{fmtPct(B.total ? subtotal[section] / B.total : 0, 1)}</Td>
                      <Td />
                    </tr>
                    {isOpen &&
                      lines.map((l) => {
                        const o = amountOf(l.id);
                        const computed = o?.computed ?? false;
                        const engineTimed = l.basis === 'constructionInterest' || l.basis === 'capitalizedTaxes';
                        return (
                          <tr key={l.id} className="border-t border-slate-100">
                            <Td right={false} />
                            <Td right={false}>
                              <input
                                className="w-64 rounded border border-transparent px-1.5 py-1 text-sm text-slate-800 hover:border-slate-200 focus:border-slate-400 focus:outline-none"
                                value={l.label}
                                onChange={(e) => setLine(l.id, { label: e.target.value })}
                                title={l.notes}
                              />
                            </Td>
                            <Td right={false}>
                              {computed ? (
                                <span className="text-xs text-slate-400">{BASIS_LABEL[l.basis]}</span>
                              ) : (
                                <select className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700" value={l.basis} onChange={(e) => setLine(l.id, { basis: e.target.value as BudgetBasis })}>
                                  {PICKABLE[section].map((b) => <option key={b} value={b}>{BASIS_LABEL[b]}</option>)}
                                </select>
                              )}
                            </Td>
                            <Td>
                              {l.basis === 'originationFee' ? (
                                <span className="text-xs text-slate-400">{fmtPct(a.financing.originationFeePct, 2)} (Financing tab)</span>
                              ) : computed ? (
                                <span className="text-xs text-slate-400">—</span>
                              ) : isPct(l.basis) ? (
                                <div className="ml-auto w-24"><PctInput value={l.rate} onChange={(v) => setLine(l.id, { rate: v })} step={0.25} /></div>
                              ) : (
                                <div className="ml-auto w-28"><NumberInput value={l.rate} onChange={(v) => setLine(l.id, { rate: v })} min={0} step={l.basis === 'lump' ? 500 : l.basis === 'perGsf' ? 1 : 50} /></div>
                              )}
                            </Td>
                            <Td right={false}>
                              {engineTimed ? (
                                <span className="text-xs text-slate-400">engine-timed</span>
                              ) : (
                                <select className="rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700" value={l.curve} onChange={(e) => setLine(l.id, { curve: e.target.value as SpendCurve })}>
                                  {SPEND_CURVES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                              )}
                            </Td>
                            <Td><Money v={o?.amount ?? 0} /></Td>
                            <Td className="text-slate-500">{fmtMoney(o?.perUnit ?? 0)}</Td>
                            <Td className="text-slate-500">{fmtMoney(o?.perNsf ?? 0, 2)}</Td>
                            <Td className="text-slate-400">{fmtPct(o?.pctOfTotal ?? 0, 2)}</Td>
                            <Td>
                              {!computed && (
                                <button className="text-slate-300 hover:text-red-600" title="Delete line" onClick={() => ((o?.amount ?? 0) === 0 || confirm(`Delete "${l.label}" (${fmtMoney(o?.amount ?? 0)})?`)) && deleteLine(l.id)}>
                                  ✕
                                </button>
                              )}
                            </Td>
                          </tr>
                        );
                      })}
                    {isOpen && (
                      <tr className="border-t border-slate-100">
                        <Td right={false} />
                        <Td right={false} colSpan={9}>
                          <button className="rounded-lg border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 hover:border-slate-400 hover:text-slate-700" onClick={() => addLine(section)}>
                            ＋ Add line to {SECTION_LABEL[section]}
                          </button>
                        </Td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              <tr className="border-t-2 border-slate-400 bg-slate-50 text-base font-bold">
                <Td right={false} />
                <Td right={false}>TOTAL USES OF FUNDS</Td>
                <Td right={false} /><Td /><Td />
                <Td><Money v={B.total} /></Td>
                <Td>{fmtMoney(B.total / Math.max(1, m.units))}</Td>
                <Td>{fmtMoney(B.total / Math.max(1, m.nsf), 2)}</Td>
                <Td>100%</Td>
                <Td />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Sources of Funds">
          <table className="w-full">
            <tbody>
              {(
                [
                  ['Construction Loan Commitment', m.financing.commitment, m.financing.commitmentPctOfCost],
                  ['TOTAL EQUITY REQUIRED', m.financing.equity, B.total ? m.financing.equity / B.total : 0],
                  ['  GP / Sponsor Equity', m.financing.gpEquity, a.equity.gpShare],
                  ['  LP / Investor Equity', m.financing.lpEquity, 1 - a.equity.gpShare],
                ] as [string, number, number][]
              ).map(([label, v, pct], i) => (
                <tr key={label} className={`border-t border-slate-100 ${i === 1 ? 'font-semibold' : ''}`}>
                  <Td right={false} className="text-slate-700">{label}</Td>
                  <Td><Money v={v} /></Td>
                  <Td className="text-slate-500">{fmtMoney(v / Math.max(1, m.units))}</Td>
                  <Td className="text-slate-400">{fmtPct(pct, 1)}</Td>
                </tr>
              ))}
              <tr className="border-t border-slate-300 font-semibold">
                <Td right={false}>TOTAL SOURCES</Td>
                <Td><Money v={m.financing.commitment + m.financing.equity} /></Td>
                <Td>{fmtMoney((m.financing.commitment + m.financing.equity) / Math.max(1, m.units))}</Td>
                <Td className="text-slate-400">100.0%</Td>
              </tr>
            </tbody>
          </table>
        </Card>
        <Card title="Budget vs. the Monthly Engine">
          <table className="w-full">
            <tbody>
              {(
                [
                  ['Capitalized construction interest (budget line)', B.interestBudget],
                  ['Construction interest paid before the first closing (engine)', m.financing.capitalizedInterest],
                  ['Real estate taxes capitalized — model year 1', B.capitalizedTaxes],
                  ['Loan origination fee', B.originationFee],
                  ['Equity — budget vs. the monthly cash flow', B.equityCheck],
                ] as [string, number][]
              ).map(([label, v]) => (
                <tr key={label} className="border-t border-slate-100">
                  <Td right={false} className="text-slate-700">{label}</Td>
                  <Td><Money v={v} colored /></Td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">
            A negative equity check means the monthly engine calls that much equity beyond the budget — interest and carry paid
            from equity while the lender sweeps the sales.
          </p>
        </Card>
      </div>
    </div>
  );
}
