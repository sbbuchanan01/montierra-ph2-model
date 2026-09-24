import { describe, expect, it } from 'vitest';
import { runForSaleModel } from '../engine';
import { TH_TEMPLATE_ASSUMPTIONS } from '../defaults';
import fx from '../fixtures/th-template.json';

/**
 * Ties the for-sale engine to the cached values of
 * `Townhome For-Sale Development Model - TEMPLATE v2.xlsx` (saved 2026-09-23 18:18), extracted by
 * `scripts/extract_th_fixture.py`. Every monthly row of the Draw Schedule, Debt Schedule, Sales CF
 * and Waterfall, every Annual Summary / Returns / Margin on Cost / Taxes cell and both sensitivity
 * grids are asserted — dollars to the cent, IRRs to 1e-7.
 */
const $ = 0.01; // dollars
const P = 1e-8; // percentages, indices, ratios
const IRR = 1e-7;

type Cell = number | string | null;
const num = (v: Cell): number => (v == null ? 0 : typeof v === 'number' ? v : Number.NaN);

function expectVector(actual: number[], expected: Cell[], tol: number, label: string) {
  expect(actual.length, `${label} length`).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    const e = num(expected[i]);
    if (Number.isNaN(e)) continue; // text cell ("n/m") — not a number to compare
    expect(Math.abs(actual[i] - e), `${label}[${i}] got ${actual[i]} want ${e}`).toBeLessThanOrEqual(tol);
  }
}
const near = (actual: number | null, expected: Cell, tol: number, label: string) => {
  const e = num(expected);
  expect(actual, label).not.toBeNull();
  expect(Math.abs((actual as number) - e), `${label} got ${actual} want ${e}`).toBeLessThanOrEqual(tol);
};

const out = runForSaleModel(TH_TEMPLATE_ASSUMPTIONS);
const months = out.monthly; // 0..120
const cf = fx.salesCf as Record<string, Cell[]>;
const row = (r: number) => cf[String(r)];

describe('for-sale template: program, schedule and sizing (Inputs tab)', () => {
  const I = fx.inputs as Record<string, Cell>;
  it('converges the construction-interest circularity', () => {
    expect(out.converged).toBe(true);
  });
  it('program and schedule', () => {
    expect(out.units).toBe(I.units);
    expect(out.nsf).toBe(I.nsf);
    expect(out.avgSf).toBe(I.avgSf);
    expect(out.gsf).toBe(I.gsf);
    expect(out.schedule.lastDelivery).toBe(I.lastDelivery);
    expect(out.schedule.sellout).toBe(I.sellout);
    expect(out.schedule.selloutDate).toBe(I.selloutDate);
    expect(out.schedule.selloutDuration).toBe(I.selloutDur);
    expect(out.waPrice).toBe(I.waPrice);
    expect(out.waPsf).toBe(I.waPsf);
    expect(out.grossSelloutToday).toBe(I.grossToday);
    near(out.totalDeductionsPct, I.totalDeductions, P, 'deductions %');
  });
  it('loan sizing and equity', () => {
    near(out.financing.sizingRate, I.sizingRate, P, 'sizing rate');
    near(out.budget.total, I.totalCost, $, 'total cost');
    near(out.budget.costExFee, I.costExFee, $, 'cost ex fee');
    near(out.budget.landHardSoft, I.lhs, $, 'land+hard+soft');
    near(out.financing.maxLtcProceeds, I.maxLtc, $, 'max LTC');
    near(out.financing.maxSelloutProceeds, I.maxLtgs, $, 'max LTGS');
    near(out.financing.commitment, I.commitment, $, 'commitment');
    expect(out.financing.binding).toBe(I.binding);
    near(out.financing.commitmentPctOfCost, I.commitPctCost, P, 'commit % cost');
    near(out.financing.commitmentPctOfSellout, I.commitPctSellout, P, 'commit % sellout');
    near(out.financing.loanPerUnit, I.loanPerUnit, $, 'loan per unit');
    near(out.financing.equity, I.equity, $, 'equity');
    near(out.financing.gpEquity, I.gpEquity, $, 'GP equity');
    near(out.financing.lpEquity, I.lpEquity, $, 'LP equity');
  });
  it('carry table and growth indices', () => {
    const C = fx.carry as Record<string, Cell[]>;
    out.carry.items.forEach((it, i) => {
      const [e, f, g] = C[String(64 + i)];
      near(it.perUnitYr, e, $, `carry ${it.label} /unit/yr`);
      near(it.annual, f, $, `carry ${it.label} annual`);
      near(it.perUnitMo, g, $, `carry ${it.label} /unit/mo`);
    });
    near(out.carry.perUnitYr, C['71'][0], $, 'carry total');
    near(out.carry.annual, C['71'][1], $, 'carry annual');
    near(out.carry.perUnitMo, C['71'][2], $, 'carry /mo');
    const idx = fx.indices as Record<string, Cell[]>;
    expectVector(months.filter((m) => m.month >= 1 && (m.month - 1) % 12 === 0).map((m) => m.priceIndex), idx.price, P, 'price index');
    expectVector(months.filter((m) => m.month >= 1 && (m.month - 1) % 12 === 0).map((m) => m.carryIndex), idx.carry, P, 'carry index');
    expectVector(out.taxes.years.map((y) => y.index), idx.tax, P, 'tax index');
  });
});

