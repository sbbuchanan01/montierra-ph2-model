import type { ForSaleAssumptions, ForSaleBudgetLine } from './types';

/**
 * The Montierra Ph II 10-home for-sale townhome program, verbatim from
 * `Townhome For-Sale Development Model - TEMPLATE v2.xlsx` (Inputs, Unit Mix, Development Budget)
 * as saved 2026-09-23 18:18. The engine ties to that file's cached values (see __tests__).
 */
const budget: ForSaleBudgetLine[] = [
  // Land & acquisition
  { id: 'land-purchase', section: 'land', label: 'Land Purchase', basis: 'lump', rate: 500_000, curve: 'Month 0', notes: 'Contract price for the site, net of earnest money credited at closing' },
  { id: 'land-closing', section: 'land', label: 'Land Closing Costs, Title & Survey', basis: 'pctOfLand', rate: 0.05, curve: 'Month 0', notes: "PSA attorney $25,000, title $5,000, owner's policy $49/unit = $30,490" },
  { id: 'broker-fee', section: 'land', label: 'Broker Fee', basis: 'pctOfLand', rate: 0, curve: 'Month 0', notes: 'Zero when the sponsor sources the site directly' },
  { id: 'leaseback', section: 'land', label: 'Leaseback Proceeds', basis: 'leaseback', rate: 0, curve: 'Predevelopment', notes: 'Interim rent from the seller during predevelopment — none on this site' },
  { id: 'due-diligence', section: 'land', label: 'Due Diligence, Feasibility & Entitlement Legal', basis: 'lump', rate: 25_000, curve: 'Month 0', notes: 'Environmental (Phase I)' },
  // Hard costs
  { id: 'demo-site-prep', section: 'hard', label: 'Demolition & Site Preparation', basis: 'perUnit', rate: 0, curve: 'Construction' },
  { id: 'sitework', section: 'hard', label: 'Sitework, Utilities & Drainage', basis: 'lump', rate: 0, curve: 'Construction', notes: 'Carried inside the GC contract on this site' },
  { id: 'shell-core', section: 'hard', label: 'Building Shell & Core', basis: 'perGsf', rate: 120, curve: 'Construction', notes: 'GC contract — priced on gross building SF, which equals saleable SF for fee-simple townhomes' },
  { id: 'interior-finish', section: 'hard', label: 'Interior Finish-Out', basis: 'perUnit', rate: 5_000, curve: 'Construction', notes: 'FF&E $25,000, low voltage $10,000 and other hard-cost allowances $50,000' },
  { id: 'amenities', section: 'hard', label: 'Amenities, Site Features & Systems', basis: 'lump', rate: 50_000, curve: 'Construction', notes: 'Building-systems allowance $50,000, security & access control $17,500, monument & interior signage $15,000' },
  { id: 'parking-paving', section: 'hard', label: 'Parking & Paving', basis: 'perSpace', rate: 0, curve: 'Construction', notes: 'Garages are in the building shell' },
  { id: 'landscaping', section: 'hard', label: 'Landscaping, Hardscape & Fencing', basis: 'perUnit', rate: 0, curve: 'Construction' },
  { id: 'general-conditions', section: 'hard', label: 'General Conditions, Insurance & GC Fee', basis: 'pctOfDirectHard', rate: 0, curve: 'Construction', notes: 'Included in the GC contract price' },
  { id: 'hard-contingency', section: 'hard', label: 'Hard Cost Contingency', basis: 'pctOfHardBeforeContingency', rate: 0.05, curve: 'Construction', notes: 'Applied to direct hard costs plus general conditions' },
  // Soft costs
  { id: 'ae', section: 'soft', label: 'Architecture & Engineering', basis: 'pctOfHard', rate: 0.02, curve: 'Straight-Line', notes: 'Architecture, carried consultants and traffic engineering' },
  { id: 'civil', section: 'soft', label: 'Civil, Survey & Geotechnical', basis: 'lump', rate: 50_000, curve: 'Straight-Line', notes: 'Civil design & permitting $50,000, survey $7,500, geotech $7,500' },
  { id: 'permits', section: 'soft', label: 'Permits, Impact & Utility Fees', basis: 'perUnit', rate: 15_000, curve: 'Straight-Line', notes: 'Municipal & building permit $100,000, parkland $50,000, water/sewer impact $57,500, other municipal $50,000' },
  { id: 'legal', section: 'soft', label: 'Legal, Accounting & Organizational', basis: 'lump', rate: 50_000, curve: 'Straight-Line', notes: 'Contract legal $25,000, JV legal $25,000, tax prep & advisory $30,000' },
  { id: 'third-party', section: 'soft', label: 'Third-Party Reports, Testing & Inspections', basis: 'lump', rate: 100_000, curve: 'Straight-Line', notes: 'Special inspections $40,000, certification & plan review $10,000, landscape architect $10,000, reimbursables $10,000' },
  { id: 'builders-risk', section: 'soft', label: "Builder's Risk & General Liability Insurance", basis: 'pctOfHard', rate: 0, curve: 'Straight-Line' },
  { id: 'marketing', section: 'soft', label: 'Marketing, Sales & Model Home', basis: 'perUnit', rate: 2_000, curve: 'Straight-Line', notes: 'Pre-sales marketing through CO — ongoing sales costs are carry' },
  { id: 'ffe', section: 'soft', label: 'FF&E, Signage & Technology', basis: 'perUnit', rate: 0, curve: 'Delivery', notes: 'Carried in hard costs (Interior Finish-Out and Site Features) on this project' },
  { id: 'development-fee', section: 'soft', label: 'Development Fee', basis: 'pctOfHardAndSoft', rate: 0.05, curve: 'Straight-Line', notes: 'Paid to the sponsor over the construction period' },
  { id: 'soft-contingency', section: 'soft', label: 'Soft Cost Contingency', basis: 'pctOfSoft', rate: 0.1, curve: 'Straight-Line' },
  // Financing costs
  { id: 'origination-fee', section: 'financing', label: 'Construction Loan Origination Fee', basis: 'originationFee', rate: 0.005, curve: 'Month 0', notes: 'Links to the financing inputs' },
  { id: 'lender-inspections', section: 'financing', label: 'Lender Architect, Appraisal & Inspections', basis: 'lump', rate: 15_000, curve: 'Straight-Line', notes: "Lender's construction consultant $15,000, appraisal $2,500" },
  { id: 'lender-legal', section: 'financing', label: 'Lender Legal & Loan Closing Costs', basis: 'lump', rate: 15_000, curve: 'Month 0', notes: 'Financing legal $10,000, loan closing $5,000' },
  { id: 'rate-cap', section: 'financing', label: 'Interest Rate Cap', basis: 'lump', rate: 0, curve: 'Month 0', notes: 'Floating-rate loan — cap on SOFR at the strike. Zero if none' },
  { id: 'construction-interest', section: 'financing', label: 'Capitalized Construction Interest', basis: 'constructionInterest', rate: 0, curve: 'Month 0', notes: 'Interest paid current before the first closing. From the first closing it is paid from sales cash' },
  // Reserves & carry
  { id: 'startup', section: 'reserves', label: 'Start-Up & Sales Office Costs', basis: 'lump', rate: 25_000, curve: 'Delivery', notes: 'Model-home and sales-office setup at CO, before the first closing' },
  { id: 'capitalized-taxes', section: 'reserves', label: 'Real Estate Taxes — Model Year 1 (capitalized)', basis: 'capitalizedTaxes', rate: 0, curve: 'Month 0', notes: 'Year-1 assessment only; from the first closing, taxes on unsold homes are carry' },
  { id: 'working-capital', section: 'reserves', label: 'Working Capital / Sales Reserve', basis: 'lump', rate: 0, curve: 'Month 0', notes: 'Funded at close' },
];

