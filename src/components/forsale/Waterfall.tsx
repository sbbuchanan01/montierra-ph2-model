'use client';

import { Card, Field, PctInput, StatCard, Th, Td, Money } from '@/components/ui';
import { useForSale } from '@/store/useModelStore';
import { fmtMoney, fmtPct, fmtX } from '@/lib/format';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';

/** Equity structure & promote — Inputs §8 and the Waterfall tab. */
export function ForSaleWaterfall() {
  const { a, m, update } = useForSale();
  const E = a.equity;
  const setE = (patch: Partial<typeof E>) => update((d) => ({ ...d, equity: { ...d.equity, ...patch } }));
  const R = m.returns;
  const lp = 1 - E.gpShare;

  const dist = m.annual
    .filter((y) => y.year * 12 <= m.schedule.sellout + 12)
    .map((y) => ({ label: `Y${y.year}`, lp: Math.round(y.lpNet), gp: Math.round(y.gpNet) }));

  const split = (promote: number) => `${fmtPct((1 - promote) * lp, 1)} / ${fmtPct(promote + (1 - promote) * E.gpShare, 1)}`;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <StatCard label="LP IRR" value={fmtPct(R.lpIrr)} sub={`MOIC ${fmtX(R.lpMoic)} · profit ${fmtMoney(R.lpProfit)}`} accent />
        <StatCard label="GP IRR" value={fmtPct(R.gpIrr)} sub={`MOIC ${fmtX(R.gpMoic)} · profit ${fmtMoney(R.gpProfit)}`} accent />
        <StatCard label="Levered IRR" value={fmtPct(R.leveredIrr)} sub={`MOIC ${fmtX(R.leveredMoic)}`} />
        <StatCard label="GP Promote Earned" value={fmtMoney(R.gpPromote)} sub="Tiers 2 & 3" />
        <StatCard label="Preferred Return Paid" value={fmtMoney(R.prefPaid)} sub={R.unpaidPref < 1 ? 'pref cleared by sellout' : `${fmtMoney(R.unpaidPref)} unpaid at sellout`} />
        <StatCard label="Return of Capital" value={fmtMoney(R.returnOfCapital)} sub={`of ${fmtMoney(R.totalEquityInvested)} invested`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Equity Structure & Promote">
          <div className="grid grid-cols-2 gap-3">
            <Field label="GP / sponsor equity share" hint="Co-invest, contributed pari passu"><PctInput value={E.gpShare} onChange={(v) => setE({ gpShare: v })} step={1} /></Field>
            <Field label="Preferred return (annual, compounded monthly)"><PctInput value={E.preferredReturn} onChange={(v) => setE({ preferredReturn: v })} step={0.5} /></Field>
            <Field label="Tier 2 — GP promote until the IRR hurdle"><PctInput value={E.tier2Promote} onChange={(v) => setE({ tier2Promote: v })} step={0.5} /></Field>
            <Field label="IRR hurdle (partner-level)"><PctInput value={E.irrHurdle} onChange={(v) => setE({ irrHurdle: v })} step={0.5} /></Field>
            <Field label="Tier 3 — GP promote above the hurdle"><PctInput value={E.tier3Promote} onChange={(v) => setE({ tier3Promote: v })} step={0.5} /></Field>
          </div>
          <table className="mt-4 w-full">
            <tbody>
              {(
                [
                  ['Effective split — Tier 1 (LP / GP)', `${fmtPct(lp, 1)} / ${fmtPct(E.gpShare, 1)}`],
                  ['Effective split — Tier 2 (LP / GP incl. promote)', split(E.tier2Promote)],
                  ['Effective split — Tier 3 (LP / GP incl. promote)', split(E.tier3Promote)],
                  ['GP equity $', fmtMoney(m.financing.gpEquity)],
                  ['LP equity $', fmtMoney(m.financing.lpEquity)],
                ] as [string, string][]
              ).map(([label, v]) => (
                <tr key={label} className="border-t border-slate-100">
                  <Td right={false} className="text-slate-700">{label}</Td>
                  <Td>{v}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Annual Net Cash Flow to Partners (post-promote)" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={dist} margin={{ left: 10, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} width={52} />
                <Tooltip formatter={(v) => fmtMoney(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="lp" fill="#0f2a43" name="LP net" />
                <Bar dataKey="gp" fill="#6b93b8" name="GP net" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="mt-3 w-full">
            <thead>
              <tr>
                <Th right={false} />
                <Th>Project (levered)</Th>
                <Th>LP</Th>
                <Th>GP</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100"><Td right={false} className="text-slate-600">Contributions</Td><Td><Money v={-R.totalEquityInvested} colored /></Td><Td><Money v={m.waterfall.reduce((s, w) => s + w.lpContributions, 0)} colored /></Td><Td><Money v={m.waterfall.reduce((s, w) => s + w.gpContributions, 0)} colored /></Td></tr>
              <tr className="border-t border-slate-100"><Td right={false} className="text-slate-600">Distributions</Td><Td><Money v={R.totalEquityInvested + R.leveredProfit} colored /></Td><Td><Money v={m.waterfall.reduce((s, w) => s + w.lpDistributions, 0)} colored /></Td><Td><Money v={m.waterfall.reduce((s, w) => s + w.gpDistributions, 0)} colored /></Td></tr>
              <tr className="border-t border-slate-100 font-semibold"><Td right={false} className="text-slate-600">Profit</Td><Td><Money v={R.leveredProfit} colored /></Td><Td><Money v={R.lpProfit} colored /></Td><Td><Money v={R.gpProfit} colored /></Td></tr>
              <tr className="border-t border-slate-100"><Td right={false} className="text-slate-600">XIRR</Td><Td>{fmtPct(R.leveredIrr)}</Td><Td>{fmtPct(R.lpIrr)}</Td><Td>{fmtPct(R.gpIrr)}</Td></tr>
              <tr className="border-t border-slate-100"><Td right={false} className="text-slate-600">Equity multiple</Td><Td>{fmtX(R.leveredMoic)}</Td><Td>{fmtX(R.lpMoic)}</Td><Td>{fmtX(R.gpMoic)}</Td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      <Card title="Distribution Waterfall — Monthly" subtitle="Pref → return of capital → promote to the IRR hurdle → promote thereafter. Months with cash only.">
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="sticky top-0 bg-white">
              <tr>
                <Th>Mo</Th>
                <Th>Levered CF</Th>
                <Th>Contributed</Th>
                <Th>Pref Accrual</Th>
                <Th>Pref Paid</Th>
                <Th>Return of Capital</Th>
                <Th>Unreturned EOP</Th>
                <Th>Hurdle EOP</Th>
                <Th>Tier 2 Partner</Th>
                <Th>Tier 2 Promote</Th>
                <Th>Tier 3 Partner</Th>
                <Th>Tier 3 Promote</Th>
                <Th>LP Net</Th>
                <Th>GP Net</Th>
              </tr>
            </thead>
            <tbody>
              {m.waterfall.filter((w) => w.month <= Math.min(120, m.schedule.sellout)).map((w) => (
                <tr key={w.month} className="border-t border-slate-100">
                  <Td>{w.month}</Td>
                  <Td><Money v={w.levered} colored /></Td>
                  <Td><Money v={w.contributed} /></Td>
                  <Td><Money v={w.prefAccrual} /></Td>
                  <Td><Money v={w.prefPaid} /></Td>
                  <Td><Money v={w.returnOfCapital} /></Td>
                  <Td className="text-slate-500"><Money v={w.capitalEop} /></Td>
                  <Td className="text-slate-500"><Money v={w.hurdleEop} /></Td>
                  <Td><Money v={w.tier2Partner} /></Td>
                  <Td><Money v={w.tier2Promote} /></Td>
                  <Td><Money v={w.tier3Partner} /></Td>
                  <Td><Money v={w.tier3Promote} /></Td>
                  <Td><Money v={w.lpNet} colored /></Td>
                  <Td><Money v={w.gpNet} colored /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