describe('Unit Schedule', () => {
  it('dates and prices every home', () => {
    const rows = fx.unitSchedule as Record<string, Cell>[];
    expect(out.unitSchedule.length).toBe(rows.length);
    rows.forEach((r, i) => {
      const u = out.unitSchedule[i];
      expect(u.unit).toBe(r.B);
      expect(u.plan).toBe(r.C);
      expect(u.sf).toBe(r.D);
      near(u.planPrice, r.E, $, `unit ${i + 1} plan price`);
      near(u.priceUsed, r.F, $, `unit ${i + 1} price used`);
      expect(u.deliveryMonth).toBe(r.H);
      expect(u.scheduledMonth).toBe(r.J);
      expect(u.closingMonth).toBe(r.K);
      expect(u.closingYear).toBe(r.L);
      near(u.grossPrice, r.M, $, `unit ${i + 1} gross price`);
    });
    const T = fx.unitScheduleTotals as Record<string, Cell>;
    near(out.unitSchedule.reduce((s, u) => s + u.grossPrice, 0), T.M, $, 'gross at closing');
    expect(out.schedule.lastDelivery).toBe(T.H507);
    expect(out.schedule.sellout).toBe(T.K507);
  });
});

describe('Development Budget', () => {
  const ROW_TO_ID: Record<number, string> = {
    8: 'land-purchase', 9: 'land-closing', 10: 'broker-fee', 11: 'leaseback', 12: 'due-diligence',
    16: 'demo-site-prep', 17: 'sitework', 18: 'shell-core', 19: 'interior-finish', 20: 'amenities', 21: 'parking-paving',
    22: 'landscaping', 23: 'general-conditions', 24: 'hard-contingency',
    28: 'ae', 29: 'civil', 30: 'permits', 31: 'legal', 32: 'third-party', 33: 'builders-risk', 34: 'marketing', 35: 'ffe',
    36: 'development-fee', 37: 'soft-contingency',
    41: 'origination-fee', 42: 'lender-inspections', 43: 'lender-legal', 44: 'rate-cap', 45: 'construction-interest',
    49: 'startup', 50: 'capitalized-taxes', 51: 'working-capital',
  };
  const Bx = fx.budget as Record<string, Record<string, Cell>>;
  it('every line, per unit, per NSF and % of total', () => {
    for (const [r, id] of Object.entries(ROW_TO_ID)) {
      const line = out.budget.lines.find((l) => l.id === id)!;
      const e = Bx[r];
      near(line.amount, e.E, $, `${id} amount`);
      near(line.perUnit, e.F, $, `${id} per unit`);
      near(line.perNsf, e.G, P, `${id} per NSF`);
      near(line.pctOfTotal, e.H, P, `${id} % of total`);
    }
  });
  it('subtotals, total and sources', () => {
    near(out.budget.landSubtotal, Bx['13'].E, $, 'land subtotal');
    near(out.budget.hardSubtotal, Bx['25'].E, $, 'hard subtotal');
    near(out.budget.softSubtotal, Bx['38'].E, $, 'soft subtotal');
    near(out.budget.financingSubtotal, Bx['46'].E, $, 'financing subtotal');
    near(out.budget.reservesSubtotal, Bx['52'].E, $, 'reserves subtotal');
    near(out.budget.total, Bx['54'].E, $, 'total uses');
    const S = fx.budgetSources as Record<string, Cell>;
    near(out.financing.commitment, S['59'], $, 'loan commitment');
    near(out.financing.equity, S['60'], $, 'equity');
    near(out.financing.gpEquity, S['61'], $, 'GP');
    near(out.financing.lpEquity, S['62'], $, 'LP');
    const M = fx.budgetMetrics as Record<string, Cell>;
    near(out.budget.total / out.units, M['68'], $, 'cost per unit');
    near(out.budget.total / out.nsf, M['69'], P, 'cost per NSF');
    near(out.budget.landSubtotal / out.budget.total, M['71'], P, 'land %');
    near(out.margin.trended.gross, M['74'], $, 'gross sellout');
    near(out.margin.trended.netSales, M['75'], $, 'net sales');
    near(out.margin.trended.netProfit, M['76'], $, 'net profit');
    near(out.margin.trended.marginOnGross, M['77'], P, 'margin on gross');
    near(out.margin.trended.marginOnNet, M['78'], P, 'margin on net');
    near(out.margin.trended.returnOnCost, M['79'], P, 'ROC');
    near(out.margin.trended.annualizedRoc, M['80'], P, 'annualized ROC');
    near(out.financing.commitmentPctOfCost, M['81'], P, 'LTC');
    near(out.financing.commitmentPctOfSellout, M['82'], P, 'LTGS');
    const K = fx.budgetChecks as Record<string, Cell>;
    near(out.budget.equityCheck, K['89'], $, 'equity check');
  });
});

