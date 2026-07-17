import { xirr } from './finance';
import type { Assumptions, WaterfallMonth, WaterfallResult } from './types';

/**
 * JV promote waterfall — a faithful port of the `Waterfall` sheet.
 *
 * Each tier runs a monthly NPV "underwater / crossing / caught-up" test at the
 * tier's monthly-equivalent rate. While cumulative NPV of the partner's
 * available cash (contributions negative) is < 0 the partner receives the full
 * available amount; in the month the NPV flips positive they receive a one-time
 * catch-up equal to FV(rate, monthNumber) of the NPV of what they have been
 * paid so far (the workbook's exact FV convention, including its use of the
 * month number rather than monthNumber-1 as the compounding period count).
 */

interface TierState {
  npvAvailPrev: number; // NPV of "available" series through prior month
  npvPaid: number; // NPV of paid series through prior month
}

function stepTier(
  state: TierState,
  avail: number,
  monthNumber: number, // 1-based
  monthlyRate: number,
  disabled: boolean, // rate or share is zero -> pass-through handled by caller
): { paid: number; npvAvailNow: number } {
  const disc = Math.pow(1 + monthlyRate, monthNumber - 1);
  const npvAvailNow = state.npvAvailPrev + avail / disc;
  if (disabled) return { paid: 0, npvAvailNow };

  let paid = 0;
  if (monthNumber === 1) {
    // Row 15 in the sheet flows the first month straight through (equity out).
    paid = avail;
  } else if (npvAvailNow < 0) {
    paid = avail;
  } else if (state.npvAvailPrev < 0 && npvAvailNow > 0) {
    // catch-up: FV of the NPV of payments made so far, at the tier rate
    paid = -state.npvPaid * Math.pow(1 + monthlyRate, monthNumber);
  }
  return { paid, npvAvailNow };
}

