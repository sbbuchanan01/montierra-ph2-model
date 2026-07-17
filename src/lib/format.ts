export const fmtMoney = (v: number, digits = 0): string => {
  const abs = Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return v < -0.004 ? `($${abs})` : `$${abs}`;
};

export const fmtNum = (v: number, digits = 0): string =>
  v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtPct = (v: number | null | undefined, digits = 2): string =>
  v == null || !isFinite(v) ? '—' : `${(v * 100).toFixed(digits)}%`;

export const fmtX = (v: number, digits = 2): string => `${v.toFixed(digits)}x`;

export const fmtDate = (iso: string): string => {
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

export const moneyClass = (v: number): string =>
  v < -0.004 ? 'text-red-600' : v > 0.004 ? 'text-emerald-700' : 'text-slate-400';
