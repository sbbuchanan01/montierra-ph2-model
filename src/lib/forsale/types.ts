/**
 * For-sale (townhome / condo) development model — a port of
 * `Townhome For-Sale Development Model - TEMPLATE v2.xlsx` (G:\My Drive\Montierra Ph II\Analysis).
 *
 * Homes deliver at a pace from the first CO and close at a pace from the first closing
 * (never before delivery), each at its base price grown to the model year it closes in.
 * Carry runs on delivered homes still unsold; the construction loan funds behind equity,
 * interest is paid current (a budget line before the first closing, then paid from sales
 * cash) and the lender sweeps the net sellout cash until repaid.
 */

export interface ForSalePlan {
  id: string;
  code: string; // "B1"
  description: string; // "2BD Townhome"
  beds: number;
  baths: number;
  count: number;
  avgSf: number;
  basePsf: number; // today's asking $/SF
  notes?: string;
}

export type SpendCurve = 'Month 0' | 'Predevelopment' | 'Construction' | 'Delivery' | 'Sales Period' | 'Straight-Line';

export const SPEND_CURVES: SpendCurve[] = ['Month 0', 'Predevelopment', 'Construction', 'Delivery', 'Sales Period', 'Straight-Line'];

export type BudgetSection = 'land' | 'hard' | 'soft' | 'financing' | 'reserves';

/**
 * How a budget line's amount is built, mirroring the Development Budget tab's Basis column.
 *  - lump / perUnit / perGsf / perSpace / pctOfLand / leaseback are ordinary inputs
 *  - pctOfDirectHard   = % × the hard lines above it that are not themselves percentages (general conditions)
 *  - pctOfHardBeforeContingency = % × (direct hard + general conditions)          (hard contingency)
 *  - pctOfHard         = % × the hard-cost subtotal                                (A&E, builder's risk)
 *  - pctOfHardAndSoft  = % × (hard subtotal + soft lines other than the fee/contingency) (development fee)
 *  - pctOfSoft         = % × (soft lines incl. the development fee)               (soft contingency)
 *  - originationFee / constructionInterest / capitalizedTaxes are engine outputs
 */
export type BudgetBasis =
  | 'lump'
  | 'pctOfLand'
  | 'leaseback'
  | 'perUnit'
  | 'perGsf'
  | 'perSpace'
  | 'pctOfDirectHard'
  | 'pctOfHardBeforeContingency'
  | 'pctOfHard'
  | 'pctOfHardAndSoft'
  | 'pctOfSoft'
  | 'originationFee'
  | 'constructionInterest'
  | 'capitalizedTaxes';

export const COMPUTED_BASES: BudgetBasis[] = ['originationFee', 'constructionInterest', 'capitalizedTaxes'];

export interface ForSaleBudgetLine {
  id: string;
  section: BudgetSection;
  label: string;
  basis: BudgetBasis;
  /** $ for lump / leaseback ($/month) / per-unit / per-GSF / per-space lines, a decimal for % lines, ignored when computed. */
  rate: number;
  curve: SpendCurve;
  notes?: string;
}

export type CarryBasis = 'psfMo' | 'perUnitYr' | 'perMonthProject';

export interface CarryItem {
  id: string;
  label: string;
  input: number;
  basis: CarryBasis;
  notes?: string;
}

export interface ForSaleTaxJurisdiction {
  id: string;
  name: string;
  ratePer100: number;
  assessmentPct: number;
}

export type HardCostCurve = 'Custom' | 'S-Curve' | 'Straight-Line';
export type PricingMethod = 'Blended Average' | 'By Floor Plan';
export type LtcBasis = 'Total Project Cost' | 'Land + Hard + Soft';
export type FundingOrder = 'Equity First' | 'Pari Passu';
export type InterestBudgetMode = 'Circular' | 'Manual';