describe('Taxes tab', () => {
  const T = fx.taxes as Record<string, Cell[]>;
  const yrs = out.taxes.years;
  it('assessment and allocation by model year', () => {
    expectVector(yrs.map((y) => y.hardSpent), T['11'].slice(1), $, 'hard spent');
    expectVector(yrs.map((y) => y.cumHard), T['12'].slice(1), $, 'cum hard');
    expectVector(yrs.map((y) => y.assessedImprovements), T['13'].slice(1), $, 'assessed improvements');
    expectVector(yrs.map((y) => y.assessedValue), T['15'].slice(1), $, 'assessed value');
    expectVector(yrs.map((y) => y.annualTax), T['17'].slice(1), $, 'annual tax');
    expectVector(yrs.map((y) => y.monthsCapitalized), T['20'].slice(1), P, 'months capitalized');
    expectVector(yrs.map((y) => y.capitalized), T['21'].slice(1), $, 'capitalized');
    expectVector(yrs.map((y) => y.notCharged), T['22'].slice(1), $, 'not charged');
    expectVector(yrs.map((y) => y.carried), T['23'].slice(1), $, 'carried');
    expectVector(yrs.map((y) => y.buyers), T['24'].slice(1), $, 'buyers');
    near(out.taxes.totalTax, T['17'][0], $, 'total tax');
    near(out.taxes.capitalized, T['21'][0], $, 'total capitalized');
    near(out.taxes.notCharged, T['22'][0], $, 'total not charged');
    near(out.taxes.carried, T['23'][0], $, 'total carried');
    near(out.taxes.buyers, T['24'][0], $, 'total buyers');
    near(out.budget.capitalizedTaxes, T['21'][0], $, 'budget capitalized taxes');
  });
});

