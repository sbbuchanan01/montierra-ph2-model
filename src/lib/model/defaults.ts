import type { Assumptions } from './types';
import { DEFAULT_COST_ITEMS } from './costData';
import { CURVE_TEMPLATES } from './curves';

/**
 * A blank-slate copy of the model for a new project: the full structure
 * (cost line items, unit-mix rows, schedules, rate conventions) is kept,
 * but deal-specific quantities — unit counts/SF/rents and every cost
 * dollar amount — are zeroed so nothing from Montierra leaks in.
 */
export function makeBlankAssumptions(name: string): Assumptions {
  const a = structuredClone(DEFAULT_ASSUMPTIONS);
  a.project = { ...a.project, name, location: '', productType: '', siteAcres: 0 };
  a.unitMix = a.unitMix.map((u) => ({ ...u, count: 0, avgSf: 0, rentPsf: 0 }));
  a.costs.lineItems = a.costs.lineItems.map((i) =>
    i.amountType === 'fixed' || i.amountType === 'perUnit' ? { ...i, value: 0 } : i,
  );
  return a;
}

/** Base-case assumptions, verbatim from the source workbook. */
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  project: {
    name: 'Montierra Ph. II',
    location: 'Leander, TX',
    productType: 'Surface MF',
    siteAcres: 0.92,
    analysisStart: '2028-01-01',
  },
  schedule: {
    landClosingMonth: 1,
    softCostStartMonth: 1,
    leaseUpStartMonth: 17,
    saleMonth: 60,
    totalMonths: 132,
  },
  unitMix: [
    { id: 'eff-m-s1', unitType: 'EFF-M', unitCode: 'S1', count: 0, avgSf: 0, rentPsf: 0 },
    { id: '1bd-m-a1', unitType: '1BD-M', unitCode: 'A1', count: 0, avgSf: 0, rentPsf: 0 },
    { id: '2bd-m-b1', unitType: '2BD-M', unitCode: 'B1', count: 16, avgSf: 1000, rentPsf: 1.85 },
    { id: '3bd-m-c1', unitType: '3BD-M', unitCode: 'C1', count: 4, avgSf: 1000, rentPsf: 1.85 },
  ],
  // Year 1 = construction (0%), years 2-7 = 3.0%, years 8-10 = 2.5%
  rentGrowth: [0, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.025, 0.025, 0.025],
  leasing: {
    leasesSignedAtCO: 10,
    monthlyAbsorption: 5,
    stabilizationOccupancy: 0.95,
    leaseUpConcessionWeeks: 0,
    stabilizedConcessionsPct: 0,
    lossToLeasePct: 0,
    adminUnitsPct: 0,
    stabilizedVacancyPct: 0.05,
    collectionLossPct: 0.0025,
    expenseGrowthPct: 0.0275,
  },
  otherIncome: {
    rubsPctOfUtilities: 0.8,
    adminFeePerLease: 100,
    petFeePerLease: 250,
    petRentPerMonth: 10,
    bulkWifiPerUnitMonth: 55,
    trashPerUnitMonth: 7,
    pestPerUnitMonth: 3,
    petRenterPct: 0.3,
    turnoverPct: 0.5,
    incomeGrowthPct: 0.03,
  },
  parking: {
    totalSpaces: 40,
    retailSpaces: 0,
    guestAdaSpaces: 5,
    pctOfSpacesRented: 0.25,
    ratePerSpaceMonth: 10,
  },
  storage: { spaces: 0, totalSf: 0, rentPerSpaceMonth: 0 },
  opex: {
    payroll: 0,
    marketing: 0,
    leasingCommissions: 750,
    repairsMaintenance: 250,
    turnover: 400,
    contractServices: 250,
    utilities: 700,
    generalAdmin: 50,
    insurance: 900,
    capitalReserves: 200,
    mgmtFeePct: 0.07,
    mgmtFeeFloorPerMonth: 1500,
  },
  costs: {
    lineItems: DEFAULT_COST_ITEMS,
    hardCostContingencyPct: 0.05,
    projectContingencyPct: 0.02,
  },
  constructionCurve: {
    selected: '3-Story Garden',
    customCurve: [...CURVE_TEMPLATES.Custom],
  },
  financing: {
    construction: {
      ltc: 0.625,
      rateType: 'Floating',
      indexRate: 0.0365,
      spread: 0.025,
      useForwardCurve: true,
      termMonths: 60,
      ioMonths: 60,
      amortYears: 30,
      originationFeePct: 0.01,
      extension1Months: 12,
      extension1FeePct: 0.0025,
      extension2Months: 12,
      extension2FeePct: 0.0025,
    },
    refinance: {
      enabled: false,
      rateType: 'Fixed',
      indexRate: 0.0434,
      spread: 0.008,
      termMonths: 300,
      ioMonths: 36,
      amortYears: 30,
      refinanceMonth: 36,
      ltv: 0.7,
      dscr: 1.15,
      debtYield: 0.07,
      capRate: 0.0525,
    },
  },
  exit: {
    mfCapRate: 0.05,
    retailCapRate: 0.065,
    closingCostPct: 0.04,
  },
  waterfall: {
    gpOwnershipPct: 0.2,
    preferredReturn: 0.09,
    hurdle1Rate: 0.3,
    lpShareHurdle1: 0.7,
    // Independently editable (the workbook hard-links these to Hurdle 1;
    // defaults kept equal to match, per the review brief).
    hurdle2Rate: 0.3,
    lpShareHurdle2: 0.7,
    lpShareFinal: 0.6,
  },
  taxes: {
    jurisdictions: [
      { id: 'aisd', name: 'Austin ISD', millageRate: 0.8595 },
      { id: 'city', name: 'City of Austin', millageRate: 0.4458 },
      { id: 'county', name: 'Travis County', millageRate: 0.304655 },
      { id: 'cad', name: 'Travis CAD', millageRate: 0 },
      { id: 'health', name: 'Travis Co. Healthcare District', millageRate: 0.100692 },
      { id: 'acc', name: 'ACC District', millageRate: 0.0986 },
    ],
    assessmentRatio: 0.9,
    mfBaseCapRate: 0.0675,
    retailBaseCapRate: 0.075,
    stateTaxRate: 0,
    depreciationYears: 30,
    dscrTestRate: 0.07,
  },
  retail: {
    tenants: [
      { id: 'a', space: 'A - Rest.', leaseUpMonthOffset: 12, termYears: 7, sf: 0, tiPsf: 0, rentPsf: 0, escalationPct: 0 },
      { id: 'b', space: 'B - Retail', leaseUpMonthOffset: 1, termYears: 7, sf: 0, tiPsf: 0, rentPsf: 0, escalationPct: 0 },
    ],
    nnnOpexPsf: 20,
    marketRentGrowthPct: 0.03,
    expenseGrowthPct: 0.0275,
    camPerSf: 0,
    insurancePerSf: 0,
    reservesPerSf: 0,
    parkingRatePerSpaceMonth: 0,
  },
};
