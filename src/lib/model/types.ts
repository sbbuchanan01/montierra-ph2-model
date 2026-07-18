import type { CurveName } from './curves';

/** One unit type row in the unit mix (mirrors `Unit Mix_Income` rows 12-27). */
export interface UnitTypeRow {
  id: string;
  unitType: string; // e.g. "2BD-M"
  unitCode: string; // e.g. "B1"
  count: number;
  avgSf: number;
  rentPsf: number; // asking rent $/SF/month
}

export type CostAmountType =
  | 'fixed' // lump-sum $
  | 'perUnit' // $/unit × unit count
  | 'perRsf' // $/rentable SF × total NRSF
  | 'hardCostContingencyPct' // % × General Construction Contract total
  | 'computed';

/**
 * One line item of the Detailed Cost Input. `value` is $ for 'fixed',
 * $/unit for 'perUnit', $/SF for 'perRsf', a decimal % for
 * 'hardCostContingencyPct' (% of the GC contract, like the workbook's
 * hard-cost contingency). 'computed' rows (external construction interest,
 * interim RE taxes, vacancy/carrying, loan fee, project contingency) are
 * engine outputs. `startMonth`/`endMonth` (analysis months, anchored to the
 * analysis start date) override the schedule-derived phasing window;
 * omitted = derived from the project schedule like the source workbook.
 */
export interface CostLineItem {
  id: string;
  code: string; // 6-digit cost code, used to roll up into budget rows
  group: string; // sub-header within the category (e.g. "General Construction Contract")
  label: string;
  amountType: CostAmountType;
  value: number;
  startMonth?: number | null;
  endMonth?: number | null;
}

export interface TaxJurisdiction {
  id: string;
  name: string;
  millageRate: number; // per $100, e.g. 0.8595
}

export interface RetailTenant {
  id: string;
  space: string;
  leaseUpMonthOffset: number; // months after construction completion (C37)
  termYears: number;
  sf: number;
  tiPsf: number;
  rentPsf: number; // annual NNN $/SF
  escalationPct: number;
}

export interface Assumptions {
  project: {
    name: string;
    location: string;
    productType: string;
    siteAcres: number;
    analysisStart: string; // ISO date, first of month
  };
  schedule: {
    landClosingMonth: number; // analysis month (1-based)
    softCostStartMonth: number;
    leaseUpStartMonth: number; // Project Summary D26
    saleMonth: number; // Project Summary D28 (hold period)
    totalMonths: number; // ledger length (132 in the workbook)
  };
  unitMix: UnitTypeRow[];
  rentGrowth: number[]; // 10 year-over-year rates, year 1 first (year 1 = 0)
  leasing: {
    leasesSignedAtCO: number;
    monthlyAbsorption: number;
    stabilizationOccupancy: number; // 0.95
    leaseUpConcessionWeeks: number; // weeks free (S20)
    stabilizedConcessionsPct: number;
    lossToLeasePct: number;
    adminUnitsPct: number;
    stabilizedVacancyPct: number;
    collectionLossPct: number;
    expenseGrowthPct: number; // construction/lease-up expense growth (T23)
  };
  otherIncome: {
    rubsPctOfUtilities: number;
    adminFeePerLease: number;
    petFeePerLease: number;
    petRentPerMonth: number;
    bulkWifiPerUnitMonth: number;
    trashPerUnitMonth: number;
    pestPerUnitMonth: number;
    petRenterPct: number;
    turnoverPct: number;
    incomeGrowthPct: number; // W13
  };
  parking: {
    totalSpaces: number;
    retailSpaces: number;
    guestAdaSpaces: number;
    pctOfSpacesRented: number;
    ratePerSpaceMonth: number;
  };
  storage: {
    spaces: number;
    totalSf: number;
    rentPerSpaceMonth: number;
  };
  opex: {
    // $/unit/year rates (Lease-Up CF column B)
    payroll: number;
    marketing: number;
    leasingCommissions: number;
    repairsMaintenance: number; // scales with occupancy
    turnover: number; // scales with occupancy
    contractServices: number;
    utilities: number; // scales with occupancy
    generalAdmin: number;
    insurance: number;
    capitalReserves: number;
    mgmtFeePct: number; // of total income
    mgmtFeeFloorPerMonth: number; // $1,500 floor
  };
  costs: {
    lineItems: CostLineItem[];
    hardCostContingencyPct: number; // Development Budget F23 (5%)
    projectContingencyPct: number; // Development Budget F116 (2%)
  };
  constructionCurve: {
    selected: CurveName;
    customCurve: number[]; // editable % list used when selected === 'Custom'
  };
  financing: {
    construction: {
      ltc: number;
      rateType: 'Fixed' | 'Floating';
      indexRate: number; // fixed-quote index (D16)
      spread: number;
      useForwardCurve: boolean; // floating uses SOFR forward curve
      termMonths: number;
      ioMonths: number;
      amortYears: number;
      originationFeePct: number;
      extension1Months: number;
      extension1FeePct: number;
      extension2Months: number;
      extension2FeePct: number;
    };
    refinance: {
      enabled: boolean;
      rateType: 'Fixed' | 'Floating';
      indexRate: number;
      spread: number;
      termMonths: number;
      ioMonths: number;
      amortYears: number;
      refinanceMonth: number; // analysis month
      ltv: number;
      dscr: number;
      debtYield: number;
      capRate: number; // implied-value cap rate (C51)
    };
  };
  exit: {
    mfCapRate: number;
    retailCapRate: number;
    closingCostPct: number;
  };
  waterfall: {
    gpOwnershipPct: number;
    preferredReturn: number;
    hurdle1Rate: number;
    lpShareHurdle1: number;
    hurdle2Rate: number;
    lpShareHurdle2: number;
    lpShareFinal: number;
  };
  taxes: {
    jurisdictions: TaxJurisdiction[];
    assessmentRatio: number; // 0.9 construction-phase
    mfBaseCapRate: number; // 0.0675 loaded-cap assessment
    retailBaseCapRate: number; // 0.075
    stateTaxRate: number; // 0 for TX
    depreciationYears: number; // 30 (model convention; 27.5 is the US standard)
    dscrTestRate: number; // Operating Yield B106 (7%) used in the DSCR coverage test
  };
  retail: {
    tenants: RetailTenant[];
    nnnOpexPsf: number;
    marketRentGrowthPct: number; // AA40
    expenseGrowthPct: number; // AC41
    camPerSf: number;
    insurancePerSf: number;
    reservesPerSf: number;
    parkingRatePerSpaceMonth: number; // AC39
  };
}