describe('Draw Schedule (months 0-120)', () => {
  const D = fx.draw as Record<string, Cell[]>;
  const d = out.draw;
  it('curve percentages', () => {
    expectVector(d.map((r) => r.year), D.C, P, 'model year');
    expectVector(d.map((r) => r.predevPct), D.E, P, 'predev %');
    expectVector(d.map((r) => r.constructionPct), D.F, P, 'construction %');
    expectVector(d.map((r) => r.deliveryPct), D.G, P, 'delivery %');
    expectVector(d.map((r) => r.salesPct), D.H, P, 'sales %');
  });
  it('monthly dollars by curve, interest, taxes, total, cumulative', () => {
    expectVector(d.map((r) => r.landUpFront), D.I, $, 'land & up-front');
    expectVector(d.map((r) => r.predevelopment), D.J, $, 'predevelopment');
    expectVector(d.map((r) => r.construction), D.K, $, 'construction');
    expectVector(d.map((r) => r.delivery), D.L, $, 'delivery');
    expectVector(d.map((r) => r.salesPeriod), D.M, $, 'sales period');
    expectVector(d.map((r) => r.straightLine), D.N, $, 'straight-line');
    expectVector(d.map((r) => r.interest), D.O, $, 'interest');
    expectVector(d.map((r) => r.taxes), D.P, $, 'taxes');
    expectVector(d.map((r) => r.total), D.Q, $, 'total');
    expectVector(d.map((r) => r.cumulative), D.R, $, 'cumulative');
    expectVector(d.map((r) => r.pctOfBudget), D.S, P, '% of budget');
    expectVector(d.map((r) => r.hardMemo), D.T, $, 'hard memo');
  });
});

describe('Debt Schedule (months 0-120)', () => {
  const D = fx.debt as Record<string, Cell[]>;
  const H = fx.debtHead as Record<string, Cell>;
  const d = out.debt;
  it('header figures', () => {
    near(out.financing.commitment, H.F4, $, 'commitment');
    near(out.financing.equity, H.F5, $, 'budgeted equity');
    near(out.financing.peakBalance, H.F6, $, 'peak balance');
    expect(out.financing.repaidMonth).toBe(H.F7);
    near(out.financing.totalInterest, H.F8, $, 'total interest');
    near(out.financing.capitalizedInterest, H.G8, $, 'capitalized interest');
    near(out.budget.interestBudget, H.G8, $, 'interest budget line');
  });
  it('every monthly column', () => {
    expectVector(d.map((r) => r.rate), D.F, P, 'rate');
    expectVector(d.map((r) => r.bop), D.G, $, 'BOP');
    expectVector(d.map((r) => r.interest), D.H, $, 'interest');
    expectVector(d.map((r) => r.interestBudgetFunded), D.I, $, 'interest budget-funded');
    expectVector(d.map((r) => r.interestFromSales), D.J, $, 'interest from sales');
    expectVector(d.map((r) => r.draw), D.K, $, 'draw');
    expectVector(d.map((r) => r.repayment), D.L, $, 'repayment');
    expectVector(d.map((r) => r.payoff), D.M, $, 'payoff');
    expectVector(d.map((r) => r.eop), D.N, $, 'EOP');
    expectVector(d.map((r) => r.undrawn), D.O, $, 'undrawn');
  });
});

