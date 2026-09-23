import { describe, expect, it } from 'vitest';
import { runModel } from '../engine';
import { DEFAULT_ASSUMPTIONS } from '../defaults';
import { v4Assumptions } from '../../../../scripts/v4-scenarios';
import type { Assumptions } from '../types';

const tpl = (a: Assumptions): Assumptions => ({ ...structuredClone(a), carryModel: 'template' });
const cases: [string, Assumptions][] = [
  ['base case', tpl(DEFAULT_ASSUMPTIONS)],
  ['16-unit', tpl(v4Assumptions({ units: 16 }))],
  ['10-unit TH', tpl(v4Assumptions({ units: 10 }))],
];
const amt = (o: ReturnType<typeof runModel>, code: string) =>
  o.budget.rows.filter((r) => r.code === code).reduce((s, r) => s + r.amount, 0);

describe.each(cases)('template carry model — %s', (_name, a) => {
  const o = runModel(a);
  const stab = o.leaseUpEndMonth;
  const capYear = Math.ceil(stab / 12);

  it('converges and sources equal uses', () => {
    expect(o.converged).toBe(true);
    const capex = o.monthly.reduce((s, r) => s + r.capex, 0);
    const funded = o.monthly.reduce((s, r) => s + r.equityDraw + r.loanDraw, 0);
    expect(capex).toBeCloseTo(o.budget.totalGross, 2);
    expect(funded).toBeCloseTo(capex, 2);
  });

  it('capitalizes all construction interest through stabilization (paid current)', () => {
    const expected = o.monthly
      .filter((r) => r.month <= stab && r.month < o.sale.month)
      .reduce((s, r) => s + r.loanInterest, 0);
    expect(amt(o, '600614')).toBeCloseTo(expected, 2);
  });

  it('untrended return on cost carries the peak construction-basis tax (TEMPLATE v2 Return on Cost D16)', () => {
    const peak = Math.max(...o.taxes.map((t) => t.taxableValueConstruction * o.effectiveTaxRate));
    expect(o.operatingYield.untrended.propertyTaxes).toBeCloseTo(peak, 2);
  });

  it('capitalizes construction-basis taxes for every year through the stabilization year', () => {
    const expected = o.taxes
      .filter((t) => t.analysisYear <= capYear)
      .reduce((s, t) => s + t.taxableValueConstruction * o.effectiveTaxRate, 0);
    expect(amt(o, '700703')).toBeCloseTo(expected, 2);
  });

  it('taxes NOI from first occupancy at the higher basis', () => {
    const lu = a.schedule.leaseUpStartMonth;
    for (const r of o.monthly.filter((x) => x.month >= lu).slice(0, 40)) {
      const due = o.taxes[r.analysisYear - 1].stabilizedTaxesDue / 12;
      expect(r.propertyTaxes).toBeCloseTo(due, 6);
    }
    expect(o.operatingYield.stabilized.propertyTaxes).toBeGreaterThan(0);
  });

  it('funds the lease-up deficit on NOI after the budget-funded tax add-back', () => {
    const lu = a.schedule.leaseUpStartMonth;
    let expected = 0;
    for (const r of o.monthly) {
      if (r.month > stab || r.month >= o.sale.month) continue;
      const t = o.taxes[r.analysisYear - 1];
      const addback = r.month >= lu && r.analysisYear <= capYear ? t.taxesDueDuringConstruction / 12 : 0;
      expected += Math.max(0, -(r.totalIncome - r.totalExpenses + addback));
    }
    expect(amt(o, '700702')).toBeCloseTo(expected, 2);
  });

  it('sizes the loan at the lesser of LTC, LTV, debt yield and DSCR (TEMPLATE v2 Inputs 8)', () => {
    const z = o.financing.sizing!;
    expect(z).toBeDefined();
    expect(o.financing.loanAmount).toBeCloseTo(Math.min(z.ltc, z.ltv, z.debtYield, z.dscr), 2);
    // LTC basis = land + hard + soft: total uses less financing costs and capitalized carry
    const excluded = o.budget.rows
      .filter((r) => r.code.startsWith('6006') || r.code === '700702' || r.code === '700703')
      .reduce((s, r) => s + r.amount, 0);
    expect(z.ltcBasis).toBeCloseTo(o.budget.totalGross - excluded, 2);
    expect(z.ltc).toBeCloseTo(a.financing.construction.ltc * z.ltcBasis, 2);
    const stab = o.leaseUpEndMonth;
    const noi = o.monthly
      .filter((r) => r.month > stab && r.month <= stab + 12)
      .reduce((s, r) => s + r.totalIncome - r.totalExpenses + r.retailNoi, 0);
    expect(z.stabilizedNoi).toBeCloseTo(noi, 2);
    expect(o.financing.equityCommitment).toBeCloseTo(o.budget.totalGross - o.financing.loanAmount, 2);
  });
});