/* ---------------------------- Output shapes ---------------------------- */

export interface BudgetRow {
  key: string;
  code: string;
  category: string;
  label: string;
  amount: number;
  perUnit: number;
  perNrsf: number;
  pctOfTotal: number;
  startMonth: number;
  finishMonth: number;
  phasing: 'lump' | 'spread' | 'curve' | 'computed';
  monthly: number[]; // draws by month (index 0 = month 1)
}

export interface MonthlyRow {
  month: number; // 1-based analysis month
  date: string; // ISO
  analysisYear: number;
  operationMonth: number;
  operationYear: number;

  capex: number;
  equityDraw: number;
  loanDraw: number;
  loanBeginBalance: number;
  loanInterest: number;
  loanPrincipal: number;
  loanBalloon: number;
  loanEndBalance: number;
  loanRate: number;
  refiDraw: number;
  refiBeginBalance: number;
  refiInterest: number;
  refiPrincipal: number;
  refiBalloon: number;
  refiEndBalance: number;

  leasedUnits: number;
  occupancy: number;
  marketRent: number;
  potentialGrossRent: number;
  leaseUpVacancy: number;
  effectiveGrossRent: number;
  leaseUpConcessions: number;
  stabilizedConcessions: number;
  lossToLease: number;
  adminUnits: number;
  netEffectiveRents: number;
  stabilizedVacancy: number;
  collectionLoss: number;
  netRentalIncome: number;
  rubs: number;
  adminFees: number;
  petFee: number;
  petRent: number;
  bulkWifi: number;
  trash: number;
  pest: number;
  storageIncome: number;
  parkingIncome: number;
  totalOtherIncome: number;
  totalIncome: number;
  salary: number;
  marketingExp: number;
  leasingCommissionsExp: number;
  repairsMaintenance: number;
  turnoverExp: number;
  contractServices: number;
  utilities: number;
  generalAdmin: number;
  propertyTaxes: number;
  managementFees: number;
  insurance: number;
  totalExpenses: number;
  capitalReserves: number;
  mfCashFlowFromOps: number;

  retailOccupancy: number;
  retailIncome: number;
  retailExpenses: number;
  retailNoi: number;
  retailCashFlow: number;

  combinedOpsCashFlow: number;
  interestShortfallCost: number; // capitalized external construction interest
  carryingCost: number; // vacancy/carrying cost line
  interimTaxCost: number;
  contingencyCost: number;
  saleProceeds: number; // gross sale + closing + state tax injected at sale month
  stateTax: number;
  cashOutflowToEquity: number; // Monthly PF row 217
  projectCashFlow: number; // Monthly PF row 218 (waterfall/XIRR series)
}