describe('Sales CF (months 0-120)', () => {
  const m = months;
  it('homes and indices', () => {
    expectVector(m.map((r) => r.year), row(6), P, 'year');
    expectVector(m.map((r) => (r.inProject ? 1 : 0)), row(7), P, 'in project');
    expectVector(m.map((r) => r.priceIndex), row(8), P, 'price index');
    expectVector(m.map((r) => r.carryIndex), row(9), P, 'carry index');
    expectVector(m.map((r) => r.deliveredCum), row(10), P, 'delivered cum');
    expectVector(m.map((r) => r.closed), row(11), P, 'closed');
    expectVector(m.map((r) => r.closedCum), row(12), P, 'closed cum');
    expectVector(m.map((r) => r.unsoldCarried), row(13), P, 'unsold carried');
    expectVector(m.map((r) => r.notYetClosed), row(14), P, 'not yet closed');
    expectVector(m.map((r) => r.pctSold), row(15), P, '% sold');
    expectVector(m.map((r) => r.pctBudgetComplete), row(16), P, '% budget complete');
  });
  it('sales revenue and deductions', () => {
    expectVector(m.map((r) => r.grossByPlan[0]), row(19), $, 'gross B1');
    expectVector(m.map((r) => r.grossByPlan[1]), row(20), $, 'gross C1');
    expectVector(m.map((r) => r.grossSales), row(31), $, 'gross sales');
    expectVector(m.map((r) => r.commissions), row(32), $, 'commissions');
    expectVector(m.map((r) => r.litigation), row(33), $, 'litigation');
    expectVector(m.map((r) => r.escrow), row(34), $, 'escrow');
    expectVector(m.map((r) => r.sellerClosing), row(35), $, 'seller closing');
    expectVector(m.map((r) => r.incentives), row(36), $, 'incentives');
    expectVector(m.map((r) => r.totalDeductions), row(37), $, 'total deductions');
    expectVector(m.map((r) => r.netSales), row(38), $, 'net sales');
  });
  it('carry, warranty and net sellout', () => {
    for (let i = 0; i < 7; i++) expectVector(m.map((r) => r.carryItems[i]), row(41 + i), $, `carry item ${i}`);
    expectVector(m.map((r) => r.taxesOnUnsold), row(48), $, 'taxes on unsold');
    expectVector(m.map((r) => r.totalCarry), row(49), $, 'total carry');
    expectVector(m.map((r) => r.warranty), row(51), $, 'warranty');
    expectVector(m.map((r) => r.netSellout), row(53), $, 'net sellout');
  });
  it('development spend and unlevered cash flow', () => {
    expectVector(m.map((r) => r.devLand), row(56), $, 'land');
    expectVector(m.map((r) => r.devPredev), row(57), $, 'predev');
    expectVector(m.map((r) => r.devHard), row(58), $, 'hard');
    expectVector(m.map((r) => r.devDeliverySales), row(59), $, 'delivery & sales');
    expectVector(m.map((r) => r.devStraightLine), row(60), $, 'straight-line');
    expectVector(m.map((r) => r.devTaxes), row(61), $, 'capitalized taxes');
    expectVector(m.map((r) => r.devTotal), row(62), $, 'total dev spend');
    expectVector(m.map((r) => r.unlevered), row(64), $, 'unlevered');
  });
  it('financing and levered cash flow', () => {
    expectVector(m.map((r) => r.loanDraw), row(70), $, 'loan draws');
    expectVector(m.map((r) => r.interest), row(71), $, 'interest');
    expectVector(m.map((r) => r.repayment), row(72), $, 'repayment');
    expectVector(m.map((r) => r.payoff), row(73), $, 'payoff');
    expectVector(m.map((r) => r.financing), row(74), $, 'financing');
    expectVector(m.map((r) => r.loanBalance), row(75), $, 'balance');
    expectVector(m.map((r) => r.undrawn), row(76), $, 'undrawn');
    expectVector(m.map((r) => r.levered), row(78), $, 'levered');
    expectVector(m.map((r) => r.cumulativeLevered), row(82), $, 'cumulative levered');
    expectVector(m.map((r) => r.equityCalled), row(85), $, 'equity called');
  });
  it('totals, IRRs and multiples', () => {
    const T = fx.salesCfTotals as Record<string, Cell>;
    near(out.returns.unleveredProfit, T['65'], $, 'unlevered profit');
    near(out.returns.unleveredIrr, T['66'], IRR, 'unlevered IRR');
    near(out.returns.unleveredMoic, T['67'], P, 'unlevered MOIC');
    near(out.returns.leveredProfit, T['79'], $, 'levered profit');
    near(out.returns.leveredIrr, T['80'], IRR, 'levered IRR');
    near(out.returns.leveredMoic, T['81'], P, 'levered MOIC');
    near(out.returns.totalEquityInvested, T['85'], $, 'equity called');
  });
});