export interface ForSaleAssumptions {
  kind: 'forSale';
  project: {
    name: string;
    productType: string; // "Attached Townhome w/ Garage"
    location: string;
    siteAcres: number;
    parkingSpaces: number;
    netToGross: number; // saleable SF ÷ gross building SF
  };
  schedule: {
    landClosingDate: string; // ISO date = month 0
    predevMonths: number;
    constructionMonths: number;
    hardCostCurve: HardCostCurve;
    customCurve: number[]; // 36 construction-month percentages (decimals), normalized by the engine
    firstCoMonth: number;
    deliveryPace: number; // units per month
    firstClosingMonth: number;
    firstClosingUnits: number; // pre-sales closing together in the first closing month
    closingPace: number; // units per month thereafter (fractional allowed)
  };
  plans: ForSalePlan[];
  pricing: {
    method: PricingMethod;
    commissionsPct: number;
    litigationPct: number;
    escrowPct: number;
    sellerClosingPct: number;
    incentivesPct: number;
    warrantyPct: number;
  };
  growth: {
    price: number[]; // 10 model years, year 1 unused
    carry: number[];
    tax: number[];
    sofr: number[]; // index rate by model year (floating debt)
  };
  carry: CarryItem[];
  taxes: {
    jurisdictions: ForSaleTaxJurisdiction[];
    landAssessedValue: number;
    improvementsPctOfHard: number;
  };
  financing: {
    maxLtc: number;
    ltcBasis: LtcBasis;
    maxLoanToSellout: number;
    rateType: 'Fixed' | 'Floating';
    fixedRate: number;
    spread: number;
    capStrike: number; // 0 = none
    termMonths: number;
    interestBudget: InterestBudgetMode;
    manualInterest: number;
    fundingOrder: FundingOrder;
    originationFeePct: number;
    releasePct: number; // share of net sellout cash swept to the lender
  };
  equity: {
    gpShare: number;
    preferredReturn: number;
    tier2Promote: number;
    irrHurdle: number;
    tier3Promote: number;
  };
  budget: ForSaleBudgetLine[];
}

/* ---------------------------------- outputs ---------------------------------- */

export interface UnitScheduleRow {
  unit: number;
  plan: string;
  sf: number;
  planPrice: number;
  priceUsed: number;
  deliveryMonth: number;
  scheduledMonth: number;
  closingMonth: number;
  closingYear: number;
  grossPrice: number;
}

export interface BudgetLineOut {
  id: string;
  section: BudgetSection;
  label: string;
  basis: BudgetBasis;
  rate: number;
  amount: number;
  perUnit: number;
  perNsf: number;
  pctOfTotal: number;
  curve: SpendCurve;
  computed: boolean;
  notes?: string;
}

export interface DrawRow {
  month: number;
  year: number;
  date: string;
  predevPct: number;
  constructionPct: number;
  deliveryPct: number;
  salesPct: number;
  landUpFront: number;
  predevelopment: number;
  construction: number;
  delivery: number;
  salesPeriod: number;
  straightLine: number;
  interest: number;
  taxes: number;
  total: number;
  cumulative: number;
  pctOfBudget: number;
  hardMemo: number;
}

export interface DebtRow {
  month: number;
  year: number;
  date: string;
  phase: 'Construction' | 'Sellout' | 'Repaid';
  rate: number;
  bop: number;
  interest: number;
  interestBudgetFunded: number;
  interestFromSales: number;
  draw: number;
  repayment: number;
  payoff: number;
  eop: number;
  undrawn: number;
}

export interface SalesMonth {
  month: number;
  year: number;
  date: string;
  inProject: boolean;
  priceIndex: number;
  carryIndex: number;
  deliveredCum: number;
  closed: number;
  closedCum: number;
  unsoldCarried: number;
  notYetClosed: number;
  pctSold: number;
  pctBudgetComplete: number;
  grossByPlan: number[];
  grossSales: number;
  commissions: number;
  litigation: number;
  escrow: number;
  sellerClosing: number;
  incentives: number;
  totalDeductions: number;
  netSales: number;
  carryItems: number[];
  taxesOnUnsold: number;
  totalCarry: number;
  warranty: number;
  netSellout: number;
  devLand: number;
  devPredev: number;
  devHard: number;
  devDeliverySales: number;
  devStraightLine: number;
  devTaxes: number;
  devTotal: number;
  unlevered: number;
  loanDraw: number;
  interest: number;
  repayment: number;
  payoff: number;
  financing: number;
  loanBalance: number;
  undrawn: number;
  levered: number;
  cumulativeLevered: number;
  equityCalled: number;
}

export interface ForSaleAnnual {
  year: number;
  yearEnd: string;
  closed: number;
  closedCum: number;
  notYetClosed: number;
  avgPrice: number;
  grossSales: number;
  commissions: number;
  litigation: number;
  escrow: number;
  sellerClosing: number;
  incentives: number;
  netSales: number;
  directCarry: number;
  taxesOnUnsold: number;
  totalCarry: number;
  warranty: number;
  netSellout: number;
  devLand: number;
  devHard: number;
  devOther: number;
  devTaxes: number;
  devTotal: number;
  unlevered: number;
  loanDraws: number;
  interest: number;
  repayment: number;
  financing: number;
  eoyBalance: number;
  avgRate: number;
  levered: number;
  lpDistributions: number;
  lpContributions: number;
  lpNet: number;
  gpDistributions: number;
  gpContributions: number;
  gpNet: number;
}