export function runWaterfall(
  projectCf: number[],
  dates: Date[],
  lpEquity: number,
  gpEquity: number,
  wf: Assumptions['waterfall'],
): WaterfallResult {
  const n = projectCf.length;
  const lpPct = 1 - wf.gpOwnershipPct;
  const gpPct = wf.gpOwnershipPct;
  const iPref = Math.pow(1 + wf.preferredReturn, 1 / 12) - 1;
  const iH1 = Math.pow(1 + wf.hurdle1Rate, 1 / 12) - 1;
  const iH2 = Math.pow(1 + wf.hurdle2Rate, 1 / 12) - 1;

  const prefDisabled = wf.preferredReturn === 0 || lpPct === 0 || gpPct === 0;
  const h1Disabled = wf.hurdle1Rate === 0 || wf.lpShareHurdle1 === 0;
  const h2Disabled = wf.hurdle2Rate === 0 || wf.lpShareHurdle2 === 0;

  const lpPrefState: TierState = { npvAvailPrev: 0, npvPaid: 0 };
  const gpPrefState: TierState = { npvAvailPrev: 0, npvPaid: 0 };
  const lpH1State: TierState = { npvAvailPrev: 0, npvPaid: 0 };
  const lpH2State: TierState = { npvAvailPrev: 0, npvPaid: 0 };

  const months: WaterfallMonth[] = [];
  const S: number[] = []; // LP paid at pref
  const U: number[] = []; // GP paid at pref
  const X: number[] = []; // LP through hurdle 1
  const Z: number[] = []; // GP through hurdle 1
  const AC: number[] = []; // LP through hurdle 2
  const AE: number[] = []; // GP through hurdle 2
  const AG: number[] = []; // LP total
  const AH: number[] = []; // GP total

  for (let m = 1; m <= n; m++) {
    const q = projectCf[m - 1];
    const disc = Math.pow(1 + iPref, m - 1);
    const discH1 = Math.pow(1 + iH1, m - 1);
    const discH2 = Math.pow(1 + iH2, m - 1);

    // --- Preferred tier (LP and GP tested separately, pro-rata available) ---
    const r = q * lpPct;
    const t = q * gpPct;
    const lpPrefRes = stepTier(lpPrefState, r, m, iPref, prefDisabled);
    const gpPrefRes = stepTier(gpPrefState, t, m, iPref, prefDisabled);
    const s = lpPrefRes.paid;
    const u = gpPrefRes.paid;
    lpPrefState.npvAvailPrev = lpPrefRes.npvAvailNow;
    lpPrefState.npvPaid += s / disc;
    gpPrefState.npvAvailPrev = gpPrefRes.npvAvailNow;
    gpPrefState.npvPaid += u / disc;

    // --- Hurdle 1 ---
    const v = q - s - u;
    const w = s + v * wf.lpShareHurdle1;
    let x: number;
    if (h1Disabled) {
      x = s;
      lpH1State.npvAvailPrev += w / discH1;
    } else {
      const res = stepTier(lpH1State, w, m, iH1, false);
      x = res.paid;
      lpH1State.npvAvailPrev = res.npvAvailNow;
    }
    lpH1State.npvPaid += x / discH1;
    const y = h1Disabled ? 0 : ((x - s) / wf.lpShareHurdle1) * (1 - wf.lpShareHurdle1);
    const z = u + y;

    // --- Hurdle 2 ---
    const aa = q - x - z;
    const ab = x + aa * wf.lpShareHurdle2;
    let ac: number;
    if (h2Disabled) {
      ac = x;
      lpH2State.npvAvailPrev += ab / discH2;
    } else {
      const res = stepTier(lpH2State, ab, m, iH2, false);
      ac = res.paid;
      lpH2State.npvAvailPrev = res.npvAvailNow;
    }
    lpH2State.npvPaid += ac / discH2;
    const ad = h2Disabled ? 0 : ((ac - x) / wf.lpShareHurdle2) * (1 - wf.lpShareHurdle2);
    const ae = z + ad;

    // --- Final split ---
    const af = q - ac - ae;
    const ag = ac + af * wf.lpShareFinal;
    const ah = ae + af * (1 - wf.lpShareFinal);

    S.push(s);
    U.push(u);
    X.push(x);
    Z.push(z);
    AC.push(ac);
    AE.push(ae);
    AG.push(ag);
    AH.push(ah);

    months.push({
      month: m,
      date: dates[m - 1].toISOString().slice(0, 10),
      projectCf: q,
      lpPref: s,
      gpPref: u,
      lpH1: x - s,
      gpH1: z - u,
      lpH2: ac - x,
      gpH2: ae - z,
      lpTotal: ag,
      gpTotal: ah,
    });
  }

  const sum = (arr: number[]) => arr.reduce((acc, v) => acc + v, 0);
  const lpNet = sum(AG);
  const gpNet = sum(AH);
  const totalEquity = lpEquity + gpEquity;
  const projectNet = sum(projectCf);

  return {
    months,
    lpEquity,
    gpEquity,
    totalEquity,
    lpNetCashFlow: lpNet,
    gpNetCashFlow: gpNet,
    lpMoic: lpEquity > 0 ? (lpNet + lpEquity) / lpEquity : 0,
    gpMoic: gpEquity > 0 ? (gpNet + gpEquity) / gpEquity : 0,
    projectMoic: totalEquity > 0 ? (projectNet + totalEquity) / totalEquity : 0,
    lpIrr: xirr(AG, dates),
    gpIrr: xirr(AH, dates),
    projectIrr: xirr(projectCf, dates),
    tierTotals: {
      lp: {
        pref: sum(S),
        hurdle1: sum(X) - sum(S),
        hurdle2: sum(AC) - sum(X),
        final: lpNet - sum(AC),
      },
      gp: {
        pref: sum(U),
        hurdle1: sum(Z) - sum(U),
        hurdle2: sum(AE) - sum(Z),
        final: gpNet - sum(AE),
      },
    },
  };
}