describe('Annual Summary (years 0-10 + total)', () => {
  const A = fx.annual as Record<string, Cell[]>;
  const withTotal = (f: (y: (typeof out.annual)[number]) => number) => {
    const v = out.annual.map(f);
    return [...v, v.reduce((s, x) => s + x, 0)];
  };
  const yearsOnly = (f: (y: (typeof out.annual)[number]) => number) => out.annual.map(f);
  it('every row', () => {
    expectVector(withTotal((y) => y.closed), A['7'], P, 'closed');
    expectVector(yearsOnly((y) => y.closedCum), A['8'].slice(0, 11), P, 'closed cum');
    expectVector(yearsOnly((y) => y.notYetClosed), A['9'].slice(0, 11), P, 'not yet closed');
    expectVector(yearsOnly((y) => y.avgPrice), A['10'].slice(0, 11), $, 'avg price');
    expectVector(withTotal((y) => y.grossSales), A['13'], $, 'gross');
    expectVector(withTotal((y) => y.commissions), A['14'], $, 'commissions');
    expectVector(withTotal((y) => y.litigation), A['15'], $, 'litigation');
    expectVector(withTotal((y) => y.escrow), A['16'], $, 'escrow');
    expectVector(withTotal((y) => y.sellerClosing), A['17'], $, 'seller closing');
    expectVector(withTotal((y) => y.incentives), A['18'], $, 'incentives');
    expectVector(withTotal((y) => y.netSales), A['19'], $, 'net sales');
    expectVector(withTotal((y) => y.directCarry), A['22'], $, 'direct carry');
    expectVector(withTotal((y) => y.taxesOnUnsold), A['23'], $, 'taxes on unsold');
    expectVector(withTotal((y) => y.totalCarry), A['24'], $, 'total carry');
    expectVector(withTotal((y) => y.warranty), A['25'], $, 'warranty');
    expectVector(withTotal((y) => y.netSellout), A['26'], $, 'net sellout');
    expectVector(withTotal((y) => y.devLand), A['29'], $, 'land');
    expectVector(withTotal((y) => y.devHard), A['30'], $, 'hard');
    expectVector(withTotal((y) => y.devOther), A['31'], $, 'other dev');
    expectVector(withTotal((y) => y.devTaxes), A['32'], $, 'cap taxes');
    expectVector(withTotal((y) => y.devTotal), A['33'], $, 'dev total');
    expectVector(withTotal((y) => y.unlevered), A['35'], $, 'unlevered');
    expectVector(withTotal((y) => y.loanDraws), A['38'], $, 'draws');
    expectVector(withTotal((y) => y.interest), A['39'], $, 'interest');
    expectVector(withTotal((y) => y.repayment), A['40'], $, 'repayment');
    expectVector(withTotal((y) => y.financing), A['41'], $, 'financing');
    expectVector(yearsOnly((y) => y.eoyBalance), A['42'].slice(0, 11), $, 'EOY balance');
    expectVector(yearsOnly((y) => y.avgRate), A['43'].slice(0, 11), P, 'avg rate');
    expectVector(withTotal((y) => y.levered), A['45'], $, 'levered');
  });
});

