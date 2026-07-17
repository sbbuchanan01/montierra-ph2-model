import { addMonths, pmt, ppmt, xirr } from './finance';
import { CURVE_TEMPLATES, sofrAtMonth } from './curves';
import { categoryForCode } from './costData';
import { runWaterfall } from './waterfall';
import type {
  AnnualSummaryRow,
  Assumptions,
  BudgetRow,
  ModelOutput,
  MonthlyRow,
  OperatingYieldCol,
  TaxYearRow,
} from './types';

const sum = (arr: number[]) => arr.reduce((a, v) => a + v, 0);

interface TimingSpec {
  phasing: 'lump' | 'spread' | 'curve' | 'computed';
  start: number;
  end: number;
}

/**
 * Full model run — an ordered pipeline with a fixed-point loop around the
 * financing solve, mirroring the workbook's iterative-calculation circularity
 * (interest and fees are project costs; costs size the loan; the loan accrues
 * the interest).
 */
export function runModel(a: Assumptions): ModelOutput {
  /* ------------------------- Derived fundamentals ------------------------ */
  const units = sum(a.unitMix.map((u) => u.count));
  const nrsf = sum(a.unitMix.map((u) => u.count * u.avgSf));
  const retailSf = sum(a.retail.tenants.map((t) => t.sf));
  const totalMonthlyRent = sum(a.unitMix.map((u) => u.count * u.avgSf * u.rentPsf));
  const avgRent = units > 0 ? totalMonthlyRent / units : 0;

  const N = a.schedule.totalMonths;
  const LC = a.schedule.landClosingMonth;
  const SS = a.schedule.softCostStartMonth;
  const HS = SS; // hard costs start with soft costs (Project Summary D24 = D23)
  const LU = a.schedule.leaseUpStartMonth;
  const SALE = a.schedule.saleMonth;

  const curve =
    a.constructionCurve.selected === 'Custom'
      ? a.constructionCurve.customCurve
      : [...CURVE_TEMPLATES[a.constructionCurve.selected]];
  const CE = HS + curve.length - 1; // construction end (Project Summary F24)

  const analysisStart = new Date(a.project.analysisStart + 'T00:00:00Z');
  const dates: Date[] = [];
  for (let m = 1; m <= N; m++) dates.push(addMonths(analysisStart, m - 1));

  const yearOf = (m: number) => Math.ceil(m / 12);
  const NY = Math.ceil(N / 12);

  /* --------------------- Stage 4 first: lease-up & ops ------------------- */
  // Ops are independent of financing, so compute them before the iterative
  // solve (interest-shortfall capitalization needs the MF ops cash flow).

  const leased: number[] = new Array(N + 1).fill(0);
  const occ: number[] = new Array(N + 1).fill(0);
  const opMonth: number[] = new Array(N + 1).fill(0);
  for (let m = 1; m <= N; m++) {
    if (m === LU) leased[m] = Math.min(a.leasing.leasesSignedAtCO, units);
    else if (m > LU) leased[m] = Math.min(leased[m - 1] + a.leasing.monthlyAbsorption, units);
    occ[m] = units > 0 ? leased[m] / units : 0;
    opMonth[m] = occ[m] > 0 ? opMonth[m - 1] + 1 : 0;
  }

  // Lease-up finish: first month occupancy strictly exceeds the threshold
  // (Project Summary F26 array formula uses ">" against S22).
  let LUF = LU;
  for (let m = 1; m <= N; m++) {
    if (occ[m] > a.leasing.stabilizationOccupancy) {
      LUF = m;
      break;
    }
  }

  // Trended rent table (years 1..10) compounding off prior year.
  const trendedRent: number[] = new Array(11).fill(0);
  trendedRent[1] = avgRent;
  for (let y = 2; y <= 10; y++) trendedRent[y] = trendedRent[y - 1] * (1 + (a.rentGrowth[y - 1] ?? 0));
  const year9Rate = a.rentGrowth[8] ?? 0; // Monthly PF compounds at AC20/12 beyond the table

  // Monthly PF market rent (row 140) and Lease-Up CF market rent (row 26).
  const rentMpf: number[] = new Array(N + 1).fill(0);
  const rentLu: number[] = new Array(N + 1).fill(0);
  for (let m = 1; m <= N; m++) {
    const y = yearOf(m);
    rentMpf[m] = y <= 9 ? trendedRent[y] : rentMpf[m - 1] * (1 + year9Rate / 12);
    rentLu[m] = y <= 10 ? trendedRent[y] : rentLu[m - 1];
  }

  const ig = a.otherIncome.incomeGrowthPct;
  const eg = a.leasing.expenseGrowthPct;
  const concessionFactor = a.leasing.leaseUpConcessionWeeks / 52;
  const mfParkingSpaces = a.parking.totalSpaces - a.parking.retailSpaces - a.parking.guestAdaSpaces;
  const rentedSpaces = Math.floor(mfParkingSpaces * a.parking.pctOfSpacesRented);
  const storageMonthly = a.storage.rentPerSpaceMonth * a.storage.spaces;

  interface Ops {
    pgr: number;
    leaseVac: number;
    egr: number;
    leaseConc: number;
    stabConc: number;
    ltl: number;
    adminU: number;
    ner: number;
    stabVac: number;
    collLoss: number;
    nri: number;
    rubs: number;
    adminFees: number;
    petFee: number;
    petRent: number;
    wifi: number;
    trash: number;
    pest: number;
    storage: number;
    parking: number;
    totalOther: number;
    totalIncome: number;
    salary: number;
    marketing: number;
    leasingComm: number;
    rm: number;
    turnover: number;
    contract: number;
    utilities: number;
    ga: number;
    ctrl: number;
    propTax: number;
    mgmt: number;
    insurance: number;
    nonCtrl: number;
    totalExp: number;
    reserves: number;
    mfOpsCf: number;
    retailNoi: number;
    retailIncome: number;
    retailExp: number;
    retailCf: number;
    combinedOps: number;
  }
  const ops: Ops[] = new Array(N + 1);

  // Property taxes need the stabilized-tax table, which needs annual EGI /
  // expenses excluding property tax — so run ops in two passes.
  const preTax: {
    totalIncome: number;
    ctrlPlusIns: number;
  }[] = new Array(N + 1);

  const escInc = (m: number) => Math.pow(1 + ig, yearOf(m) - 1);
  const escExp = (m: number) => Math.pow(1 + eg, yearOf(m) - 1);

  for (let m = 1; m <= N; m++) {
    const o = occ[m];
    const active = opMonth[m] > 0;
    const newLeases = m === 1 ? leased[m] : leased[m] - leased[m - 1];

    const pgr = rentMpf[m] * units;
    const leaseVac = -pgr * (1 - o);
    const egr = pgr + leaseVac;
    // Haircuts are computed off the Lease-Up CF engine's EGR (rent from its own
    // rent path — identical through year 10, flat thereafter).
    const egrLu = rentLu[m] * units * o;
    const below = o < a.leasing.stabilizationOccupancy;
    const leaseConc = active && below ? -concessionFactor * egrLu : 0;
    const stabConc = active && !below ? -a.leasing.stabilizedConcessionsPct * egrLu : 0;
    const ltl = active && !below ? -a.leasing.lossToLeasePct * egrLu : 0;
    const adminU = active && !below ? -a.leasing.adminUnitsPct * egrLu : 0;
    const ner = egr + leaseConc + stabConc + ltl + adminU;
    const stabVac = active && !below ? -a.leasing.stabilizedVacancyPct * egrLu : 0;
    const collLoss = active && !below ? -a.leasing.collectionLossPct * egrLu : 0;
    const nri = ner + stabVac + collLoss;

    // Controllable expenses ($/unit/yr, some occupancy-scaled), Lease-Up rates.
    const perUnit = (rate: number, occScaled = false) =>
      active ? ((rate * units * (occScaled ? o : 1)) * escExp(m)) / 12 : 0;
    const salary = perUnit(a.opex.payroll);
    const marketing = perUnit(a.opex.marketing);
    const leasingComm = perUnit(a.opex.leasingCommissions);
    const rm = perUnit(a.opex.repairsMaintenance, true);
    const turnover = perUnit(a.opex.turnover, true);
    const contract = perUnit(a.opex.contractServices);
    const utilities = perUnit(a.opex.utilities, true);
    const ga = perUnit(a.opex.generalAdmin);
    const ctrl = salary + marketing + leasingComm + rm + turnover + contract + utilities + ga;

    // Other income (Lease-Up CF rows 41-49).
    const rubs = active ? utilities * a.otherIncome.rubsPctOfUtilities * o : 0;
    const turnoverLeases =
      leased[m] === units ? a.leasing.monthlyAbsorption * a.otherIncome.turnoverPct : 0;
    const adminFees = active
      ? (a.otherIncome.adminFeePerLease * newLeases + a.otherIncome.adminFeePerLease * turnoverLeases) * escInc(m)
      : 0;
    const petFee = active
      ? (a.otherIncome.petFeePerLease * newLeases + a.otherIncome.petFeePerLease * turnoverLeases) * escInc(m)
      : 0;
    const petRent = active
      ? a.otherIncome.petRentPerMonth * units * o * a.otherIncome.petRenterPct * escInc(m)
      : 0;
    const wifi = active ? a.otherIncome.bulkWifiPerUnitMonth * units * o * escInc(m) : 0;
    const trash = active ? a.otherIncome.trashPerUnitMonth * units * o * escInc(m) : 0;
    const pest = active ? a.otherIncome.pestPerUnitMonth * units * o * escInc(m) : 0;
    const storage = active ? storageMonthly * o * escInc(m) : 0;
    const parking = active ? a.parking.ratePerSpaceMonth * rentedSpaces * o * escInc(m) : 0;
    const totalOther = rubs + adminFees + petFee + petRent + wifi + trash + pest + storage + parking;
    const totalIncome = nri + totalOther;

    const mgmt = active
      ? Math.max(totalIncome * a.opex.mgmtFeePct, a.opex.mgmtFeeFloorPerMonth)
      : 0;
    const insurance = m >= LU ? ((a.opex.insurance * units) * escExp(m)) / 12 : 0;
    const reserves = leased[m] > 0 ? -((a.opex.capitalReserves * units) * escExp(m)) / 12 : 0;

    preTax[m] = { totalIncome, ctrlPlusIns: ctrl + mgmt + insurance };
    ops[m] = {
      pgr, leaseVac, egr, leaseConc, stabConc, ltl, adminU, ner, stabVac, collLoss, nri,
      rubs, adminFees, petFee, petRent, wifi, trash, pest, storage, parking, totalOther,
      totalIncome, salary, marketing, leasingComm, rm, turnover, contract, utilities, ga,
      ctrl, propTax: 0, mgmt, insurance, nonCtrl: 0, totalExp: 0, reserves, mfOpsCf: 0,
      retailNoi: 0, retailIncome: 0, retailExp: 0, retailCf: 0, combinedOps: 0,
    };
  }

  /* --------------------- Stage 1-2: cost budget build-up ------------------ */
  const gcContractTotal = sum(
    a.costs.lineItems
      .filter((i) => i.code === '200202')
      .map((i) => (i.amountType === 'perUnit' ? i.value * units : i.value)),
  );
  const retailTiAmount = retailSf * (a.retail.tenants[0]?.tiPsf ?? 0) * 0; // TI = sum sf*tiPsf
  const retailTi = sum(a.retail.tenants.map((t) => t.sf * t.tiPsf));
  void retailTiAmount;

  const itemAmount = (i: Assumptions['costs']['lineItems'][number]): number => {
    switch (i.amountType) {
      case 'fixed':
        return i.value;
      case 'perUnit':
        return i.value * units;
      case 'hardCostContingencyPct':
        return a.costs.hardCostContingencyPct * gcContractTotal;
      case 'computed':
        if (i.id === 'retail-ti') return retailTi;
        return 0; // engine fills these later
    }
  };

  // Amount per budget row (cost code), Development Budget structure.
  const amountByCode = new Map<string, number>();
  for (const item of a.costs.lineItems) {
    amountByCode.set(item.code, (amountByCode.get(item.code) ?? 0) + itemAmount(item));
  }

  const timingByCode = (code: string): TimingSpec => {
    const spread = (start: number, end: number): TimingSpec => ({ phasing: 'spread', start, end });
    const lump = (m: number): TimingSpec => ({ phasing: 'lump', start: m, end: m });
    switch (code) {
      case '100101':
      case '100102':
      case '100103':
        return lump(LC);
      case '200201':
        return spread(HS, HS + 2);
      case '200202':
        return { phasing: 'curve', start: HS, end: CE };
      case '200205':
        return spread(CE - 3, CE);
      case '200207':
      case '200208':
        return spread(LU - 3, CE);
      case '200210':
        return spread(LU - 6, CE);
      case '200211':
        return spread(CE - 9, CE);
      case '300306':
      case '300308':
      case '300313':
        return spread(SS, HS + 5);
      case '400401':
        return spread(SS, 3);
      case '400402':
      case '400403':
        return spread(LU, CE); // start after end in the base case => no draws (as in the workbook)
      case '400404':
        return lump(SALE);
      case '400405':
        return spread(CE - 2, CE);
      case '400410':
        return spread(CE - 4, CE);
      case '400411':
        return spread(LU - 3, LUF);
      case '500501':
        return lump(LC);
      case '500502a':
      case '500502b':
        return spread(CE, CE);
      case '600607':
      case '600608':
      case '600612':
      case '600616':
      case '600617':
        return lump(LC);
      case '600614':
        return { phasing: 'computed', start: 0, end: 0 }; // external construction interest
      case '600615':
        return { phasing: 'computed', start: LC, end: LC }; // origination fee (lump at land closing)
      case '700701':
        return spread(CE - 4, CE);
      case '700702':
      case '700703':
        return { phasing: 'computed', start: 0, end: 0 };
      case '700704':
      case '700705':
        return spread(LU, CE);
      case '800805':
      case '800810':
        return lump(LC);
      case '800806':
        return spread(HS, CE);
      case '800807':
        return { phasing: 'computed', start: 0, end: 0 }; // project contingency
      case '800811':
        return spread(LC, LUF);
      default: {
        // hard costs default HS..CE; everything else LC/SS..CE
        if (code.startsWith('2002')) return spread(HS, CE);
        if (code.startsWith('3003')) return spread(SS, CE);
        if (code.startsWith('4004')) return spread(SS, CE);
        return spread(LC, CE);
      }
    }
  };

  const rowLabelByCode: Record<string, string> = {};
  for (const item of a.costs.lineItems) {
    if (!rowLabelByCode[item.code]) rowLabelByCode[item.code] = item.group;
  }

  // Static (non-computed) budget rows with monthly draw schedules.
  const budgetRows: BudgetRow[] = [];
  const codes = [...amountByCode.keys()];
  for (const code of codes) {
    const timing = timingByCode(code);
    const amount = amountByCode.get(code) ?? 0;
    const monthly = new Array<number>(N).fill(0);
    if (timing.phasing === 'lump') {
      if (timing.start >= 1 && timing.start <= N) monthly[timing.start - 1] = amount;
    } else if (timing.phasing === 'spread') {
      const span = timing.end - timing.start + 1;
      if (span > 0) {
        for (let m = timing.start; m <= timing.end; m++) {
          if (m >= 1 && m <= N) monthly[m - 1] = amount / span;
        }
      }
    } else if (timing.phasing === 'curve') {
      for (let k = 0; k < curve.length; k++) {
        const m = HS + k;
        if (m >= 1 && m <= N) monthly[m - 1] = (curve[k] / 100) * gcContractTotal;
      }
    }
    budgetRows.push({
      key: code,
      code,
      category: categoryForCode(code.replace(/[ab]$/, '')),
      label: rowLabelByCode[code] ?? code,
      amount,
      perUnit: units > 0 ? amount / units : 0,
      perNrsf: nrsf > 0 ? amount / nrsf : 0,
      pctOfTotal: 0,
      startMonth: timing.start,
      finishMonth: timing.end,
      phasing: timing.phasing,
      monthly,
    });
  }

  const gcDraws = budgetRows.find((r) => r.code === '200202')!.monthly;

  /* ------------------ Stage 6 (property tax, pre-solve) ------------------ */
  const effTaxRate = sum(a.taxes.jurisdictions.map((j) => j.millageRate)) / 100;
  const landValue = sum(
    a.costs.lineItems
      .filter((i) => i.code === '100101')
      .map((i) => itemAmount(i)),
  );

  const gcByYear = new Array<number>(NY + 1).fill(0);
  for (let m = 1; m <= N; m++) gcByYear[yearOf(m)] += gcDraws[m - 1];

  const roundHalfUp = (v: number) => Math.round(v);
  const luYearRounded = roundHalfUp(LU / 12); // ROUND(D26/12, 0)

  const taxYears: TaxYearRow[] = [];
  let cumImprove = 0;
  let stabYearPrev = 0;
  const stabTaxesByOpYear = new Map<number, number>();
  const constructionTvByYear: number[] = new Array(NY + 1).fill(0);
  const projectTvByYear: number[] = new Array(NY + 1).fill(0);
  const interimByYear: number[] = new Array(NY + 1).fill(0);

  // First pass: construction taxable values + interim taxes + stabilized taxes.
  const egiByYear = new Array<number>(NY + 1).fill(0);
  const ctrlInsByYear = new Array<number>(NY + 1).fill(0);
  for (let m = 1; m <= N; m++) {
    egiByYear[yearOf(m)] += preTax[m].totalIncome;
    ctrlInsByYear[yearOf(m)] += preTax[m].ctrlPlusIns;
  }

  for (let y = 1; y <= Math.min(NY, 11); y++) {
    cumImprove += gcByYear[y] ?? 0;
    const stabYear = y * 12 < LUF ? 0 : stabYearPrev + 1;
    stabYearPrev = stabYear;
    const opYear = y < luYearRounded ? 0 : y - luYearRounded;
    const tvConstruction = landValue + cumImprove * a.taxes.assessmentRatio;
    constructionTvByYear[y] = tvConstruction;
    const interim = stabYear <= 1 ? tvConstruction * effTaxRate : 0;
    interimByYear[y] = interim;

    // Taxes!L37 looks up Annual PF reserves (escalated $/unit/yr) by operation year.
    const reservesForTax =
      opYear >= 1 ? a.opex.capitalReserves * units * Math.pow(1 + eg, opYear - 1) : 0;
    const noiBeforeTax = egiByYear[y] - ctrlInsByYear[y] - reservesForTax;
    const incomeTv = noiBeforeTax / (a.taxes.mfBaseCapRate + effTaxRate);
    const stabilizedTv = Math.max(tvConstruction, incomeTv);
    const stabilizedTaxes = stabilizedTv * effTaxRate;
    stabTaxesByOpYear.set(opYear, stabilizedTaxes);
    projectTvByYear[y] = opYear <= 1 ? tvConstruction : incomeTv;

    taxYears.push({
      analysisYear: y,
      stabilizationYear: stabYear,
      operationYear: opYear,
      improvementsAccrued: cumImprove,
      taxableValueConstruction: tvConstruction,
      taxesDueDuringConstruction: interim,
      noiBeforeTax,
      incomeApproachValue: incomeTv,
      stabilizedTaxableValue: stabilizedTv,
      stabilizedTaxesDue: stabilizedTaxes,
      taxableNoi: 0,
      depreciation: 0,
      interestExpense: 0,
      taxableIncome: 0,
      stateTaxDue: 0,
    });
  }

  // Second pass on ops: monthly property tax + totals.
  let lastPropTaxAnnual = 0;
  for (let m = 1; m <= N; m++) {
    const o = ops[m];
    const y = yearOf(m);
    const opYear = Math.ceil(opMonth[m] / 12);
    let propTax = 0;
    if (leased[m] > 0) {
      if (y <= 10) {
        lastPropTaxAnnual = stabTaxesByOpYear.get(opYear) ?? 0;
        propTax = lastPropTaxAnnual / 12;
      } else {
        propTax = lastPropTaxAnnual / 12;
      }
    }
    o.propTax = propTax;
    o.nonCtrl = propTax + o.mgmt + o.insurance;
    o.totalExp = o.ctrl + o.nonCtrl;
    o.mfOpsCf = o.totalIncome - o.totalExp;
    // Retail is fully parallel but zero for this deal; guard divide-by-zero.
    o.retailIncome = 0;
    o.retailExp = 0;
    o.retailNoi = 0;
    o.retailCf = m >= SALE ? 0 : o.retailNoi;
    o.combinedOps = o.mfOpsCf + o.retailCf;
  }

  const interimMonthly = new Array<number>(N).fill(0);
  for (let m = 1; m <= N; m++) interimMonthly[m - 1] = (interimByYear[yearOf(m)] ?? 0) / 12;

  const carryingMonthly = new Array<number>(N).fill(0);
  for (let m = 1; m <= N; m++) {
    if (opMonth[m] > 0 && m < SALE) {
      const o = ops[m];
      carryingMonthly[m - 1] =
        (o.retailCf < 0 ? -o.retailCf : 0) + (o.mfOpsCf < 0 ? -o.mfOpsCf : 0);
    }
  }

  /* ---------------- Stage 3: iterative capital-structure solve ----------- */
  const staticMonthly = new Array<number>(N).fill(0);
  const contingencyBaseStatic = new Array<number>(N).fill(0);
  const isGa = (code: string) => code.startsWith('8008');
  const isLandAcq = (code: string) => code === '100101';
  for (const row of budgetRows) {
    for (let i = 0; i < N; i++) {
      staticMonthly[i] += row.monthly[i];
      if (!isGa(row.code) && !isLandAcq(row.code)) contingencyBaseStatic[i] += row.monthly[i];
    }
  }
  const staticTotal = sum(staticMonthly);

  const fin = a.financing.construction;
  const contingencyPct = a.costs.projectContingencyPct;

  let totalCost = staticTotal;
  let iterations = 0;
  let converged = false;

  // Per-month results captured from the final iteration.
  let loanAmount = 0;
  let equityCommitment = 0;
  let originationFee = 0;
  let firstDrawMonth = 0;
  const interest = new Array<number>(N).fill(0);
  const principal = new Array<number>(N).fill(0);
  const balloon = new Array<number>(N).fill(0);
  const beginBal = new Array<number>(N).fill(0);
  const endBal = new Array<number>(N).fill(0);
  const rateArr = new Array<number>(N).fill(0);
  const shortfall = new Array<number>(N).fill(0);
  const contingency = new Array<number>(N).fill(0);
  const capex = new Array<number>(N).fill(0);
  const equityDraw = new Array<number>(N).fill(0);
  const loanDraw = new Array<number>(N).fill(0);
  // Refinance loan schedule
  const refiDraw = new Array<number>(N).fill(0);
  const refiInterest = new Array<number>(N).fill(0);
  const refiPrincipal = new Array<number>(N).fill(0);
  const refiBalloon = new Array<number>(N).fill(0);
  const refiBegin = new Array<number>(N).fill(0);
  const refiEnd = new Array<number>(N).fill(0);
  let refiProceeds = 0;
  let refiLtvC = 0;
  let refiDscrC = 0;
  let refiDyC = 0;
  let refiImplied = 0;
  let refiNoi = 0;

  const refi = a.financing.refinance;
  const monthlyRate = (m: number) =>
    fin.rateType === 'Fixed'
      ? fin.indexRate + fin.spread
      : (fin.useForwardCurve ? sofrAtMonth(m) : fin.indexRate) + fin.spread;

  for (let iter = 0; iter < 80; iter++) {
    iterations = iter + 1;
    loanAmount = fin.ltc * totalCost;
    equityCommitment = totalCost - loanAmount;
    originationFee = fin.originationFeePct * loanAmount;

    // Refinance sizing (independent of the draw pass; NOI is ops-only).
    if (refi.enabled) {
      refiNoi = 0;
      for (let m = refi.refinanceMonth + 1; m <= Math.min(refi.refinanceMonth + 12, N); m++) {
        refiNoi += ops[m].combinedOps;
      }
      refiImplied = refi.capRate > 0 ? refiNoi / refi.capRate : 0;
      const refiRate = refi.indexRate + refi.spread;
      const annualPmtPerDollar = -pmt(refiRate / 12, refi.amortYears * 12, 1) * 12;
      refiLtvC = Math.round((refi.ltv * refiImplied) / 10_000) * 10_000;
      refiDscrC = Math.round(refiNoi / refi.dscr / annualPmtPerDollar / 10_000) * 10_000;
      refiDyC = Math.round(refiNoi / refi.debtYield / 10_000) * 10_000;
      refiProceeds = Math.min(refiLtvC, refiDscrC, refiDyC);
    } else {
      refiProceeds = 0;
    }

    let cumEquity = 0;
    let bal = 0;
    let loanMonths = 0;
    firstDrawMonth = 0;
    let refiBal = 0;
    let refiMonths = 0;

    for (let m = 1; m <= N; m++) {
      const i = m - 1;
      // Construction loan interest on beginning balance.
      beginBal[i] = bal;
      rateArr[i] = monthlyRate(m);
      interest[i] = (rateArr[i] / 12) * bal;

      // External construction interest cost (Monthly PF row 90).
      const mfCf = ops[m].mfOpsCf;
      let sf = 0;
      if (m < SALE) {
        if (mfCf > interest[i]) sf = 0;
        else if (mfCf > 0) sf = interest[i] - mfCf;
        else sf = interest[i];
      }
      shortfall[i] = sf;

      // Project contingency (2% of this month's qualifying draws, construction only).
      const feeThisMonth = m === LC ? originationFee : 0;
      const baseThisMonth =
        contingencyBaseStatic[i] + interimMonthly[i] + carryingMonthly[i] + feeThisMonth + sf;
      contingency[i] = m <= CE ? contingencyPct * baseThisMonth : 0;

      capex[i] =
        staticMonthly[i] + interimMonthly[i] + carryingMonthly[i] + feeThisMonth + sf + contingency[i];

      // Equity-first capitalization.
      equityDraw[i] = Math.min(capex[i], Math.max(0, equityCommitment - cumEquity));
      cumEquity += equityDraw[i];
      loanDraw[i] = capex[i] - equityDraw[i];
      if (loanDraw[i] > 1e-9 && firstDrawMonth === 0) firstDrawMonth = m;

      // Principal (I/O until ioMonths of loan age; floating re-amortizes).
      if (bal > 0) loanMonths += 1;
      let prin = 0;
      if (bal > 0 && loanMonths > fin.ioMonths) {
        const amortMonth = loanMonths - fin.ioMonths;
        prin =
          fin.rateType === 'Floating'
            ? ppmt(rateArr[i] / 12, 1, fin.amortYears * 12 - amortMonth + 1, -bal)
            : ppmt((fin.indexRate + fin.spread) / 12, amortMonth, fin.amortYears * 12, -loanAmount);
      }
      principal[i] = prin;

      const afterDraw = bal + loanDraw[i] - prin;
      const payoffMonth =
        firstDrawMonth > 0
          ? firstDrawMonth + fin.termMonths + fin.extension1Months + fin.extension2Months
          : Infinity;
      const refiPayoff = refi.enabled && refiProceeds > 0 && m === refi.refinanceMonth;
      if ((m === SALE || m >= payoffMonth || refiPayoff) && afterDraw > 0) {
        balloon[i] = afterDraw;
        bal = 0;
      } else {
        balloon[i] = 0;
        bal = afterDraw;
      }
      endBal[i] = bal;

      // Refinance loan.
      refiBegin[i] = refiBal;
      refiDraw[i] = refi.enabled && m === refi.refinanceMonth ? refiProceeds : 0;
      const refiRateM = (refi.indexRate + refi.spread) / 12;
      refiInterest[i] = refiRateM * refiBal;
      if (refiBal > 0) refiMonths += 1;
      let rprin = 0;
      if (refiBal > 0 && refiMonths > refi.ioMonths) {
        const am = refiMonths - refi.ioMonths;
        rprin = ppmt(refiRateM, am, refi.amortYears * 12, -refiProceeds);
      }
      refiPrincipal[i] = rprin;
      const refiAfter = refiBal + refiDraw[i] - rprin;
      const refiMaturity = refi.enabled ? refi.refinanceMonth + refi.termMonths : Infinity;
      if ((m === SALE || m >= refiMaturity) && refiAfter > 0) {
        refiBalloon[i] = refiAfter;
        refiBal = 0;
      } else {
        refiBalloon[i] = 0;
        refiBal = refiAfter;
      }
      refiEnd[i] = refiBal;
    }

    const newTotal =
      staticTotal +
      originationFee +
      sum(shortfall) +
      sum(interimMonthly) +
      sum(carryingMonthly) +
      sum(contingency);

    if (Math.abs(newTotal - totalCost) < 0.005) {
      totalCost = newTotal;
      converged = true;
      break;
    }
    totalCost = newTotal;
  }

  const equityPaydown = refi.enabled ? refiProceeds - loanAmount : 0;
  const totalNet = totalCost - equityPaydown;

  /* --------------------------- Stage 7: sale ----------------------------- */
  let fwdNoiMf = 0;
  let fwdNoiRetail = 0;
  for (let m = SALE; m < SALE + 12 && m <= N; m++) {
    fwdNoiMf += ops[m].totalIncome - ops[m].totalExp;
    fwdNoiRetail += ops[m].retailNoi;
  }
  const mfSalePrice = a.exit.mfCapRate > 0 ? fwdNoiMf / a.exit.mfCapRate : 0;
  const retailSalePrice =
    retailSf > 0 && a.exit.retailCapRate > 0 ? fwdNoiRetail / a.exit.retailCapRate : 0;
  const closingCosts = -(mfSalePrice + retailSalePrice) * a.exit.closingCostPct;

  /* --------------- Stage 6b: income tax build (inert stub) ---------------- */
  const interestByYear = new Array<number>(NY + 1).fill(0);
  for (let m = 1; m <= N; m++) interestByYear[yearOf(m)] += interest[m - 1];
  let cumCapCosts = 0;
  const saleYear = Math.ceil(SALE / 12);
  let totalStateTax = 0;
  for (const ty of taxYears) {
    const y = ty.analysisYear;
    let noi = 0;
    for (let m = (y - 1) * 12 + 1; m <= Math.min(y * 12, 120); m++) {
      if (m <= N && Math.ceil(m / 12) <= saleYear) noi += ops[m].combinedOps;
    }
    if (y > saleYear) noi = 0;
    ty.taxableNoi = noi;
    ty.interestExpense = interestByYear[y] ?? 0;
    if (noi === 0) cumCapCosts += ty.interestExpense;
    ty.depreciation = y >= 4 && y * 12 <= SALE ? -cumCapCosts / a.taxes.depreciationYears : 0;
    ty.taxableIncome = noi === 0 ? 0 : noi - ty.interestExpense + ty.depreciation;
    // Gain from Sale: intentionally a $0 stub. The source workbook's formula
    // references a deleted Project Summary cell (silently 0 via IFERROR) and
    // its surviving logic is conceptually wrong; TX state rate is 0 so the
    // real-world impact is zero. See the build brief §1.2.
    ty.stateTaxDue = Math.max(ty.taxableIncome, 0) * a.taxes.stateTaxRate;
    totalStateTax += ty.stateTaxDue;
  }
  const stateTaxOnSale = 0; // gain-on-sale stub
  void totalStateTax;

  const saleProceedsRow = new Array<number>(N).fill(0);
  if (SALE >= 1 && SALE <= N) {
    saleProceedsRow[SALE - 1] = mfSalePrice + retailSalePrice + closingCosts + stateTaxOnSale;
  }

  const stateTaxMonthly = new Array<number>(N).fill(0);
  for (const ty of taxYears) {
    const m = ty.analysisYear * 12; // Taxes AA12: charged in month year*12
    if (m >= 1 && m <= N) stateTaxMonthly[m - 1] = -ty.stateTaxDue;
  }

  /* ---------------- Stage 5: monthly assembly + equity CF ----------------- */
  const cashToEquity = new Array<number>(N).fill(0);
  const projectCf = new Array<number>(N).fill(0);
  for (let m = 1; m <= N; m++) {
    const i = m - 1;
    let cf = 0;
    if (m <= SALE) {
      cf =
        saleProceedsRow[i] +
        refiDraw[i] -
        principal[i] -
        refiInterest[i] -
        refiPrincipal[i] +
        carryingMonthly[i] -
        interest[i] +
        shortfall[i] +
        ops[m].combinedOps +
        stateTaxMonthly[i] -
        balloon[i] -
        refiBalloon[i];
    }
    cashToEquity[i] = cf;
    // Monthly PF E218 seeds month 1 with "-1-E217-E119" (a $1 XIRR seed).
    projectCf[i] = m === 1 ? -1 - cf - equityDraw[i] : cf - equityDraw[i];
  }

  const totalEquityInvested = sum(equityDraw);
  const distributions120 = sum(cashToEquity.slice(0, 120));
  const projectMoic = totalEquityInvested > 0 ? distributions120 / totalEquityInvested : 0;
  const projectXirr = xirr(projectCf, dates);

  const loanBalanceRetired = sum(balloon) + sum(refiBalloon);
  const netSaleProceeds =
    mfSalePrice + retailSalePrice + closingCosts + stateTaxOnSale - loanBalanceRetired;

  /* -------------------------- Stage 8: waterfall -------------------------- */
  const gpEquity = equityCommitment * a.waterfall.gpOwnershipPct;
  const lpEquity = equityCommitment - gpEquity;
  const waterfall = runWaterfall(projectCf, dates, lpEquity, gpEquity, a.waterfall);

  /* ----------------------- Monthly rows for the UI ------------------------ */
  const monthly: MonthlyRow[] = [];
  for (let m = 1; m <= N; m++) {
    const i = m - 1;
    const o = ops[m];
    monthly.push({
      month: m,
      date: dates[i].toISOString().slice(0, 10),
      analysisYear: yearOf(m),
      operationMonth: opMonth[m],
      operationYear: Math.ceil(opMonth[m] / 12),
      capex: capex[i],
      equityDraw: equityDraw[i],
      loanDraw: loanDraw[i],
      loanBeginBalance: beginBal[i],
      loanInterest: interest[i],
      loanPrincipal: principal[i],
      loanBalloon: balloon[i],
      loanEndBalance: endBal[i],
      loanRate: rateArr[i],
      refiDraw: refiDraw[i],
      refiBeginBalance: refiBegin[i],
      refiInterest: refiInterest[i],
      refiPrincipal: refiPrincipal[i],
      refiBalloon: refiBalloon[i],
      refiEndBalance: refiEnd[i],
      leasedUnits: leased[m],
      occupancy: occ[m],
      marketRent: rentMpf[m],
      potentialGrossRent: o.pgr,
      leaseUpVacancy: o.leaseVac,
      effectiveGrossRent: o.egr,
      leaseUpConcessions: o.leaseConc,
      stabilizedConcessions: o.stabConc,
      lossToLease: o.ltl,
      adminUnits: o.adminU,
      netEffectiveRents: o.ner,
      stabilizedVacancy: o.stabVac,
      collectionLoss: o.collLoss,
      netRentalIncome: o.nri,
      rubs: o.rubs,
      adminFees: o.adminFees,
      petFee: o.petFee,
      petRent: o.petRent,
      bulkWifi: o.wifi,
      trash: o.trash,
      pest: o.pest,
      storageIncome: o.storage,
      parkingIncome: o.parking,
      totalOtherIncome: o.totalOther,
      totalIncome: o.totalIncome,
      salary: o.salary,
      marketingExp: o.marketing,
      leasingCommissionsExp: o.leasingComm,
      repairsMaintenance: o.rm,
      turnoverExp: o.turnover,
      contractServices: o.contract,
      utilities: o.utilities,
      generalAdmin: o.ga,
      propertyTaxes: o.propTax,
      managementFees: o.mgmt,
      insurance: o.insurance,
      totalExpenses: o.totalExp,
      capitalReserves: o.reserves,
      mfCashFlowFromOps: o.mfOpsCf,
      retailOccupancy: 0,
      retailIncome: o.retailIncome,
      retailExpenses: o.retailExp,
      retailNoi: o.retailNoi,
      retailCashFlow: o.retailCf,
      combinedOpsCashFlow: o.combinedOps,
      interestShortfallCost: shortfall[i],
      carryingCost: carryingMonthly[i],
      interimTaxCost: interimMonthly[i],
      contingencyCost: contingency[i],
      saleProceeds: saleProceedsRow[i],
      stateTax: stateTaxMonthly[i],
      cashOutflowToEquity: cashToEquity[i],
      projectCashFlow: projectCf[i],
    });
  }

  /* ----------------------- Budget rollup (final $) ------------------------ */
  // Fill computed rows with their solved totals.
  const computedAmounts: Record<string, { amount: number; monthly: number[] }> = {
    '600614': { amount: sum(shortfall), monthly: shortfall },
    '600615': {
      amount: originationFee,
      monthly: (() => {
        const arr = new Array<number>(N).fill(0);
        arr[LC - 1] = originationFee;
        return arr;
      })(),
    },
    '700702': { amount: sum(carryingMonthly), monthly: carryingMonthly },
    '700703': { amount: sum(interimMonthly), monthly: interimMonthly },
    '800807': { amount: sum(contingency), monthly: contingency },
  };
  for (const row of budgetRows) {
    const c = computedAmounts[row.code];
    if (c) {
      row.amount = c.amount;
      row.monthly = c.monthly;
      row.phasing = 'computed';
      row.perUnit = units > 0 ? c.amount / units : 0;
      row.perNrsf = nrsf > 0 ? c.amount / nrsf : 0;
    }
  }
  for (const row of budgetRows) row.pctOfTotal = totalCost > 0 ? row.amount / totalCost : 0;

  const catTotal = (prefix: string) =>
    sum(budgetRows.filter((r) => r.code.startsWith(prefix)).map((r) => r.amount));
  const landTotal = catTotal('1001');
  const hardCostTotal = catTotal('2002');
  const scConsultants = catTotal('3003');
  const scMarketing = catTotal('4004');
  const scMunicipal = catTotal('5005');
  const scFinancing = catTotal('6006');
  const scOperating = catTotal('7007');
  const scGa = catTotal('8008');

  /* ------------------------ Operating Yield block ------------------------- */
  const untrended = buildUntrendedYield(a, units, nrsf, totalCost, totalNet, loanAmount, {
    effTaxRate,
    taxableValueOpYear1: projectTvByYear[Math.min(luYearRounded + 1, NY)] ?? 0,
    rentedSpaces,
    storageMonthly,
  });
  const stabilized = buildStabilizedYield(a, monthly, totalCost, totalNet, loanAmount);

  /* ------------------------- Annual summary rows -------------------------- */
  const annual: AnnualSummaryRow[] = [];
  for (let y = 1; y <= NY; y++) {
    const rows = monthly.filter((r) => r.analysisYear === y);
    annual.push({
      year: y,
      startMonth: (y - 1) * 12 + 1,
      totalIncome: sum(rows.map((r) => r.totalIncome)),
      totalExpenses: sum(rows.map((r) => r.totalExpenses)),
      mfNoi: sum(rows.map((r) => r.totalIncome - r.totalExpenses)),
      combinedNoi: sum(rows.map((r) => r.totalIncome - r.totalExpenses + r.retailNoi)),
      capex: sum(rows.map((r) => r.capex)),
      equityDraw: sum(rows.map((r) => r.equityDraw)),
      loanDraw: sum(rows.map((r) => r.loanDraw)),
      interest: sum(rows.map((r) => r.loanInterest + r.refiInterest)),
      debtService: sum(
        rows.map((r) => r.loanInterest + r.loanPrincipal + r.refiInterest + r.refiPrincipal),
      ),
      projectCashFlow: sum(rows.map((r) => r.projectCashFlow)),
      avgOccupancy: rows.length ? sum(rows.map((r) => r.occupancy)) / rows.length : 0,
    });
  }

  return {
    converged,
    iterations,
    totalUnits: units,
    totalNrsf: nrsf,
    retailSf,
    avgRent,
    constructionEndMonth: CE,
    leaseUpEndMonth: LUF,
    stabilizationDate: addMonths(analysisStart, LUF - 1).toISOString().slice(0, 10),
    budget: {
      rows: budgetRows,
      landTotal,
      hardCostTotal,
      softCostConsultants: scConsultants,
      softCostMarketing: scMarketing,
      softCostMunicipal: scMunicipal,
      softCostFinancing: scFinancing,
      softCostOperating: scOperating,
      softCostGa: scGa,
      totalGross: totalCost,
      equityPaydown,
      totalNet,
    },
    financing: {
      loanAmount,
      equityCommitment,
      gpEquity,
      lpEquity,
      originationFee,
      firstDrawMonth,
      payoffMonth: Math.min(
        SALE,
        firstDrawMonth + fin.termMonths + fin.extension1Months + fin.extension2Months,
      ),
      totalInterest: sum(interest),
      capitalizedInterest: sum(shortfall),
      refi: {
        enabled: refi.enabled,
        proceeds: refiProceeds,
        ltvConstraint: refiLtvC,
        dscrConstraint: refiDscrC,
        debtYieldConstraint: refiDyC,
        impliedValue: refiImplied,
        noiForTest: refiNoi,
        equityPaydown,
      },
    },
    monthly,
    annual,
    taxes: taxYears,
    effectiveTaxRate: effTaxRate,
    sale: {
      month: SALE,
      date: addMonths(analysisStart, SALE - 1).toISOString().slice(0, 10),
      forwardNoiMf: fwdNoiMf,
      forwardNoiRetail: fwdNoiRetail,
      mfSalePrice,
      retailSalePrice,
      closingCosts,
      stateTaxOnSale,
      loanBalanceRetired,
      netSaleProceeds,
      netProfitFromSale: netSaleProceeds - equityCommitment,
    },
    returns: {
      projectXirr,
      projectMoic,
      totalEquityInvested,
      totalDistributions: distributions120,
    },
    operatingYield: {
      untrended,
      stabilized,
      stabilizedYearLabel: 3,
    },
    waterfall,
  };
}

