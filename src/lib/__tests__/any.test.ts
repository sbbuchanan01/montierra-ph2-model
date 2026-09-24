import { describe, expect, it } from 'vitest';
import { headline, isForSale, kindOf, runAny, tryRunAny } from '../any';
import { DEFAULT_ASSUMPTIONS } from '../model/defaults';
import { TH_TEMPLATE_ASSUMPTIONS, makeBlankForSale } from '../forsale/defaults';

describe('rental and for-sale cases side by side', () => {
  it('tells the kinds apart (rows without a kind are rental)', () => {
    expect(kindOf(DEFAULT_ASSUMPTIONS)).toBe('rental');
    expect(kindOf(TH_TEMPLATE_ASSUMPTIONS)).toBe('forSale');
    expect(isForSale(TH_TEMPLATE_ASSUMPTIONS)).toBe(true);
  });

  it('headline figures come from the right engine', () => {
    const r = headline(runAny(DEFAULT_ASSUMPTIONS));
    const f = headline(runAny(TH_TEMPLATE_ASSUMPTIONS));
    expect(r.kind).toBe('rental');
    expect(r.units).toBe(20);
    expect(r.totalCost).toBeCloseTo(4_686_240.67, 0);
    expect(f.kind).toBe('forSale');
    expect(f.units).toBe(10);
    expect(f.totalCost).toBeCloseTo(3_971_272.92, 1);
    expect(f.loan).toBeCloseTo(2_382_763.75, 1);
    expect(f.equity).toBeCloseTo(1_588_509.17, 1);
    expect(f.grossExit).toBeCloseTo(4_902_800, 1);
    expect(f.netExit).toBeCloseTo(4_118_352, 1);
    expect(f.profit).toBeCloseTo(8_435.67, 1);
    expect(f.projectIrr).toBeCloseTo(0.0031029731, 7);
    expect(f.endMonth).toBe(24);
    expect(f.yieldLabel).toBe('Margin on Sales');
  });

  it('a blank for-sale case runs without dividing by zero', () => {
    const m = tryRunAny(makeBlankForSale('New deal'));
    expect(m).not.toBeNull();
    const h = headline(m!);
    expect(h.units).toBe(0);
    expect(h.totalCost).toBe(0);
    expect(Number.isFinite(h.projectMoic)).toBe(true);
  });

  it('for-sale switches run clean: By Floor Plan, S-curve, fixed rate, pari passu, manual interest', () => {
    const a = structuredClone(TH_TEMPLATE_ASSUMPTIONS);
    a.pricing.method = 'By Floor Plan';
    a.schedule.hardCostCurve = 'S-Curve';
    a.financing.rateType = 'Fixed';
    a.financing.fundingOrder = 'Pari Passu';
    a.financing.interestBudget = 'Manual';
    a.financing.ltcBasis = 'Land + Hard + Soft';
    a.schedule.closingPace = 0.5;
    const m = runAny(a);
    if (!isForSale(a) || m.kind !== 'forSale') throw new Error('kind');
    expect(m.checks.filter((c) => c.status === 'check')).toEqual([]);
    // By Floor Plan: B1 homes at $470,000 and C1 homes at $500,000 (today's $), 8 + 2
    expect(m.unitSchedule.filter((u) => u.priceUsed === 470_000).length).toBe(8);
    expect(m.unitSchedule.filter((u) => u.priceUsed === 500_000).length).toBe(2);
    // half a closing a month → the 10th home closes 16 months after the first-closing batch
    expect(m.schedule.sellout).toBe(16 + 16);
    // the S-curve still spends exactly the hard-cost budget
    expect(m.draw.reduce((s, d) => s + d.construction, 0)).toBeCloseTo(m.budget.hardSubtotal, 4);
    expect(m.budget.interestBudget).toBe(a.financing.manualInterest);
  });
});