const tenYears = (v: number, first = v) => [first, v, v, v, v, v, v, v, v, v];

export const TH_TEMPLATE_ASSUMPTIONS: ForSaleAssumptions = {
  kind: 'forSale',
  project: {
    name: 'Montierra Ph II',
    productType: 'Attached Townhome w/ Garage',
    location: 'Leander, TX',
    siteAcres: 0.916,
    parkingSpaces: 25,
    netToGross: 1,
  },
  schedule: {
    landClosingDate: '2025-12-31',
    predevMonths: 0,
    constructionMonths: 15,
    hardCostCurve: 'Custom',
    customCurve: [0.05, 0.05, 0.05, 0.05, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.1, ...new Array(21).fill(0)],
    firstCoMonth: 15,
    deliveryPace: 10,
    firstClosingMonth: 16,
    firstClosingUnits: 2,
    closingPace: 1,
  },
  plans: [
    { id: 'b1', code: 'B1', description: '2BD Townhome', beds: 2, baths: 2, count: 8, avgSf: 2000, basePsf: 235, notes: 'Attached townhome with garage' },
    { id: 'c1', code: 'C1', description: '3BD Townhome', beds: 3, baths: 2, count: 2, avgSf: 2000, basePsf: 250, notes: 'End units' },
  ],
  pricing: {
    method: 'Blended Average',
    commissionsPct: 0.06,
    litigationPct: 0.05,
    escrowPct: 0.05,
    sellerClosingPct: 0,
    incentivesPct: 0,
    warrantyPct: 0.005,
  },
  growth: {
    price: tenYears(0.03, 0),
    carry: tenYears(0.025, 0),
    tax: tenYears(0, 0),
    sofr: [0.0377, 0.0372, 0.0367, 0.0367, 0.0367, 0.0367, 0.0367, 0.0367, 0.0367, 0.0367],
  },
  carry: [
    { id: 'hoa', label: 'HOA Dues on Unsold Units', input: 0.35, basis: 'psfMo', notes: 'Developer pays HOA dues on every delivered unit it still owns' },
    { id: 'sales-marketing', label: 'Sales & Marketing', input: 325, basis: 'perUnitYr', notes: 'Ongoing advertising once closings begin; up-front marketing is a budget line' },
    { id: 'sales-center', label: 'Sales Center & Staffing', input: 8_000, basis: 'perMonthProject', notes: 'A project-level cost entered per month and spread over the units' },
    { id: 'maintenance', label: 'Unit Maintenance & Make-Ready', input: 350, basis: 'perUnitYr' },
    { id: 'utilities', label: 'Utilities & Security', input: 900, basis: 'perUnitYr' },
    { id: 'admin', label: 'General / Admin', input: 300, basis: 'perUnitYr' },
    { id: 'insurance', label: 'Insurance on Unsold Inventory', input: 650, basis: 'perUnitYr', notes: "Builder's risk ends at CO — this is the owner's policy on unsold homes" },
  ],
  taxes: {
    jurisdictions: [
      { id: 'isd', name: 'Leander ISD / Austin ISD', ratePer100: 0.8595, assessmentPct: 1 },
      { id: 'city', name: 'City', ratePer100: 0.4458, assessmentPct: 1 },
      { id: 'county', name: 'Travis County', ratePer100: 0.304655, assessmentPct: 1 },
      { id: 'appraisal', name: 'Appraisal District', ratePer100: 0, assessmentPct: 1 },
      { id: 'healthcare', name: 'Travis Co. Healthcare District', ratePer100: 0.100692, assessmentPct: 1 },
      { id: 'acc', name: 'ACC District', ratePer100: 0.0986, assessmentPct: 1 },
      { id: 'other', name: 'Other (MUD / ESD)', ratePer100: 0, assessmentPct: 1 },
    ],
    landAssessedValue: 500_000,
    improvementsPctOfHard: 0.9,
  },
  financing: {
    maxLtc: 0.6,
    ltcBasis: 'Total Project Cost',
    maxLoanToSellout: 0.65,
    rateType: 'Floating',
    fixedRate: 0.07,
    spread: 0.03,
    capStrike: 0,
    termMonths: 36,
    interestBudget: 'Circular',
    manualInterest: 58_255,
    fundingOrder: 'Equity First',
    originationFeePct: 0.005,
    releasePct: 1,
  },
  equity: {
    gpShare: 0.2,
    preferredReturn: 0.08,
    tier2Promote: 0.125,
    irrHurdle: 0.18,
    tier3Promote: 0.25,
  },
  budget,
};

/** A new for-sale case: the template's structure with every quantity and dollar zeroed. */
export function makeBlankForSale(name: string): ForSaleAssumptions {
  const a = structuredClone(TH_TEMPLATE_ASSUMPTIONS);
  a.project = { ...a.project, name, location: '', productType: '', siteAcres: 0, parkingSpaces: 0 };
  a.plans = a.plans.map((p) => ({ ...p, count: 0, avgSf: 0, basePsf: 0 }));
  a.budget = a.budget.map((l) =>
    l.basis === 'lump' || l.basis === 'perUnit' || l.basis === 'perGsf' || l.basis === 'perSpace' ? { ...l, rate: 0 } : l,
  );
  a.carry = a.carry.map((c) => ({ ...c, input: 0 }));
  a.taxes.landAssessedValue = 0;
  a.financing.manualInterest = 0;
  return a;
}