/* ------------------------------------------------------------------------- */

function buildUntrendedYield(
  a: Assumptions,
  units: number,
  nrsf: number,
  totalGross: number,
  totalNet: number,
  loanAmount: number,
  ctx: {
    effTaxRate: number;
    taxableValueOpYear1: number;
    rentedSpaces: number;
    storageMonthly: number;
  },
): OperatingYieldCol {
  const pgr = sum(a.unitMix.map((u) => u.count * u.avgSf * u.rentPsf)) * 12;
  const stabConc = -pgr * a.leasing.stabilizedConcessionsPct;
  const ltl = -pgr * a.leasing.lossToLeasePct;
  const adminU = -pgr * a.leasing.adminUnitsPct;
  const ner = pgr + stabConc + ltl + adminU;
  const vac = -ner * a.leasing.stabilizedVacancyPct;
  const coll = -ner * a.leasing.collectionLossPct;
  const nri = ner + vac + coll;

  const utilities = a.opex.utilities * units;
  const otherIncome: Record<string, number> = {
    RUBS: utilities * a.otherIncome.rubsPctOfUtilities,
    'Admin Fees': a.otherIncome.adminFeePerLease * units,
    'Pet Fees': a.otherIncome.petFeePerLease * units * a.otherIncome.petRenterPct,
    'Pet Rent': a.otherIncome.petRentPerMonth * units * a.otherIncome.petRenterPct * 12,
    'Bulk WiFi': a.otherIncome.bulkWifiPerUnitMonth * units * 12,
    Trash: a.otherIncome.trashPerUnitMonth * units * 12,
    Pest: a.otherIncome.pestPerUnitMonth * units * 12,
    'Storage Rent': ctx.storageMonthly * 12,
    'Parking Income': a.parking.ratePerSpaceMonth * ctx.rentedSpaces * 12,
  };
  const totalOther = sum(Object.values(otherIncome));
  const totalIncome = nri + totalOther;

  const controllable: Record<string, number> = {
    Payroll: a.opex.payroll * units,
    Marketing: a.opex.marketing * units,
    'Leasing Commissions': a.opex.leasingCommissions * units,
    'Repairs & Maintenance': a.opex.repairsMaintenance * units,
    Turnover: a.opex.turnover * units,
    'Contract Services': a.opex.contractServices * units,
    Utilities: utilities,
    'General / Admin': a.opex.generalAdmin * units,
  };
  const subtotalCtrl = sum(Object.values(controllable));
  const propertyTaxes = ctx.taxableValueOpYear1 * ctx.effTaxRate;
  const mgmt = totalIncome * a.opex.mgmtFeePct;
  const insurance = a.opex.insurance * units;
  const subtotalNonCtrl = propertyTaxes + mgmt + insurance;
  const totalExpenses = subtotalCtrl + subtotalNonCtrl;
  const mfNoi = totalIncome - totalExpenses;
  const combinedNoi = mfNoi; // retail = 0
  const reserves = a.opex.capitalReserves * units;
  const ncf = combinedNoi - reserves;
  const annualDebtService = -pmt(a.taxes.dscrTestRate, 360, loanAmount);

  return {
    label: 'Untrended (Yr. 1)',
    potentialGrossRent: pgr,
    leaseUpVacancy: 0,
    effectiveGrossRent: pgr,
    concessions: stabConc,
    lossToLease: ltl,
    adminUnits: adminU,
    netEffectiveRents: ner,
    vacancyLoss: vac,
    collectionLoss: coll,
    netRentalIncome: nri,
    otherIncome,
    totalOtherIncome: totalOther,
    totalIncome,
    controllable,
    subtotalControllable: subtotalCtrl,
    propertyTaxes,
    managementFees: mgmt,
    insurance,
    subtotalNonControllable: subtotalNonCtrl,
    totalExpenses,
    mfNoi,
    retailNoi: 0,
    combinedNoi,
    capitalReserves: reserves,
    netCashFlow: ncf,
    returnOnCostGross: totalGross > 0 ? combinedNoi / totalGross : 0,
    returnOnCostNet: totalNet > 0 ? combinedNoi / totalNet : 0,
    debtYield: loanAmount > 0 ? combinedNoi / loanAmount : 0,
    dscr: annualDebtService > 0 ? combinedNoi / annualDebtService : 0,
  };
}

