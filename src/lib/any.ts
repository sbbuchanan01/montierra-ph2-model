/**
 * A deal case is either the multifamily rental model (`Assumptions`, the original engine) or the
 * for-sale townhome model (`ForSaleAssumptions`, `kind: 'forSale'`). Both live in the same
 * `montierra_projects.base_case` / `montierra_scenarios.assumptions` jsonb columns; rows without a
 * `kind` are rental. This module is the only place the two are told apart.
 */
import { runModel } from './model/engine';
import type { Assumptions, ModelOutput } from './model/types';
import { runForSaleModel } from './forsale/engine';
import type { ForSaleAssumptions, ForSaleOutput } from './forsale/types';

export type AnyAssumptions = Assumptions | ForSaleAssumptions;
export type AnyOutput = ModelOutput | ForSaleOutput;
export type ModelKind = 'rental' | 'forSale';

export const isForSale = (a: AnyAssumptions): a is ForSaleAssumptions => (a as ForSaleAssumptions).kind === 'forSale';
export const isForSaleOutput = (m: AnyOutput): m is ForSaleOutput => (m as ForSaleOutput).kind === 'forSale';
export const kindOf = (a: AnyAssumptions): ModelKind => (isForSale(a) ? 'forSale' : 'rental');

export function runAny(a: AnyAssumptions): AnyOutput {
  return isForSale(a) ? runForSaleModel(a) : runModel(a);
}

/** Safe wrapper for comparison views — a degenerate case returns null instead of throwing. */
export function tryRunAny(a: AnyAssumptions): AnyOutput | null {
  try {
    return runAny(a);
  } catch {
    return null;
  }
}

/** Cross-kind headline figures for the deal dashboards, where rental and for-sale cases sit side by side. */
export interface Headline {
  kind: ModelKind;
  units: number;
  nsf: number;
  totalCost: number;
  loan: number;
  equity: number;
  /** Rental: MF sale price at exit. For-sale: gross sellout at closing prices. */
  grossExit: number;
  /** Rental: net sale proceeds. For-sale: net sales proceeds after closing deductions. */
  netExit: number;
  exitLabel: string;
  exitDate: string;
  profit: number;
  projectIrr: number | null;
  projectMoic: number;
  lpIrr: number | null;
  lpMoic: number;
  gpIrr: number | null;
  gpMoic: number;
  /** Rental: untrended return on cost. For-sale: margin on gross sales. */
  yieldLabel: string;
  yieldValue: number;
  yieldSub: string;
  /** Rental: stabilization month. For-sale: sellout month. */
  endMonth: number;
  endLabel: string;
}

export function headline(m: AnyOutput): Headline {
  if (isForSaleOutput(m)) {
    return {
      kind: 'forSale',
      units: m.units,
      nsf: m.nsf,
      totalCost: m.budget.total,
      loan: m.financing.commitment,
      equity: m.financing.equity,
      grossExit: m.margin.trended.gross,
      netExit: m.margin.trended.netSales,
      exitLabel: 'Sellout',
      exitDate: m.schedule.selloutDate,
      profit: m.returns.leveredProfit,
      projectIrr: m.returns.leveredIrr,
      projectMoic: m.returns.leveredMoic,
      lpIrr: m.returns.lpIrr,
      lpMoic: m.returns.lpMoic,
      gpIrr: m.returns.gpIrr,
      gpMoic: m.returns.gpMoic,
      yieldLabel: 'Margin on Sales',
      yieldValue: m.margin.trended.marginOnGross,
      yieldSub: `ROC ${(m.margin.trended.returnOnCost * 100).toFixed(1)}%`,
      endMonth: m.schedule.sellout,
      endLabel: 'Sellout',
    };
  }
  return {
    kind: 'rental',
    units: m.totalUnits,
    nsf: m.totalNrsf,
    totalCost: m.budget.totalGross,
    loan: m.financing.loanAmount,
    equity: m.financing.equityCommitment,
    grossExit: m.sale.mfSalePrice,
    netExit: m.sale.netSaleProceeds,
    exitLabel: 'Sale',
    exitDate: m.sale.date,
    profit: m.returns.totalDistributions - m.returns.totalEquityInvested,
    projectIrr: m.returns.projectXirr,
    projectMoic: m.returns.projectMoic,
    lpIrr: m.waterfall.lpIrr,
    lpMoic: m.waterfall.lpMoic,
    gpIrr: m.waterfall.gpIrr,
    gpMoic: m.waterfall.gpMoic,
    yieldLabel: 'Untrended ROC',
    yieldValue: m.operatingYield.untrended.returnOnCostGross,
    yieldSub: `DSCR ${m.operatingYield.untrended.dscr.toFixed(2)}x`,
    endMonth: m.leaseUpEndMonth,
    endLabel: 'Stabilization',
  };
}