export interface ForSaleWaterfallMonth {
  month: number;
  date: string;
  levered: number;
  distributable: number;
  contributed: number;
  capitalBop: number;
  prefBop: number;
  prefAccrual: number;
  prefPaid: number;
  returnOfCapital: number;
  afterTier1: number;
  capitalEop: number;
  prefEop: number;
  hurdleBop: number;
  hurdleAccrual: number;
  hurdleBeforeTier2: number;
  tier2Partner: number;
  hurdleEop: number;
  tier2Promote: number;
  tier2Total: number;
  tier3Residual: number;
  tier3Promote: number;
  tier3Partner: number;
  lpTier1: number;
  lpTier2: number;
  lpTier3: number;
  lpDistributions: number;
  lpContributions: number;
  lpNet: number;
  gpTier1: number;
  gpTier23: number;
  gpPromote: number;
  gpDistributions: number;
  gpContributions: number;
  gpNet: number;
}

export interface TaxYear {
  year: number;
  hardSpent: number;
  cumHard: number;
  assessedImprovements: number;
  land: number;
  assessedValue: number;
  index: number;
  annualTax: number;
  monthsCapitalized: number;
  capitalized: number;
  notCharged: number;
  carried: number;
  buyers: number;
}

export interface MarginColumn {
  totalCost: number;
  gross: number;
  commissions: number;
  litigation: number;
  escrow: number;
  sellerClosing: number;
  incentives: number;
  netSales: number;
  directCarry: number;
  taxes: number;
  warranty: number;
  netSellout: number;
  costExInterest: number;
  profitBeforeInterest: number;
  interest: number;
  netProfit: number;
  marginOnGross: number;
  marginOnNet: number;
  returnOnCost: number;
  profitPerUnit: number;
  annualizedRoc: number;
  priceCushion: number;
}

export interface ModelCheck {
  label: string;
  status: 'ok' | 'note' | 'check';
  detail: string;
}

export interface ForSaleOutput {
  kind: 'forSale';
  converged: boolean;
  iterations: number;

  units: number;
  nsf: number;
  avgSf: number;
  gsf: number;
  density: number;
  parkingRatio: number;
  waPrice: number;
  waPsf: number;
  grossSelloutToday: number;
  totalDeductionsPct: number;

  schedule: {
    landClosingDate: string;
    modelStart: string;
    constructionStart: number;
    constructionEnd: number;
    firstCo: number;
    lastDelivery: number;
    firstClosing: number;
    sellout: number;
    selloutDate: string;
    selloutDuration: number;
    closedAfterGrid: number;
  };
  unitSchedule: UnitScheduleRow[];

  budget: {
    lines: BudgetLineOut[];
    landSubtotal: number;
    hardSubtotal: number;
    softSubtotal: number;
    financingSubtotal: number;
    reservesSubtotal: number;
    total: number;
    costExFee: number;
    landHardSoft: number;
    originationFee: number;
    interestBudget: number;
    capitalizedTaxes: number;
    hardContingencyPct: number;
    softContingencyPct: number;
    equityCheck: number; // budget equity + equity actually called by the monthly engine (negative = extra calls)
  };

  financing: {
    commitment: number;
    maxLtcProceeds: number;
    maxSelloutProceeds: number;
    binding: 'Loan to Cost' | 'Loan to Sellout';
    commitmentPctOfCost: number;
    commitmentPctOfSellout: number;
    loanPerUnit: number;
    equity: number;
    gpEquity: number;
    lpEquity: number;
    sizingRate: number;
    peakBalance: number;
    repaidMonth: number | null;
    totalInterest: number;
    capitalizedInterest: number;
    interestFromSales: number;
  };

  carry: { items: { id: string; label: string; perUnitYr: number; annual: number; perUnitMo: number }[]; perUnitYr: number; annual: number; perUnitMo: number };
  taxes: { combinedRate: number; years: TaxYear[]; totalTax: number; capitalized: number; notCharged: number; carried: number; buyers: number };

  draw: DrawRow[];
  debt: DebtRow[];
  monthly: SalesMonth[];
  annual: ForSaleAnnual[];
  waterfall: ForSaleWaterfallMonth[];
  margin: { untrended: MarginColumn; trended: MarginColumn };

  returns: {
    unleveredIrr: number | null;
    unleveredMoic: number;
    unleveredProfit: number;
    leveredIrr: number | null;
    leveredMoic: number;
    leveredProfit: number;
    peakEquityOutstanding: number;
    equityAtLandClosing: number;
    totalEquityInvested: number;
    lpIrr: number | null;
    lpMoic: number;
    lpProfit: number;
    gpIrr: number | null;
    gpMoic: number;
    gpProfit: number;
    gpPromote: number;
    prefPaid: number;
    returnOfCapital: number;
    tier23Distributed: number;
    unpaidPref: number;
    avgClosingsPerMonth: number;
    avgPricePerHome: number;
    avgPricePsf: number;
    carryPerHome: number;
  };

  sensitivity: { steps: number[]; profit: number[][]; margin: number[][] };
  checks: ModelCheck[];
}