function buildStabilizedYield(
  a: Assumptions,
  monthly: MonthlyRow[],
  totalGross: number,
  totalNet: number,
  loanAmount: number,
): OperatingYieldCol {
  const rows = monthly.filter((r) => r.operationYear === 3);
  const s = (f: (r: MonthlyRow) => number) => sum(rows.map(f));

  const pgr = s((r) => r.potentialGrossRent);
  const leaseVac = s((r) => r.leaseUpVacancy);
  const conc = s((r) => r.leaseUpConcessions + r.stabilizedConcessions);
  const ltl = s((r) => r.lossToLease);
  const adminU = s((r) => r.adminUnits);
  const ner = s((r) => r.netEffectiveRents);
  const vac = s((r) => r.stabilizedVacancy);
  const coll = s((r) => r.collectionLoss);
  const nri = s((r) => r.netRentalIncome);

  const otherIncome: Record<string, number> = {
    RUBS: s((r) => r.rubs),
    'Admin Fees': s((r) => r.adminFees),
    'Pet Fees': s((r) => r.petFee),
    'Pet Rent': s((r) => r.petRent),
    'Bulk WiFi': s((r) => r.bulkWifi),
    Trash: s((r) => r.trash),
    Pest: s((r) => r.pest),
    'Storage Rent': s((r) => r.storageIncome),
    'Parking Income': s((r) => r.parkingIncome),
  };
  const controllable: Record<string, number> = {
    Payroll: s((r) => r.salary),
    Marketing: s((r) => r.marketingExp),
    'Leasing Commissions': s((r) => r.leasingCommissionsExp),
    'Repairs & Maintenance': s((r) => r.repairsMaintenance),
    Turnover: s((r) => r.turnoverExp),
    'Contract Services': s((r) => r.contractServices),
    Utilities: s((r) => r.utilities),
    'General / Admin': s((r) => r.generalAdmin),
  };
  const subtotalCtrl = sum(Object.values(controllable));
  const propertyTaxes = s((r) => r.propertyTaxes);
  const mgmt = s((r) => r.managementFees);
  const insurance = s((r) => r.insurance);
  const totalIncome = s((r) => r.totalIncome);
  const totalExpenses = s((r) => r.totalExpenses);
  const mfNoi = totalIncome - totalExpenses;
  const reserves = -s((r) => r.capitalReserves);
  const combinedNoi = mfNoi + s((r) => r.retailNoi);
  const annualDebtService = -pmt(a.taxes.dscrTestRate, 360, loanAmount);

  return {
    label: 'Stabilized (Yr. 3)',
    potentialGrossRent: pgr,
    leaseUpVacancy: leaseVac,
    effectiveGrossRent: pgr + leaseVac,
    concessions: conc,
    lossToLease: ltl,
    adminUnits: adminU,
    netEffectiveRents: ner,
    vacancyLoss: vac,
    collectionLoss: coll,
    netRentalIncome: nri,
    otherIncome,
    totalOtherIncome: sum(Object.values(otherIncome)),
    totalIncome,
    controllable,
    subtotalControllable: subtotalCtrl,
    propertyTaxes,
    managementFees: mgmt,
    insurance,
    subtotalNonControllable: propertyTaxes + mgmt + insurance,
    totalExpenses,
    mfNoi,
    retailNoi: 0,
    combinedNoi,
    capitalReserves: reserves,
    netCashFlow: combinedNoi - reserves,
    returnOnCostGross: totalGross > 0 ? combinedNoi / totalGross : 0,
    returnOnCostNet: totalNet > 0 ? combinedNoi / totalNet : 0,
    debtYield: loanAmount > 0 ? combinedNoi / loanAmount : 0,
    dscr: annualDebtService > 0 ? combinedNoi / annualDebtService : 0,
  };
}
