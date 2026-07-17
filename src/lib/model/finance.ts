/**
 * Excel-equivalent financial math helpers.
 * These intentionally mirror Excel semantics (NPV discounts the first value
 * one period, FV(rate, nper,, pv) = -pv*(1+rate)^nper, PPMT, XIRR actual/365).
 */

/** Excel NPV: values[0] is discounted one period. */
export function excelNpv(rate: number, values: number[]): number {
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i] / Math.pow(1 + rate, i + 1);
  }
  return sum;
}

/** Excel FV with only pv supplied: FV(rate, nper,, pv) = -pv*(1+rate)^nper */
export function excelFv(rate: number, nper: number, pv: number): number {
  return -pv * Math.pow(1 + rate, nper);
}

/** Excel PMT (payment per period, pv positive => negative payment). */
export function pmt(rate: number, nper: number, pv: number, fv = 0, type = 0): number {
  if (rate === 0) return -(pv + fv) / nper;
  const pow = Math.pow(1 + rate, nper);
  return (-(pv * pow + fv) * rate) / ((pow - 1) * (1 + rate * type));
}

/** Excel IPMT. */
export function ipmt(rate: number, per: number, nper: number, pv: number): number {
  const payment = pmt(rate, nper, pv);
  // balance after per-1 payments
  const pow = Math.pow(1 + rate, per - 1);
  const balance = pv * pow + payment * ((pow - 1) / rate);
  return -balance * rate;
}

/** Excel PPMT. */
export function ppmt(rate: number, per: number, nper: number, pv: number): number {
  return pmt(rate, nper, pv) - ipmt(rate, per, nper, pv);
}

/** XIRR with Excel day-count (actual days / 365). dates are JS Dates. */
export function xirr(values: number[], dates: Date[], guess = 0.1): number | null {
  if (values.length !== dates.length || values.length < 2) return null;
  const hasPos = values.some((v) => v > 0);
  const hasNeg = values.some((v) => v < 0);
  if (!hasPos || !hasNeg) return null;

  const t0 = dates[0].getTime();
  const years = dates.map((d) => (d.getTime() - t0) / (365 * 24 * 3600 * 1000));

  const f = (r: number) => {
    let s = 0;
    for (let i = 0; i < values.length; i++) s += values[i] / Math.pow(1 + r, years[i]);
    return s;
  };
  const df = (r: number) => {
    let s = 0;
    for (let i = 0; i < values.length; i++) {
      s += (-years[i] * values[i]) / Math.pow(1 + r, years[i] + 1);
    }
    return s;
  };

  // Newton's method
  let r = guess;
  for (let iter = 0; iter < 100; iter++) {
    const fr = f(r);
    const dfr = df(r);
    if (Math.abs(dfr) < 1e-12) break;
    const next = r - fr / dfr;
    if (!isFinite(next) || next <= -0.999999) break;
    if (Math.abs(next - r) < 1e-9) return next;
    r = next;
  }
  // Bisection fallback
  let lo = -0.9999,
    hi = 10;
  let flo = f(lo),
    fhi = f(hi);
  if (flo * fhi > 0) return isFinite(r) ? r : null;
  for (let iter = 0; iter < 300; iter++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < 1e-7 || hi - lo < 1e-10) return mid;
    if (flo * fm < 0) {
      hi = mid;
      fhi = fm;
    } else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

/** EDATE-style month addition anchored to first-of-month dates. */
export function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}
