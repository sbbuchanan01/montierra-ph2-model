import { xirr } from '../model/finance';
import type {
  BudgetLineOut,
  BudgetSection,
  DebtRow,
  DrawRow,
  ForSaleAnnual,
  ForSaleAssumptions,
  ForSaleBudgetLine,
  ForSaleOutput,
  ForSaleWaterfallMonth,
  MarginColumn,
  ModelCheck,
  SalesMonth,
  SpendCurve,
  TaxYear,
  UnitScheduleRow,
} from './types';

const N = 120; // months 1..120 (plus month 0)
const NY = 10;
const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
const sumPos = (arr: number[]) => arr.reduce((s, v) => s + (v > 0 ? v : 0), 0);
const sumNeg = (arr: number[]) => arr.reduce((s, v) => s + (v < 0 ? v : 0), 0);
/** Excel ROUNDUP toward +∞ for positive x, guarding the 3/0.3 = 10.000000000000002 class of float noise. */
const roundUp = (x: number) => Math.ceil(x - 1e-9);
const iso = (d: Date) => d.toISOString().slice(0, 10);
/** Last day of the month `offset` months after (y, m0) — Excel EOMONTH. */
const eomonth = (y: number, m0: number, offset: number) => new Date(Date.UTC(y, m0 + offset + 1, 0));
/** Equity multiple the workbook's way: inflows ÷ outflows on the monthly vector (0 when there are no outflows). */
const moic = (cf: number[]) => {
  const out = -sumNeg(cf);
  return out > 0 ? sumPos(cf) / out : 0;
};

export const LAND_PURCHASE_ID = 'land-purchase';

/** 1..10 cumulative index from year-over-year rates (year 1 = 1.000). */
function cumulativeIndex(rates: number[]): number[] {
  const idx = new Array(NY + 1).fill(1);
  for (let y = 2; y <= NY; y++) idx[y] = idx[y - 1] * (1 + (rates[y - 1] ?? 0));
  return idx;
}

