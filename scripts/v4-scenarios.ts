/**
 * Builds the two "MF Dev Model - 13 mo - v4" programs (16-unit MF and 10-unit townhomes for
 * rent) as scenario assumptions on top of the base case.
 * Sources (G:\My Drive\Montierra Ph II\Analysis):
 *   16 units — 2026.9.22 ... v4 (16 units).xlsx (no longer in the folder; not revised on 9/23)
 *   10 units — 2026.9.23 ... v4 (10 units).xlsx (9/23 budget revisions on Detailed Cost Input)
 */
import { DEFAULT_ASSUMPTIONS } from '../src/lib/model/defaults';
import type { Assumptions, CostLineItem } from '../src/lib/model/types';

type Program = { units: 16 | 10 };

export function v4Assumptions({ units }: Program): Assumptions {
  const a = structuredClone(DEFAULT_ASSUMPTIONS);
  const is16 = units === 16;

  a.schedule.leaseUpStartMonth = 13;
  a.schedule.saleMonth = 60;
  a.project.siteAcres = 0.916;

  a.unitMix = a.unitMix.map((u) =>
    u.unitCode === 'B1'
      ? { ...u, count: is16 ? 12 : 8, avgSf: is16 ? 1211 : 1975, rentPsf: 1.6 }
      : u.unitCode === 'C1'
        ? { ...u, count: is16 ? 4 : 2, avgSf: is16 ? 1300 : 1975, rentPsf: 1.6 }
        : u,
  );

  a.leasing = {
    ...a.leasing,
    leasesSignedAtCO: is16 ? 4 : 2,
    monthlyAbsorption: is16 ? 4 : 2,
    leaseUpConcessionWeeks: 4,
    stabilizedConcessionsPct: 0.02,
    lossToLeasePct: 0,
    adminUnitsPct: 0.015,
    stabilizedVacancyPct: 0.065,
    collectionLossPct: 0.01,
    expenseGrowthPct: 0.025,
  };
  a.otherIncome = { ...a.otherIncome, petRenterPct: 0.2, trashPerUnitMonth: 0, pestPerUnitMonth: 0 };
  a.parking = {
    totalSpaces: is16 ? 40 : 25,
    retailSpaces: 0,
    guestAdaSpaces: is16 ? 5 : 0,
    pctOfSpacesRented: 0.25,
    ratePerSpaceMonth: 0,
  };
  // The 9.22 workbooks net capital reserves out of operating cash flow; the 2026.9.23 10-unit
  // workbook does not (Monthly PF row 186 = NOI only).
  a.opex = { ...a.opex, deductReservesFromCashFlow: is16 };

  a.constructionCurve = {
    selected: 'Custom',
    customCurve: [7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 7, 5, 10],
  };

  a.financing.construction = { ...a.financing.construction, indexRate: 0.0385, spread: 0.0275 };

  const set: Record<string, Partial<CostLineItem>> = {
    'psa-attorney': { value: 20_000 },
    sitework: { value: 0 }, // v4 carries sitework inside the GC contract (200202)
    'gc-contract': { value: is16 ? 132_500 : 200_000 },
    'monument-signage': { value: 15_000 },
    'interior-signage': { value: is16 ? 3_000 : 5_000 },
    'leaseup-marketing': { value: is16 ? 475 : 1_000 },
    collateral: { value: is16 ? 4_900 : 7_500 },
    'other-municipal': { label: 'Allowance', value: is16 ? 0 : 50_000 },
    appraisal: { value: is16 ? 5_000 : 2_500 },
    'lender-legal': { value: 10_000 },
    'loan-closing-costs': { value: 5_000 },
    'development-fee': { value: 150_000 },
    'legal-jv': { value: 25_000 },
    // 10-unit budget revisions, 2026.9.23 workbook (Detailed Cost Input)
    ...(is16
      ? {}
      : {
          'low-voltage': { value: 10_000 }, // 200208
          'security-access': { value: 1_000 }, // 200209 $/unit
          'almc-telecomm': { value: 10_000 }, // 200215
          'almc-startup': { value: 25_000 },
          'almc-misc': { value: 15_000 },
          'arch-design': { value: 50_000 }, // 300301
          'structural-eng': { value: 25_000 },
          'ae-misc': { value: 10_000 },
          'civil-design': { value: 50_000 }, // 300304
          'civil-misc': { value: 0 },
          'materials-testing': { value: 15_000 }, // 300309
          mep: { value: 0 }, // 300312
          'landscape-arch': { value: 10_000 }, // 300313
        }),
  };
  const items = a.costs.lineItems.map((i) => (set[i.id] ? { ...i, ...set[i.id] } : i));
  const gcIdx = items.findIndex((i) => i.id === 'gc-contract');
  items.splice(gcIdx + 1, 0, {
    id: 'gc-sitework',
    code: '200202',
    group: 'General Construction Contract',
    label: 'Sitework',
    amountType: 'fixed',
    value: 300_000,
  });
  if (!is16) {
    // 9.23 adds FHA / ADA / TAS under 300309 alongside the existing 300310 line (both $10,000).
    const mtIdx = items.findIndex((i) => i.id === 'materials-testing');
    items.splice(mtIdx + 1, 0, {
      id: 'fha-ada-tas-309',
      code: '300309',
      group: 'Special Inspections & Testing',
      label: 'FHA / ADA / TAS',
      amountType: 'fixed',
      value: 10_000,
    });
  }
  a.costs.lineItems = items;
  return a;
}