describe('Waterfall (months 0-120)', () => {
  const W = fx.waterfall as Record<string, Cell[]>;
  const w = out.waterfall;
  const R = fx.returns as Record<string, Cell | Cell[]>;
  it('every tier row', () => {
    const map: [number, (x: (typeof w)[number]) => number, string][] = [
      [10, (x) => x.levered, 'levered'], [12, (x) => x.distributable, 'distributable'], [13, (x) => x.contributed, 'contributed'],
      [15, (x) => x.capitalBop, 'capital BOP'], [16, (x) => x.prefBop, 'pref BOP'], [17, (x) => x.prefAccrual, 'pref accrual'],
      [18, (x) => x.prefPaid, 'pref paid'], [19, (x) => x.returnOfCapital, 'return of capital'], [20, (x) => x.afterTier1, 'after tier 1'],
      [21, (x) => x.capitalEop, 'capital EOP'], [22, (x) => x.prefEop, 'pref EOP'], [23, (x) => x.hurdleBop, 'hurdle BOP'],
      [24, (x) => x.hurdleAccrual, 'hurdle accrual'], [25, (x) => x.hurdleBeforeTier2, 'hurdle before tier 2'],
      [26, (x) => x.tier2Partner, 'tier 2 partner'], [27, (x) => x.hurdleEop, 'hurdle EOP'], [28, (x) => x.tier2Promote, 'tier 2 promote'],
      [29, (x) => x.tier2Total, 'tier 2 total'], [30, (x) => x.tier3Residual, 'tier 3 residual'], [31, (x) => x.tier3Promote, 'tier 3 promote'],
      [32, (x) => x.tier3Partner, 'tier 3 partner'], [34, (x) => x.lpTier1, 'LP tier 1'], [35, (x) => x.lpTier2, 'LP tier 2'],
      [36, (x) => x.lpTier3, 'LP tier 3'], [37, (x) => x.lpDistributions, 'LP distributions'], [38, (x) => x.lpContributions, 'LP contributions'],
      [39, (x) => x.lpNet, 'LP net'], [41, (x) => x.gpTier1, 'GP tier 1'], [42, (x) => x.gpTier23, 'GP tiers 2-3'],
      [43, (x) => x.gpPromote, 'GP promote'], [44, (x) => x.gpDistributions, 'GP distributions'], [45, (x) => x.gpContributions, 'GP contributions'],
      [46, (x) => x.gpNet, 'GP net'],
    ];
    for (const [r, f, label] of map) expectVector(w.map(f), W[String(r)], $, label);
  });
  it('partnership returns', () => {
    const S = fx.waterfallSummary as Record<string, Cell[]>;
    near(out.returns.unleveredIrr, S['52'][0], IRR, 'unlevered IRR');
    near(out.returns.unleveredMoic, S['52'][1], P, 'unlevered MOIC');
    near(out.returns.leveredIrr, S['53'][0], IRR, 'levered IRR');
    near(out.returns.leveredMoic, S['53'][1], P, 'levered MOIC');
    near(out.returns.lpIrr, S['54'][0], IRR, 'LP IRR');
    near(out.returns.lpMoic, S['54'][1], P, 'LP MOIC');
    near(out.returns.gpIrr, S['55'][0], IRR, 'GP IRR');
    near(out.returns.gpMoic, S['55'][1], P, 'GP MOIC');
    near(out.returns.lpProfit, R.F74 as Cell, $, 'LP profit');
    near(out.returns.gpProfit, R.F77 as Cell, $, 'GP profit');
    near(out.returns.gpPromote, R.F78 as Cell, $, 'GP promote');
    near(out.returns.prefPaid, R.F79 as Cell, $, 'pref paid');
    near(out.returns.returnOfCapital, R.F80 as Cell, $, 'return of capital');
    near(out.returns.tier23Distributed, R.F81 as Cell, $, 'tiers 2-3');
    near(out.returns.unpaidPref, R.F82 as Cell, $, 'unpaid pref');
  });
});