export function runForSaleModel(a: ForSaleAssumptions): ForSaleOutput {
  /* ------------------------------ program ------------------------------ */
  const plans = a.plans;
  const units = sum(plans.map((p) => p.count));
  const nsf = sum(plans.map((p) => p.count * p.avgSf));
  const avgSf = units > 0 ? nsf / units : 0;
  const gsf = a.project.netToGross > 0 ? nsf / a.project.netToGross : 0;
  const planPrice = plans.map((p) => p.avgSf * p.basePsf);
  const grossSelloutToday = sum(plans.map((p, i) => p.count * planPrice[i]));
  const waPrice = units > 0 ? grossSelloutToday / units : 0;
  const waPsf = nsf > 0 ? grossSelloutToday / nsf : 0;
  const cumUnits: number[] = [];
  plans.reduce((c, p) => {
    cumUnits.push(c + p.count);
    return c + p.count;
  }, 0);

  const S = a.schedule;
  const CS = S.predevMonths + 1;
  const CE = CS + S.constructionMonths - 1;
  const FC = S.firstClosingMonth;

  const priceIdx = cumulativeIndex(a.growth.price);
  const carryIdx = cumulativeIndex(a.growth.carry);
  const taxIdx = cumulativeIndex(a.growth.tax);
  const yearOf = (m: number) => (m === 0 ? 0 : Math.ceil(m / 12));
  const yIdx = (m: number) => Math.min(NY, Math.max(1, yearOf(m)));

  /* ------------------------------- dates ------------------------------- */
  const [ly, lm, ld] = a.schedule.landClosingDate.split('-').map(Number);
  const landClosing = new Date(Date.UTC(ly, lm - 1, ld));
  const msY = lm === 12 ? ly + 1 : ly;
  const msM = lm === 12 ? 0 : lm; // 0-based month of model month 1
  const modelStart = new Date(Date.UTC(msY, msM, 1));
  const dates: Date[] = [landClosing];
  for (let m = 1; m <= N; m++) dates.push(eomonth(msY, msM, m - 1));
  const dateIso = dates.map(iso);

  /* --------------------------- unit schedule --------------------------- */
  const unitSchedule: UnitScheduleRow[] = [];
  for (let u = 1; u <= units; u++) {
    const pi = cumUnits.filter((c) => u > c).length; // plan index
    const plan = plans[pi];
    const pPrice = planPrice[pi] ?? 0;
    const priceUsed = a.pricing.method === 'Blended Average' ? waPrice : pPrice;
    const deliveryMonth = S.firstCoMonth + Math.floor((u - 1) / Math.max(1, S.deliveryPace));
    const scheduledMonth =
      FC + (u <= S.firstClosingUnits ? 0 : roundUp((u - S.firstClosingUnits) / Math.max(0.0001, S.closingPace)));
    const closingMonth = Math.max(deliveryMonth, scheduledMonth);
    const closingYear = Math.ceil(closingMonth / 12);
    const grossPrice = priceUsed * priceIdx[Math.min(NY, Math.max(1, closingYear))];
    unitSchedule.push({
      unit: u,
      plan: plan?.code ?? '',
      sf: plan?.avgSf ?? 0,
      planPrice: pPrice,
      priceUsed,
      deliveryMonth,
      scheduledMonth,
      closingMonth,
      closingYear,
      grossPrice,
    });
  }
  const lastDelivery = unitSchedule.reduce((mx, r) => Math.max(mx, r.deliveryMonth), 0);
  const sellout = unitSchedule.reduce((mx, r) => Math.max(mx, r.closingMonth), 0);
  const SO = sellout;
  const closedAfterGrid = unitSchedule.filter((r) => r.closingMonth > N).length;
  const selloutDuration = SO - FC + 1;
  const selloutDate = SO > 0 ? iso(eomonth(msY, msM, SO - 1)) : dateIso[0];

  /* ----------------------- spend-curve percentages ---------------------- */
  const customTotal = sum(S.customCurve);
  const predevPct: number[] = [];
  const constructionPct: number[] = [];
  const deliveryPct: number[] = [];
  const salesPct: number[] = [];
  const straightPct: number[] = [];
  const smooth = (t: number) => 3 * t * t - 2 * t * t * t;
  for (let m = 0; m <= N; m++) {
    predevPct[m] = S.predevMonths === 0 || m < 1 || m > S.predevMonths ? 0 : 1 / S.predevMonths;
    const sl = m < CS || m > CE ? 0 : 1 / Math.max(1, S.constructionMonths);
    straightPct[m] = sl;
    if (S.hardCostCurve === 'Straight-Line') constructionPct[m] = sl;
    else if (S.hardCostCurve === 'Custom') {
      const k = m - CS + 1;
      constructionPct[m] = k < 1 || k > 36 || customTotal === 0 ? 0 : (S.customCurve[k - 1] ?? 0) / customTotal;
    } else {
      const dur = Math.max(1, S.constructionMonths);
      const t1 = Math.min(1, Math.max(0, (m - CS + 1) / dur));
      const t0 = Math.min(1, Math.max(0, (m - CS) / dur));
      constructionPct[m] = smooth(t1) - smooth(t0);
    }
    deliveryPct[m] = units > 0 ? unitSchedule.filter((r) => r.deliveryMonth === m).length / units : 0;
    salesPct[m] = m < FC || m > SO ? 0 : 1 / Math.max(1, SO - FC + 1);
  }

  /* ------------------------------- budget ------------------------------ */
  const isInputBasis = (b: ForSaleBudgetLine['basis']) =>
    b === 'lump' || b === 'perUnit' || b === 'perGsf' || b === 'perSpace' || b === 'pctOfLand' || b === 'leaseback';
  const landLine = a.budget.find((l) => l.id === LAND_PURCHASE_ID) ?? a.budget.find((l) => l.section === 'land' && l.basis === 'lump');
  const landPurchase = landLine?.rate ?? 0;

  const simpleAmount = (l: ForSaleBudgetLine): number => {
    switch (l.basis) {
      case 'lump':
        return l.rate;
      case 'pctOfLand':
        return l.rate * landPurchase;
      case 'leaseback':
        return -l.rate * S.predevMonths;
      case 'perUnit':
        return l.rate * units;
      case 'perGsf':
        return l.rate * gsf;
      case 'perSpace':
        return l.rate * a.project.parkingSpaces;
      default:
        return 0;
    }
  };

  /** Every line's amount given the two engine-determined figures (interest budget, loan commitment). */
  const buildBudget = (interestBudget: number, commitment: number, capitalizedTaxes: number) => {
    const amt = new Map<string, number>();
    const of = (section: BudgetSection, pred: (l: ForSaleBudgetLine) => boolean) =>
      sum(a.budget.filter((l) => l.section === section && pred(l)).map((l) => amt.get(l.id) ?? 0));
    // land
    for (const l of a.budget) if (l.section === 'land') amt.set(l.id, simpleAmount(l));
    // hard: direct → general conditions → contingency
    for (const l of a.budget) if (l.section === 'hard' && isInputBasis(l.basis)) amt.set(l.id, simpleAmount(l));
    const directHard = of('hard', (l) => isInputBasis(l.basis));
    for (const l of a.budget) if (l.section === 'hard' && l.basis === 'pctOfDirectHard') amt.set(l.id, l.rate * directHard);
    const gc = of('hard', (l) => l.basis === 'pctOfDirectHard');
    for (const l of a.budget)
      if (l.section === 'hard' && l.basis === 'pctOfHardBeforeContingency') amt.set(l.id, l.rate * (directHard + gc));
    const hardSubtotal = of('hard', () => true);
    // soft: regular + % of hard → development fee → soft contingency
    for (const l of a.budget) {
      if (l.section !== 'soft') continue;
      if (isInputBasis(l.basis)) amt.set(l.id, simpleAmount(l));
      else if (l.basis === 'pctOfHard') amt.set(l.id, l.rate * hardSubtotal);
    }
    const softRegular = of('soft', (l) => isInputBasis(l.basis) || l.basis === 'pctOfHard');
    for (const l of a.budget)
      if (l.section === 'soft' && l.basis === 'pctOfHardAndSoft') amt.set(l.id, l.rate * (hardSubtotal + softRegular));
    const devFee = of('soft', (l) => l.basis === 'pctOfHardAndSoft');
    for (const l of a.budget)
      if (l.section === 'soft' && l.basis === 'pctOfSoft') amt.set(l.id, l.rate * (softRegular + devFee));
    const softSubtotal = of('soft', () => true);
    // financing & reserves
    for (const l of a.budget) {
      if (l.section === 'financing') {
        if (l.basis === 'originationFee') amt.set(l.id, a.financing.originationFeePct * commitment);
        else if (l.basis === 'constructionInterest') amt.set(l.id, interestBudget);
        else amt.set(l.id, simpleAmount(l));
      } else if (l.section === 'reserves') {
        if (l.basis === 'capitalizedTaxes') amt.set(l.id, capitalizedTaxes);
        else amt.set(l.id, simpleAmount(l));
      }
    }
    const landSubtotal = of('land', () => true);
    const financingSubtotal = of('financing', () => true);
    const reservesSubtotal = of('reserves', () => true);
    const originationFee = of('financing', (l) => l.basis === 'originationFee');
    const total = landSubtotal + hardSubtotal + softSubtotal + financingSubtotal + reservesSubtotal;
    return {
      amt,
      landSubtotal,
      hardSubtotal,
      softSubtotal,
      financingSubtotal,
      reservesSubtotal,
      originationFee,
      total,
      costExFee: total - originationFee,
      landHardSoft: landSubtotal + hardSubtotal + softSubtotal,
    };
  };

  /* ----- draw columns that do not depend on the financing loop ----- */
  const curveSum = (curve: SpendCurve, lines: ForSaleBudgetLine[], amt: Map<string, number>) =>
    sum(lines.filter((l) => l.curve === curve && !isComputed(l)).map((l) => amt.get(l.id) ?? 0));
  const isComputed = (l: ForSaleBudgetLine) =>
    l.basis === 'constructionInterest' || l.basis === 'capitalizedTaxes';

  // Hard costs (memo) drive the tax assessment and are independent of interest / the fee.
  const hardLines = a.budget.filter((l) => l.section === 'hard');
  const b0 = buildBudget(0, 0, 0);
  const hardMemo: number[] = [];
  for (let m = 0; m <= N; m++) {
    hardMemo[m] =
      (m === 0 ? curveSum('Month 0', hardLines, b0.amt) : 0) +
      predevPct[m] * curveSum('Predevelopment', hardLines, b0.amt) +
      constructionPct[m] * curveSum('Construction', hardLines, b0.amt) +
      deliveryPct[m] * curveSum('Delivery', hardLines, b0.amt) +
      salesPct[m] * curveSum('Sales Period', hardLines, b0.amt) +
      (m === 0 ? 0 : straightPct[m] * curveSum('Straight-Line', hardLines, b0.amt));
  }

  /* ------------------------------- taxes ------------------------------- */
  const combinedRate = sum(a.taxes.jurisdictions.map((j) => (j.ratePer100 / 100) * j.assessmentPct));
  const taxYears: TaxYear[] = [];
  let cumHard = 0;
  for (let y = 1; y <= NY; y++) {
    let hardSpent = 0;
    for (let m = 0; m <= N; m++) {
      const ym = yearOf(m);
      if (y === 1 ? ym <= 1 : ym === y) hardSpent += hardMemo[m];
    }
    cumHard += hardSpent;
    const assessedImprovements = cumHard * a.taxes.improvementsPctOfHard;
    const assessedValue = assessedImprovements + a.taxes.landAssessedValue;
    const annualTax = Math.max(0, assessedValue * combinedRate * taxIdx[y]);
    const monthsCapitalized = y === 1 ? Math.max(0, Math.min(12, FC - 1)) : 0;
    const notCharged = y === 1 ? 0 : (annualTax / 12) * Math.max(0, Math.min(12, FC - 1 - (y - 1) * 12));
    taxYears.push({
      year: y,
      hardSpent,
      cumHard,
      assessedImprovements,
      land: a.taxes.landAssessedValue,
      assessedValue,
      index: taxIdx[y],
      annualTax,
      monthsCapitalized,
      capitalized: (annualTax / 12) * monthsCapitalized,
      notCharged,
      carried: 0, // filled from the Sales CF below
      buyers: 0,
    });
  }
  const annualTax = (m: number) => taxYears[yIdx(m) - 1].annualTax;
  const drawTaxes: number[] = [];
  for (let m = 0; m <= N; m++) drawTaxes[m] = m >= 1 && m < FC && yearOf(m) === 1 ? Math.max(0, taxYears[0].annualTax) / 12 : 0;
  const capitalizedTaxes = sum(drawTaxes);

  /* -------------------- sales cash flow (pre-financing) -------------------- */
  const carryPerUnitYr = a.carry.map((c) => {
    switch (c.basis) {
      case 'psfMo':
        return c.input * avgSf * 12;
      case 'perUnitYr':
        return c.input;
      case 'perMonthProject':
        return units === 0 ? 0 : (c.input * 12) / units;
    }
  });
  const totalDeductionsPct =
    a.pricing.commissionsPct + a.pricing.litigationPct + a.pricing.escrowPct + a.pricing.sellerClosingPct + a.pricing.incentivesPct;

  const monthly: SalesMonth[] = [];
  let closedCum = 0;
  for (let m = 0; m <= N; m++) {
    const year = yearOf(m);
    const closedRows = unitSchedule.filter((r) => r.closingMonth === m);
    const closed = closedRows.length;
    closedCum += closed;
    const deliveredCum = unitSchedule.filter((r) => r.deliveryMonth <= m).length;
    const unsoldCarried = unitSchedule.filter((r) => r.deliveryMonth < m && r.closingMonth > m).length;
    const notYetClosed = units - closedCum;
    const grossByPlan = plans.map((p) => sum(closedRows.filter((r) => r.plan === p.code).map((r) => r.grossPrice)));
    const grossSales = sum(grossByPlan);
    const commissions = -a.pricing.commissionsPct * grossSales;
    const litigation = -a.pricing.litigationPct * grossSales;
    const escrow = -a.pricing.escrowPct * grossSales;
    const sellerClosing = -a.pricing.sellerClosingPct * grossSales;
    const incentives = -a.pricing.incentivesPct * grossSales;
    const totalDeductions = commissions + litigation + escrow + sellerClosing + incentives;
    const netSales = grossSales + totalDeductions;
    const ci = carryIdx[yIdx(m)];
    const carryItems = carryPerUnitYr.map((e) => (-e / 12) * ci * unsoldCarried);
    const taxesOnUnsold =
      m >= FC && units > 0 ? -((Math.max(0, annualTax(m)) / 12) * Math.max(0, notYetClosed)) / units : 0;
    const totalCarry = sum(carryItems) + taxesOnUnsold;
    const warranty = -a.pricing.warrantyPct * grossSales;
    const netSellout = netSales + totalCarry + warranty;
    monthly.push({
      month: m,
      year,
      date: dateIso[m],
      inProject: m <= SO,
      priceIndex: priceIdx[yIdx(m)],
      carryIndex: ci,
      deliveredCum,
      closed,
      closedCum,
      unsoldCarried,
      notYetClosed,
      pctSold: units > 0 ? closedCum / units : 0,
      pctBudgetComplete: 0,
      grossByPlan,
      grossSales,
      commissions,
      litigation,
      escrow,
      sellerClosing,
      incentives,
      totalDeductions,
      netSales,
      carryItems,
      taxesOnUnsold,
      totalCarry,
      warranty,
      netSellout,
      devLand: 0,
      devPredev: 0,
      devHard: 0,
      devDeliverySales: 0,
      devStraightLine: 0,
      devTaxes: 0,
      devTotal: 0,
      unlevered: 0,
      loanDraw: 0,
      interest: 0,
      repayment: 0,
      payoff: 0,
      financing: 0,
      loanBalance: 0,
      undrawn: 0,
      levered: 0,
      cumulativeLevered: 0,
      equityCalled: 0,
    });
  }
  for (const ty of taxYears) {
    ty.carried = -sum(monthly.filter((r) => r.year === ty.year).map((r) => r.taxesOnUnsold));
    ty.buyers = ty.annualTax - ty.capitalized - ty.notCharged - ty.carried;
  }

  /* ------------------ financing loop (construction interest) ------------------ */
  const F = a.financing;
  const rateFor = (m: number) => {
    if (F.rateType === 'Fixed') return F.fixedRate;
    let s = a.growth.sofr[yIdx(m) - 1] ?? 0;
    if (F.capStrike > 0) s = Math.min(s, F.capStrike);
    return s + F.spread;
  };
  const sizingRate = rateFor(1);

  interface Pass {
    budget: ReturnType<typeof buildBudget>;
    commitment: number;
    maxLtcProceeds: number;
    maxSelloutProceeds: number;
    equity: number;
    draw: DrawRow[];
    debt: DebtRow[];
    engineInterest: number; // Σ budget-funded interest (Draw col O)
  }

  const runPass = (interestBudget: number): Pass => {
    // Commitment: LTC test in closed form (the fee is inside total cost), then the sellout test.
    const pre = buildBudget(interestBudget, 0, capitalizedTaxes);
    const maxLtcProceeds =
      F.ltcBasis === 'Land + Hard + Soft'
        ? F.maxLtc * pre.landHardSoft
        : (F.maxLtc * pre.costExFee) / (1 - F.maxLtc * F.originationFeePct);
    const maxSelloutProceeds = F.maxLoanToSellout * grossSelloutToday;
    const commitment = Math.min(maxLtcProceeds, maxSelloutProceeds);
    const budget = buildBudget(interestBudget, commitment, capitalizedTaxes);
    const equity = budget.total - commitment;
    const all = a.budget;
    const draw: DrawRow[] = [];
    const debt: DebtRow[] = [];
    let cumulative = 0;
    let engineInterest = 0;
    for (let m = 0; m <= N; m++) {
      const landUpFront = m === 0 ? curveSum('Month 0', all, budget.amt) : 0;
      const predevelopment = predevPct[m] * curveSum('Predevelopment', all, budget.amt);
      const construction = constructionPct[m] * curveSum('Construction', all, budget.amt);
      const delivery = deliveryPct[m] * curveSum('Delivery', all, budget.amt);
      const salesPeriod = salesPct[m] * curveSum('Sales Period', all, budget.amt);
      const straightLine = straightPct[m] * curveSum('Straight-Line', all, budget.amt);
      // debt for this month (interest depends only on the opening balance)
      const bop = m === 0 ? 0 : debt[m - 1].eop;
      const rate = rateFor(m);
      const interest = (bop * rate) / 12;
      const interestBudgetFunded = m >= 1 && m < FC ? interest : 0;
      engineInterest += interestBudgetFunded;
      const total =
        landUpFront + predevelopment + construction + delivery + salesPeriod + straightLine + interestBudgetFunded + drawTaxes[m];
      cumulative += total;
      const undrawnPrev = m === 0 ? commitment : debt[m - 1].undrawn;
      const wanted =
        F.fundingOrder === 'Pari Passu'
          ? total * (budget.total === 0 ? 0 : Math.min(1, commitment / budget.total))
          : Math.min(total, Math.max(0, cumulative - equity));
      const loanDraw = Math.max(0, Math.min(undrawnPrev, wanted));
      const repayment = -Math.min(bop + loanDraw, Math.max(0, F.releasePct * monthly[m].netSellout));
      const payoff = m === SO ? -(bop + loanDraw + repayment) : 0;
      const eop = bop + loanDraw + repayment + payoff;
      draw.push({
        month: m,
        year: yearOf(m),
        date: dateIso[m],
        predevPct: predevPct[m],
        constructionPct: constructionPct[m],
        deliveryPct: deliveryPct[m],
        salesPct: salesPct[m],
        landUpFront,
        predevelopment,
        construction,
        delivery,
        salesPeriod,
        straightLine,
        interest: interestBudgetFunded,
        taxes: drawTaxes[m],
        total,
        cumulative,
        pctOfBudget: 0,
        hardMemo: hardMemo[m],
      });
      debt.push({
        month: m,
        year: yearOf(m),
        date: dateIso[m],
        phase: m < FC ? 'Construction' : m <= SO ? 'Sellout' : 'Repaid',
        rate,
        bop,
        interest,
        interestBudgetFunded,
        interestFromSales: interest - interestBudgetFunded,
        draw: loanDraw,
        repayment,
        payoff,
        eop,
        undrawn: Math.max(0, undrawnPrev - loanDraw),
      });
    }
    const spend = sum(draw.map((d) => d.total));
    for (const d of draw) d.pctOfBudget = spend === 0 ? 0 : d.cumulative / spend;
    return { budget, commitment, maxLtcProceeds, maxSelloutProceeds, equity, draw, debt, engineInterest };
  };

  // Manual = the typed amount; Circular = solve the fixed point, seeded from the manual amount.
  let interestBudget = F.manualInterest;
  let pass = runPass(interestBudget);
  let iterations = 1;
  let converged = true;
  if (F.interestBudget === 'Circular') {
    converged = false;
    for (let i = 0; i < 200; i++) {
      const next = pass.engineInterest;
      if (Math.abs(next - interestBudget) < 1e-9) {
        converged = true;
        break;
      }
      interestBudget = next;
      pass = runPass(interestBudget);
      iterations++;
    }
  }
  const { budget: B, commitment, equity, draw, debt } = pass;

  /* -------------------- sales cash flow (financing rows) -------------------- */
  let cumLevered = 0;
  let equityCalled = 0;
  for (let m = 0; m <= N; m++) {
    const r = monthly[m];
    const d = draw[m];
    const t = debt[m];
    r.pctBudgetComplete = d.pctOfBudget;
    r.devLand = -d.landUpFront;
    r.devPredev = -d.predevelopment;
    r.devHard = -d.construction;
    r.devDeliverySales = -(d.delivery + d.salesPeriod);
    r.devStraightLine = -d.straightLine;
    r.devTaxes = -d.taxes;
    r.devTotal = r.devLand + r.devPredev + r.devHard + r.devDeliverySales + r.devStraightLine + r.devTaxes;
    r.unlevered = r.netSellout + r.devTotal;
    r.loanDraw = t.draw;
    r.interest = -t.interest;
    r.repayment = t.repayment;
    r.payoff = t.payoff;
    r.financing = r.loanDraw + r.interest + r.repayment + r.payoff;
    r.loanBalance = t.eop;
    r.undrawn = t.undrawn;
    r.levered = r.unlevered + r.financing;
    cumLevered += r.levered;
    r.cumulativeLevered = cumLevered;
    if (r.levered < 0) equityCalled -= r.levered;
    r.equityCalled = equityCalled;
  }
  const unleveredCf = monthly.map((r) => r.unlevered);
  const leveredCf = monthly.map((r) => r.levered);

  /* ------------------------------ waterfall ------------------------------ */
  const E = a.equity;
  const lpShare = 1 - E.gpShare;
  const hurdleMonthly = Math.pow(1 + E.irrHurdle, 1 / 12) - 1;
  const waterfall: ForSaleWaterfallMonth[] = [];
  for (let m = 0; m <= N; m++) {
    const prev = waterfall[m - 1];
    const levered = leveredCf[m];
    const distributable = Math.max(0, levered);
    const contributed = -Math.min(0, levered);
    const capitalBop = prev ? prev.capitalEop : 0;
    const prefBop = prev ? prev.prefEop : 0;
    const prefAccrual = m === 0 ? 0 : ((capitalBop + prefBop) * E.preferredReturn) / 12;
    const prefPaid = Math.min(distributable, prefBop + prefAccrual);
    const returnOfCapital = Math.min(distributable - prefPaid, capitalBop + contributed);
    const afterTier1 = distributable - prefPaid - returnOfCapital;
    const capitalEop = capitalBop + contributed - returnOfCapital;
    const prefEop = prefBop + prefAccrual - prefPaid;
    const hurdleBop = prev ? prev.hurdleEop : 0;
    const hurdleAccrual = m === 0 ? 0 : hurdleBop * hurdleMonthly;
    const hurdleBeforeTier2 = hurdleBop + hurdleAccrual + contributed - prefPaid - returnOfCapital;
    const tier2Partner = Math.min(afterTier1 * (1 - E.tier2Promote), Math.max(0, hurdleBeforeTier2));
    const tier2Promote = E.tier2Promote >= 1 ? 0 : (tier2Partner / (1 - E.tier2Promote)) * E.tier2Promote;
    const tier2Total = tier2Partner + tier2Promote;
    const tier3Residual = afterTier1 - tier2Total;
    const tier3Promote = tier3Residual * E.tier3Promote;
    const tier3Partner = tier3Residual - tier3Promote;
    const hurdleEop = hurdleBeforeTier2 - tier2Partner - tier3Partner;
    const lpTier1 = (prefPaid + returnOfCapital) * lpShare;
    const lpTier2 = tier2Partner * lpShare;
    const lpTier3 = tier3Partner * lpShare;
    const lpDistributions = lpTier1 + lpTier2 + lpTier3;
    const lpContributions = -contributed * lpShare;
    const gpTier1 = (prefPaid + returnOfCapital) * E.gpShare;
    const gpTier23 = (tier2Partner + tier3Partner) * E.gpShare;
    const gpPromote = tier2Promote + tier3Promote;
    const gpDistributions = gpTier1 + gpTier23 + gpPromote;
    const gpContributions = -contributed * E.gpShare;
    waterfall.push({
      month: m,
      date: dateIso[m],
      levered,
      distributable,
      contributed,
      capitalBop,
      prefBop,
      prefAccrual,
      prefPaid,
      returnOfCapital,
      afterTier1,
      capitalEop,
      prefEop,
      hurdleBop,
      hurdleAccrual,
      hurdleBeforeTier2,
      tier2Partner,
      hurdleEop,
      tier2Promote,
      tier2Total,
      tier3Residual,
      tier3Promote,
      tier3Partner,
      lpTier1,
      lpTier2,
      lpTier3,
      lpDistributions,
      lpContributions,
      lpNet: lpDistributions + lpContributions,
      gpTier1,
      gpTier23,
      gpPromote,
      gpDistributions,
      gpContributions,
      gpNet: gpDistributions + gpContributions,
    });
  }
  const lpCf = waterfall.map((w) => w.lpNet);
  const gpCf = waterfall.map((w) => w.gpNet);

  /* ------------------------------- annual ------------------------------- */
  const annual: ForSaleAnnual[] = [];
  for (let y = 0; y <= NY; y++) {
    const rows = monthly.filter((r) => r.year === y);
    const wrows = waterfall.filter((w) => yearOf(w.month) === y);
    const drows = debt.filter((d) => d.year === y);
    const s = (f: (r: SalesMonth) => number) => sum(rows.map(f));
    const closed = s((r) => r.closed);
    const grossSales = s((r) => r.grossSales);
    const closedCumY = sum(monthly.filter((r) => r.year <= y).map((r) => r.closed));
    annual.push({
      year: y,
      yearEnd: y === 0 ? dateIso[0] : iso(eomonth(msY, msM, 12 * y - 1)),
      closed,
      closedCum: closedCumY,
      notYetClosed: units - closedCumY,
      avgPrice: closed === 0 ? 0 : grossSales / closed,
      grossSales,
      commissions: s((r) => r.commissions),
      litigation: s((r) => r.litigation),
      escrow: s((r) => r.escrow),
      sellerClosing: s((r) => r.sellerClosing),
      incentives: s((r) => r.incentives),
      netSales: s((r) => r.netSales),
      directCarry: s((r) => sum(r.carryItems)),
      taxesOnUnsold: s((r) => r.taxesOnUnsold),
      totalCarry: s((r) => r.totalCarry),
      warranty: s((r) => r.warranty),
      netSellout: s((r) => r.netSellout),
      devLand: s((r) => r.devLand),
      devHard: s((r) => r.devHard),
      devOther: s((r) => r.devPredev + r.devDeliverySales + r.devStraightLine),
      devTaxes: s((r) => r.devTaxes),
      devTotal: s((r) => r.devTotal),
      unlevered: s((r) => r.unlevered),
      loanDraws: s((r) => r.loanDraw),
      interest: s((r) => r.interest),
      repayment: s((r) => r.repayment + r.payoff),
      financing: s((r) => r.financing),
      eoyBalance: debt[Math.min(N, 12 * y)].eop,
      avgRate: drows.length ? sum(drows.map((d) => d.rate)) / drows.length : 0,
      levered: s((r) => r.levered),
      lpDistributions: sum(wrows.map((w) => w.lpDistributions)),
      lpContributions: sum(wrows.map((w) => w.lpContributions)),
      lpNet: sum(wrows.map((w) => w.lpNet)),
      gpDistributions: sum(wrows.map((w) => w.gpDistributions)),
      gpContributions: sum(wrows.map((w) => w.gpContributions)),
      gpNet: sum(wrows.map((w) => w.gpNet)),
    });
  }

  /* ----------------------------- margin on cost ----------------------------- */
  const totalInterest = sum(debt.map((d) => d.interest));
  const capitalizedInterest = sum(debt.map((d) => d.interestBudgetFunded));
  const softContLine = a.budget.find((l) => l.section === 'soft' && l.basis === 'pctOfSoft');
  const softContingencyPct = softContLine?.rate ?? 0;
  const hardContLine = a.budget.find((l) => l.section === 'hard' && l.basis === 'pctOfHardBeforeContingency');
  const marginColumn = (c: {
    gross: number;
    commissions: number;
    litigation: number;
    escrow: number;
    sellerClosing: number;
    incentives: number;
    directCarry: number;
    taxes: number;
    warranty: number;
  }): MarginColumn => {
    const netSales = c.gross + c.commissions + c.litigation + c.escrow + c.sellerClosing + c.incentives;
    const netSellout = netSales + c.directCarry + c.taxes + c.warranty;
    const costExInterest = -(B.total - interestBudget);
    const profitBeforeInterest = netSellout + costExInterest;
    const interest = -totalInterest;
    const netProfit = profitBeforeInterest + interest;
    const returnOnCost = B.total === 0 ? 0 : netProfit / B.total;
    const cushionBase = c.gross * (1 - totalDeductionsPct - a.pricing.warrantyPct);
    return {
      totalCost: B.total,
      ...c,
      netSales,
      netSellout,
      costExInterest,
      profitBeforeInterest,
      interest,
      netProfit,
      marginOnGross: c.gross === 0 ? 0 : netProfit / c.gross,
      marginOnNet: netSales === 0 ? 0 : netProfit / netSales,
      returnOnCost,
      profitPerUnit: units === 0 ? 0 : netProfit / units,
      annualizedRoc: SO <= 0 ? 0 : Math.pow(1 + returnOnCost, 12 / SO) - 1,
      priceCushion: cushionBase === 0 ? 0 : netProfit / cushionBase,
    };
  };
  const tot = (f: (r: SalesMonth) => number) => sum(monthly.map(f));
  const trended = marginColumn({
    gross: tot((r) => r.grossSales),
    commissions: tot((r) => r.commissions),
    litigation: tot((r) => r.litigation),
    escrow: tot((r) => r.escrow),
    sellerClosing: tot((r) => r.sellerClosing),
    incentives: tot((r) => r.incentives),
    directCarry: tot((r) => sum(r.carryItems)),
    taxes: tot((r) => r.taxesOnUnsold),
    warranty: tot((r) => r.warranty),
  });
  const untrended = marginColumn({
    gross: grossSelloutToday,
    commissions: -a.pricing.commissionsPct * grossSelloutToday,
    litigation: -a.pricing.litigationPct * grossSelloutToday,
    escrow: -a.pricing.escrowPct * grossSelloutToday,
    sellerClosing: -a.pricing.sellerClosingPct * grossSelloutToday,
    incentives: -a.pricing.incentivesPct * grossSelloutToday,
    directCarry: tot((r) => sum(r.carryItems) / r.carryIndex),
    taxes: trended.taxes,
    warranty: -a.pricing.warrantyPct * grossSelloutToday,
  });

  /* ------------------------------- returns ------------------------------- */
  const peakBalance = debt.reduce((mx, d) => Math.max(mx, d.eop), 0);
  const repaidRow = debt.find((d) => d.eop < 0.5 && d.month >= FC);
  const repaidMonth = repaidRow ? repaidRow.month : null;
  const unpaidPref = waterfall[Math.min(SO, N)].prefEop;
  const returns: ForSaleOutput['returns'] = {
    unleveredIrr: xirr(unleveredCf, dates),
    unleveredMoic: moic(unleveredCf),
    unleveredProfit: sum(unleveredCf),
    leveredIrr: xirr(leveredCf, dates),
    leveredMoic: moic(leveredCf),
    leveredProfit: sum(leveredCf),
    peakEquityOutstanding: -Math.min(...monthly.map((r) => r.cumulativeLevered)),
    equityAtLandClosing: -Math.min(0, leveredCf[0]),
    totalEquityInvested: -sumNeg(leveredCf),
    lpIrr: xirr(lpCf, dates),
    lpMoic: moic(lpCf),
    lpProfit: sum(lpCf),
    gpIrr: xirr(gpCf, dates),
    gpMoic: moic(gpCf),
    gpProfit: sum(gpCf),
    gpPromote: sum(waterfall.map((w) => w.gpPromote)),
    prefPaid: sum(waterfall.map((w) => w.prefPaid)),
    returnOfCapital: sum(waterfall.map((w) => w.returnOfCapital)),
    tier23Distributed: sum(waterfall.map((w) => w.tier2Total + w.tier3Residual)),
    unpaidPref,
    avgClosingsPerMonth: selloutDuration === 0 ? 0 : units / selloutDuration,
    avgPricePerHome: units === 0 ? 0 : trended.gross / units,
    avgPricePsf: nsf === 0 ? 0 : trended.gross / nsf,
    carryPerHome: units === 0 ? 0 : (trended.directCarry + trended.taxes + trended.warranty) / units,
  };

  /* ----------------------------- sensitivity ----------------------------- */
  const steps = [-0.1, -0.075, -0.05, -0.025, 0, 0.025, 0.05, 0.075, 0.1];
  const sensProfit = steps.map((dp) =>
    steps.map(
      (dc) =>
        trended.netProfit +
        dp * trended.gross * (1 - totalDeductionsPct - a.pricing.warrantyPct) -
        dc * B.hardSubtotal * (1 + softContingencyPct),
    ),
  );
  const sensMargin = steps.map((dp, i) =>
    steps.map((_, j) => {
      const base = trended.gross * (1 + dp);
      return base === 0 ? 0 : sensProfit[i][j] / base;
    }),
  );

  /* ------------------------------- checks ------------------------------- */
  const equityCheck = equity + sumNeg(leveredCf);
  const spendCheck = B.total - sum(draw.map((d) => d.total)) - (interestBudget - pass.engineInterest);
  const interestDiff = interestBudget - pass.engineInterest;
  const fmt0 = (v: number) => Math.round(v).toLocaleString('en-US');
  const checks: ModelCheck[] = [
    { label: 'Sources equal uses', status: Math.abs(B.total - (commitment + equity)) < 1 ? 'ok' : 'check', detail: '' },
    {
      label: 'Every budget dollar is on a spend curve',
      status: Math.abs(spendCheck) < 1 ? 'ok' : 'check',
      detail: Math.abs(spendCheck) < 1 ? '' : `$${fmt0(spendCheck)} of budget is not on a spend curve`,
    },
    {
      label: 'Construction interest — budget vs. the engine',
      status: Math.abs(interestDiff) < 1 ? 'ok' : F.interestBudget === 'Manual' ? 'note' : 'check',
      detail:
        Math.abs(interestDiff) < 1
          ? ''
          : F.interestBudget === 'Manual'
            ? `the manual interest budget differs from the engine by $${fmt0(interestDiff)}`
            : 'interest does not tie',
    },
    {
      label: 'Taxes tab allocation ties (capitalized + carried + buyers)',
      status: taxYears.every((t) => Math.min(t.annualTax, t.capitalized, t.notCharged, t.carried, t.buyers) >= -0.005) ? 'ok' : 'check',
      detail: '',
    },
    {
      label: 'Preferred return fully paid by sellout',
      status: unpaidPref < 1 ? 'ok' : 'note',
      detail: unpaidPref < 1 ? 'pref cleared' : `$${fmt0(unpaidPref)} of accrued preferred unpaid`,
    },
    {
      label: 'Every home closes inside the 120-month grid',
      status: closedAfterGrid === 0 ? 'ok' : 'check',
      detail: closedAfterGrid === 0 ? '' : `${closedAfterGrid} homes close after month 120`,
    },
    {
      label: 'Loan commitment never exceeded',
      status: Math.min(...debt.map((d) => d.undrawn)) < -1 || sum(debt.map((d) => d.draw)) - commitment > 1 ? 'check' : 'ok',
      detail: '',
    },
    {
      label: 'Loan fully repaid by sellout',
      status: SO > N ? 'check' : Math.abs(debt[SO].eop) < 1 ? 'ok' : 'check',
      detail: SO > N ? 'sellout runs past the grid' : Math.abs(debt[SO].eop) < 1 ? '' : 'a balance remains after sellout',
    },
    {
      label: 'Loan repaid before maturity',
      status: repaidMonth === null ? 'check' : repaidMonth <= F.termMonths ? 'ok' : 'note',
      detail:
        repaidMonth === null
          ? 'the loan is never repaid'
          : repaidMonth <= F.termMonths
            ? `repaid in month ${repaidMonth}`
            : `repaid in month ${repaidMonth}, after the ${F.termMonths}-month term`,
    },
    {
      label: 'Deliveries complete on or before construction completion',
      status: lastDelivery <= CE ? 'ok' : 'check',
      detail: lastDelivery <= CE ? '' : `the last home receives CO in month ${lastDelivery}, after construction completes in month ${CE}`,
    },
    {
      label: 'First closing on or after the first CO',
      status: FC >= S.firstCoMonth ? 'ok' : 'note',
      detail: FC >= S.firstCoMonth ? '' : 'the first closing is scheduled before CO; homes close at CO instead',
    },
    {
      label: 'Custom hard-cost curve',
      status:
        S.hardCostCurve !== 'Custom' ? 'ok' : Math.abs(customTotal - 1) < 0.0001 ? 'ok' : customTotal === 0 ? 'check' : 'note',
      detail:
        S.hardCostCurve !== 'Custom'
          ? 'curve not in use'
          : Math.abs(customTotal - 1) < 0.0001
            ? ''
            : customTotal === 0
              ? 'the custom curve is empty'
              : `sums to ${(customTotal * 100).toFixed(1)}%; normalized to 100%`,
    },
    {
      label: 'Equity — budget vs. the monthly cash flow',
      status: Math.abs(equityCheck) < 1000 ? 'ok' : 'note',
      detail:
        Math.abs(equityCheck) < 1000
          ? ''
          : `the monthly engine calls $${fmt0(-equityCheck)} of equity beyond the budget (interest and carry paid from equity while sales sweep to the lender)`,
    },
  ];

  /* ------------------------------- outputs ------------------------------- */
  const lines: BudgetLineOut[] = a.budget.map((l) => {
    const amount = B.amt.get(l.id) ?? 0;
    return {
      id: l.id,
      section: l.section,
      label: l.label,
      basis: l.basis,
      rate: l.basis === 'originationFee' ? a.financing.originationFeePct : l.rate,
      amount,
      perUnit: units === 0 ? 0 : amount / units,
      perNsf: nsf === 0 ? 0 : amount / nsf,
      pctOfTotal: B.total === 0 ? 0 : amount / B.total,
      curve: l.curve,
      computed: l.basis === 'originationFee' || l.basis === 'constructionInterest' || l.basis === 'capitalizedTaxes',
      notes: l.notes,
    };
  });

  return {
    kind: 'forSale',
    converged,
    iterations,
    units,
    nsf,
    avgSf,
    gsf,
    density: a.project.siteAcres > 0 ? units / a.project.siteAcres : 0,
    parkingRatio: units > 0 ? a.project.parkingSpaces / units : 0,
    waPrice,
    waPsf,
    grossSelloutToday,
    totalDeductionsPct,
    schedule: {
      landClosingDate: dateIso[0],
      modelStart: iso(modelStart),
      constructionStart: CS,
      constructionEnd: CE,
      firstCo: S.firstCoMonth,
      lastDelivery,
      firstClosing: FC,
      sellout: SO,
      selloutDate,
      selloutDuration,
      closedAfterGrid,
    },
    unitSchedule,
    budget: {
      lines,
      landSubtotal: B.landSubtotal,
      hardSubtotal: B.hardSubtotal,
      softSubtotal: B.softSubtotal,
      financingSubtotal: B.financingSubtotal,
      reservesSubtotal: B.reservesSubtotal,
      total: B.total,
      costExFee: B.costExFee,
      landHardSoft: B.landHardSoft,
      originationFee: B.originationFee,
      interestBudget,
      capitalizedTaxes,
      hardContingencyPct: hardContLine?.rate ?? 0,
      softContingencyPct,
      equityCheck,
    },
    financing: {
      commitment,
      maxLtcProceeds: pass.maxLtcProceeds,
      maxSelloutProceeds: pass.maxSelloutProceeds,
      binding: commitment === pass.maxLtcProceeds ? 'Loan to Cost' : 'Loan to Sellout',
      commitmentPctOfCost: B.total === 0 ? 0 : commitment / B.total,
      commitmentPctOfSellout: grossSelloutToday === 0 ? 0 : commitment / grossSelloutToday,
      loanPerUnit: units === 0 ? 0 : commitment / units,
      equity,
      gpEquity: equity * E.gpShare,
      lpEquity: equity * lpShare,
      sizingRate,
      peakBalance,
      repaidMonth,
      totalInterest,
      capitalizedInterest,
      interestFromSales: totalInterest - capitalizedInterest,
    },
    carry: {
      items: a.carry.map((c, i) => ({
        id: c.id,
        label: c.label,
        perUnitYr: carryPerUnitYr[i],
        annual: carryPerUnitYr[i] * units,
        perUnitMo: carryPerUnitYr[i] / 12,
      })),
      perUnitYr: sum(carryPerUnitYr),
      annual: sum(carryPerUnitYr) * units,
      perUnitMo: sum(carryPerUnitYr) / 12,
    },
    taxes: {
      combinedRate,
      years: taxYears,
      totalTax: sum(taxYears.map((t) => t.annualTax)),
      capitalized: sum(taxYears.map((t) => t.capitalized)),
      notCharged: sum(taxYears.map((t) => t.notCharged)),
      carried: sum(taxYears.map((t) => t.carried)),
      buyers: sum(taxYears.map((t) => t.buyers)),
    },
    draw,
    debt,
    monthly,
    annual,
    waterfall,
    margin: { untrended, trended },
    returns,
    sensitivity: { steps, profit: sensProfit, margin: sensMargin },
    checks,
  };
}