export interface WaterfallMonth {
  month: number;
  date: string;
  projectCf: number;
  lpPref: number;
  gpPref: number;
  lpH1: number;
  gpH1: number;
  lpH2: number;
  gpH2: number;
  lpTotal: number;
  gpTotal: number;
}

export interface WaterfallResult {
  months: WaterfallMonth[];
  lpEquity: number;
  gpEquity: number;
  totalEquity: number;
  lpNetCashFlow: number;
  gpNetCashFlow: number;
  lpMoic: number;
  gpMoic: number;
  projectMoic: number;
  lpIrr: number | null;
  gpIrr: number | null;
  projectIrr: number | null;
  tierTotals: {
    lp: { pref: number; hurdle1: number; hurdle2: number; final: number };
    gp: { pref: number; hurdle1: number; hurdle2: number; final: number };
  };
}

export interface OperatingYieldCol {
  label: string;
  potentialGrossRent: number;
  leaseUpVacancy: number;
  effectiveGrossRent: number;
  concessions: number;
  lossToLease: number;
  adminUnits: number;
  netEffectiveRents: number;
  vacancyLoss: number;
  collectionLoss: number;
  netRentalIncome: number;
  otherIncome: Record<string, number>;
  totalOtherIncome: number;
  totalIncome: number;
  controllable: Record<string, number>;
  subtotalControllable: number;
  propertyTaxes: number;
  managementFees: number;
  insurance: number;
  subtotalNonControllable: number;
  totalExpenses: number;
  mfNoi: number;
  retailNoi: number;
  combinedNoi: number;
  capitalReserves: number;
  netCashFlow: number;
  returnOnCostGross: number;
  returnOnCostNet: number;
  debtYield: number;
  dscr: number;
}

export interface AnnualSummaryRow {
  year: number;
  startMonth: number;
  totalIncome: number;
  totalExpenses: number;
  mfNoi: number;
  combinedNoi: number;
  capex: number;
  equityDraw: number;
  loanDraw: number;
  interest: number;
  debtService: number;
  projectCashFlow: number;
  avgOccupancy: number;
}

export interface TaxYearRow {
  analysisYear: number;
  stabilizationYear: number;
  operationYear: number;
  improvementsAccrued: number;
  taxableValueConstruction: number;
  taxesDueDuringConstruction: number;
  noiBeforeTax: number;
  incomeApproachValue: number;
  stabilizedTaxableValue: number;
  stabilizedTaxesDue: number;
  // income tax build (inert for TX)
  taxableNoi: number;
  depreciation: number;
  interestExpense: number;
  taxableIncome: number;
  stateTaxDue: number;
}

export interface ModelOutput {
  converged: boolean;
  iterations: number;
  totalUnits: number;
  totalNrsf: number;
  retailSf: number;
  avgRent: number;
  constructionEndMonth: number;
  leaseUpEndMonth: number;
  stabilizationDate: string;

  budget: {
    rows: BudgetRow[];
    landTotal: number;
    hardCostTotal: number;
    softCostConsultants: number;
    softCostMarketing: number;
    softCostMunicipal: number;
    softCostFinancing: number;
    softCostOperating: number;
    softCostGa: number;
    totalGross: number;
    equityPaydown: number;
    totalNet: number;
  };

  financing: {
    loanAmount: number;
    equityCommitment: number;
    gpEquity: number;
    lpEquity: number;
    originationFee: number;
    firstDrawMonth: number;
    payoffMonth: number;
    totalInterest: number;
    capitalizedInterest: number;
    refi: {
      enabled: boolean;
      proceeds: number;
      ltvConstraint: number;
      dscrConstraint: number;
      debtYieldConstraint: number;
      impliedValue: number;
      noiForTest: number;
      equityPaydown: number;
    };
  };

  monthly: MonthlyRow[];
  annual: AnnualSummaryRow[];
  taxes: TaxYearRow[];
  effectiveTaxRate: number;

  sale: {
    month: number;
    date: string;
    forwardNoiMf: number;
    forwardNoiRetail: number;
    mfSalePrice: number;
    retailSalePrice: number;
    closingCosts: number;
    stateTaxOnSale: number;
    loanBalanceRetired: number;
    netSaleProceeds: number;
    netProfitFromSale: number;
  };

  returns: {
    projectXirr: number | null;
    projectMoic: number;
    totalEquityInvested: number;
    totalDistributions: number;
  };

  operatingYield: {
    untrended: OperatingYieldCol;
    stabilized: OperatingYieldCol;
    stabilizedYearLabel: number;
  };

  waterfall: WaterfallResult;
}