describe('Returns tab and Margin on Cost', () => {
  const R = fx.returns as Record<string, Cell | Cell[]>;
  const M = fx.margin as Record<string, { D: Cell; F: Cell }>;
  it('section 1 economics', () => {
    near(out.budget.total, R.D7 as Cell, $, 'total cost');
    near(out.budget.total / out.units, R.D8 as Cell, $, 'cost per unit');
    near(out.budget.landSubtotal, R.D10 as Cell, $, 'land');
    near(out.budget.hardSubtotal, R.D11 as Cell, $, 'hard');
    near(out.margin.trended.gross, R.D12 as Cell, $, 'gross sellout');
    near(out.margin.trended.netSales, R.D13 as Cell, $, 'net sales');
    near(out.margin.trended.directCarry + out.margin.trended.taxes + out.margin.trended.warranty, R.D14 as Cell, $, 'carry+taxes+warranty');
    near(out.margin.trended.netProfit, R.D15 as Cell, $, 'net profit');
    near(out.margin.trended.marginOnGross, R.D16 as Cell, P, 'margin on gross');
    near(out.margin.trended.marginOnNet, R.D17 as Cell, P, 'margin on net');
    near(out.margin.trended.returnOnCost, R.D18 as Cell, P, 'ROC');
    near(out.margin.trended.annualizedRoc, R.D19 as Cell, P, 'annualized ROC');
    expect(out.schedule.selloutDuration).toBe(R.J8);
    near(out.returns.avgClosingsPerMonth, R.J9 as Cell, P, 'avg closings');
    near(out.returns.avgPricePerHome, R.J10 as Cell, $, 'avg price per home');
    near(out.returns.avgPricePsf, R.J11 as Cell, P, 'avg price psf');
    near(out.returns.carryPerHome, R.J12 as Cell, $, 'carry per home');
    expect(out.financing.repaidMonth).toBe(R.J13);
    near(out.returns.peakEquityOutstanding, R.F54 as Cell, $, 'peak equity');
    near(out.returns.equityAtLandClosing, R.F55 as Cell, $, 'equity at closing');
    near(out.returns.totalEquityInvested, R.F56 as Cell, $, 'total equity invested');
  });
  it('annual roll-ups', () => {
    const rows = (k: string) => R[k] as Cell[];
    expectVector(out.annual.map((y) => y.devTotal), rows('row31'), $, 'dev spend');
    expectVector(out.annual.map((y) => y.netSellout), rows('row32'), $, 'net sellout');
    expectVector(out.annual.map((y) => y.unlevered), rows('row33'), $, 'unlevered');
    expectVector(out.annual.map((y) => y.loanDraws), rows('row45'), $, 'draws');
    expectVector(out.annual.map((y) => y.interest), rows('row47'), $, 'interest');
    expectVector(out.annual.map((y) => y.repayment), rows('row48'), $, 'repayment');
    expectVector(out.annual.map((y) => y.levered), rows('row49'), $, 'levered');
    expectVector(out.annual.map((y) => y.lpDistributions), rows('row63'), $, 'LP distributions');
    expectVector(out.annual.map((y) => y.lpContributions), rows('row64'), $, 'LP contributions');
    expectVector(out.annual.map((y) => y.lpNet), rows('row65'), $, 'LP net');
    expectVector(out.annual.map((y) => y.gpDistributions), rows('row67'), $, 'GP distributions');
    expectVector(out.annual.map((y) => y.gpContributions), rows('row68'), $, 'GP contributions');
    expectVector(out.annual.map((y) => y.gpNet), rows('row69'), $, 'GP net');
  });
  it('margin on cost — untrended and trended', () => {
    const cols: [keyof typeof out.margin.trended, string, number][] = [
      ['totalCost', '4', $], ['gross', '7', $], ['commissions', '8', $], ['litigation', '9', $], ['escrow', '10', $],
      ['sellerClosing', '11', $], ['incentives', '12', $], ['netSales', '13', $], ['directCarry', '15', $], ['taxes', '16', $],
      ['warranty', '17', $], ['netSellout', '18', $], ['costExInterest', '20', $], ['profitBeforeInterest', '21', $],
      ['interest', '22', $], ['netProfit', '23', $], ['marginOnGross', '25', P], ['marginOnNet', '26', P], ['returnOnCost', '27', P],
      ['profitPerUnit', '28', $], ['annualizedRoc', '29', P], ['priceCushion', '30', P],
    ];
    for (const [k, r, tol] of cols) {
      near(out.margin.untrended[k], M[r].D, tol, `untrended ${k}`);
      near(out.margin.trended[k], M[r].F, tol, `trended ${k}`);
    }
  });
  it('sensitivity grids', () => {
    const SP = fx.sensProfit as Cell[][];
    const SM = fx.sensMargin as Cell[][];
    for (let i = 0; i < 9; i++) {
      expectVector(out.sensitivity.profit[i], SP[i], $, `profit sens row ${i}`);
      expectVector(out.sensitivity.margin[i], SM[i], P, `margin sens row ${i}`);
    }
  });
  it('dashboard headline cells', () => {
    const D = fx.dashboard as Record<string, Cell>;
    near(out.financing.capitalizedInterest, D.K9, $, 'interest capitalized');
    near(out.financing.interestFromSales, D.K10, $, 'interest from sales');
    near(out.financing.peakBalance, D.K11, $, 'peak balance');
    near(out.returns.peakEquityOutstanding, D.K13, $, 'peak equity');
    near(out.margin.trended.netSales, D.K17, $, 'net sales');
    near(out.margin.trended.profitPerUnit, D.D23, $, 'profit per home');
    near(out.margin.trended.priceCushion, D.D26, P, 'price cushion');
    near(out.returns.gpPromote, D.K29, $, 'promote');
    expect(out.checks.every((c) => c.status !== 'check')).toBe(true);
  });
});
