import { describe, expect, it } from 'vitest';
import { runModel } from '../engine';
import { DEFAULT_ASSUMPTIONS } from '../defaults';

/**
 * Validation checkpoints from the reviewed source workbook (build brief §5).
 * The core engine must reproduce these against base-case assumptions.
 */
describe('base-case validation against the source workbook', () => {
  const out = runModel(DEFAULT_ASSUMPTIONS);

  it('converges', () => {
    expect(out.converged).toBe(true);
  });

  it('Total Development Cost (Gross) ≈ $4,686,240.67', () => {
    expect(out.budget.totalGross).toBeCloseTo(4_686_240.67, 0);
  });

  it('Total Development Cost (Net) equals Gross (no refi)', () => {
    expect(out.budget.totalNet).toBeCloseTo(out.budget.totalGross, 2);
  });

  it('Construction Loan ≈ $2,928,900.42 (62.5% LTC)', () => {
    expect(out.financing.loanAmount).toBeCloseTo(2_928_900.42, 0);
  });

  it('Total Equity ≈ $1,757,340.25', () => {
    expect(out.financing.equityCommitment).toBeCloseTo(1_757_340.25, 0);
  });

  it('GP Equity ≈ $351,468.05 / LP Equity ≈ $1,405,872.20', () => {
    expect(out.financing.gpEquity).toBeCloseTo(351_468.05, 0);
    expect(out.financing.lpEquity).toBeCloseTo(1_405_872.2, 0);
  });

  it('MF Sale Price ≈ $6,641,826 (forward NOI / 5.0% cap)', () => {
    expect(out.sale.mfSalePrice).toBeGreaterThan(6_600_000);
    expect(out.sale.mfSalePrice).toBeLessThan(6_690_000);
  });

  it('Project XIRR ≈ 19.53%', () => {
    expect(out.returns.projectXirr).not.toBeNull();
    expect(out.returns.projectXirr!).toBeGreaterThan(0.19);
    expect(out.returns.projectXirr!).toBeLessThan(0.201);
  });

  it('Project MOIC ≈ 2.26x', () => {
    expect(out.returns.projectMoic).toBeGreaterThan(2.2);
    expect(out.returns.projectMoic).toBeLessThan(2.32);
  });

  it('Untrended Return on Cost (gross) ≈ 6.58%', () => {
    expect(out.operatingYield.untrended.returnOnCostGross).toBeGreaterThan(0.0653);
    expect(out.operatingYield.untrended.returnOnCostGross).toBeLessThan(0.0663);
  });

  it('Untrended Debt Yield ≈ 10.53%', () => {
    expect(out.operatingYield.untrended.debtYield).toBeGreaterThan(0.1045);
    expect(out.operatingYield.untrended.debtYield).toBeLessThan(0.1061);
  });

  it('Untrended DSCR ≈ 1.50x', () => {
    expect(out.operatingYield.untrended.dscr).toBeGreaterThan(1.48);
    expect(out.operatingYield.untrended.dscr).toBeLessThan(1.52);
  });

  it('retail section computes cleanly to $0 with zero retail SF', () => {
    for (const m of out.monthly) {
      expect(Number.isFinite(m.retailNoi)).toBe(true);
      expect(m.retailNoi).toBe(0);
    }
    expect(out.sale.retailSalePrice).toBe(0);
  });

  it('waterfall conserves cash (LP + GP = project)', () => {
    const total = out.waterfall.lpNetCashFlow + out.waterfall.gpNetCashFlow;
    const project = out.monthly.reduce((s, m) => s + m.projectCashFlow, 0);
    expect(total).toBeCloseTo(project, 2);
  });

  it('sources equal uses at the sale month (loan fully retired)', () => {
    const balloonTotal = out.monthly.reduce((s, m) => s + m.loanBalloon, 0);
    expect(balloonTotal).toBeCloseTo(out.sale.loanBalanceRetired, 2);
    const after = out.monthly.filter((m) => m.month > out.sale.month);
    for (const m of after) expect(m.loanEndBalance).toBe(0);
  });
});

describe('sensitivity sanity checks', () => {
  it('toggling the refinance on produces a coherent permanent loan', () => {
    const a = structuredClone(DEFAULT_ASSUMPTIONS);
    a.financing.refinance.enabled = true;
    const out = runModel(a);
    expect(out.converged).toBe(true);
    expect(out.financing.refi.proceeds).toBeGreaterThan(0);
    // Construction loan retired at the refi month
    const refiMonth = a.financing.refinance.refinanceMonth;
    const row = out.monthly[refiMonth - 1];
    expect(row.loanBalloon).toBeGreaterThan(0);
    expect(row.refiDraw).toBeCloseTo(out.financing.refi.proceeds, 2);
  });

  it('changing rent ripples through to XIRR', () => {
    const a = structuredClone(DEFAULT_ASSUMPTIONS);
    a.unitMix = a.unitMix.map((u) => ({ ...u, rentPsf: u.rentPsf * 1.05 }));
    const out = runModel(a);
    const base = runModel(DEFAULT_ASSUMPTIONS);
    expect(out.returns.projectXirr!).toBeGreaterThan(base.returns.projectXirr!);
  });

  it('changing a cost assumption ripples through to total cost and MOIC', () => {
    const a = structuredClone(DEFAULT_ASSUMPTIONS);
    a.costs.lineItems = a.costs.lineItems.map((i) =>
      i.id === 'gc-contract' ? { ...i, value: 125_000 } : i,
    );
    const out = runModel(a);
    const base = runModel(DEFAULT_ASSUMPTIONS);
    expect(out.budget.totalGross).toBeGreaterThan(base.budget.totalGross + 190_000);
    expect(out.returns.projectMoic).toBeLessThan(base.returns.projectMoic);
  });
});
