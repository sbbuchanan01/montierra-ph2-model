'use client';

import { Th, Td, Money } from '@/components/ui';
import { useActiveProject, useForSale } from '@/store/useModelStore';
import { fmtDate, fmtMoney, fmtNum, fmtPct, fmtX } from '@/lib/format';
import { SECTION_LABEL } from './common';

/** One-page printable summary of a for-sale case. */
export function ForSaleExport() {
  const { a, m } = useForSale();
  const project = useActiveProject();
  const projectName = project?.name ?? a.project.name;
  const location = project ? [project.city, project.state].filter(Boolean).join(', ') : a.project.location;
  const productType = project?.constructionType || a.project.productType;
  const T = m.margin.trended;
  const R = m.returns;
  const B = m.budget;

  const uses: [string, number][] = [
    [SECTION_LABEL.land, B.landSubtotal],
    [SECTION_LABEL.hard, B.hardSubtotal],
    [SECTION_LABEL.soft, B.softSubtotal],
    [SECTION_LABEL.financing, B.financingSubtotal],
    [SECTION_LABEL.reserves, B.reservesSubtotal],
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 print:hidden">
        <button onClick={() => window.print()} className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Print / Save as PDF
        </button>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="border-b-2 border-slate-900 pb-3">
          <h2 className="text-xl font-bold text-slate-900">{projectName} — For-Sale Development Summary</h2>
          <p className="text-sm text-slate-500">
            {[location, productType].filter(Boolean).join(' · ')} · {fmtNum(m.units)} homes / {fmtNum(m.nsf)} net saleable SF
          </p>
        </div>

        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Program & Schedule</h3>
            <table className="w-full">
              <tbody>
                {(
                  [
                    ['Location', location || '—'],
                    ['Acreage', `${a.project.siteAcres} ac (${fmtNum(m.density, 1)} homes / acre)`],
                    ['Product type', productType || '—'],
                    ['Homes / average size', `${fmtNum(m.units)} / ${fmtNum(m.avgSf)} SF`],
                    ["Base price per home (today's $)", `${fmtMoney(m.waPrice)} (${fmtMoney(m.waPsf, 2)}/SF)`],
                    ['Land closing', fmtDate(m.schedule.landClosingDate)],
                    ['Construction', `M${m.schedule.constructionStart}–M${m.schedule.constructionEnd} (${a.schedule.constructionMonths} months)`],
                    ['First CO / first closing', `M${m.schedule.firstCo} / M${m.schedule.firstClosing}`],
                    ['Sellout', `M${m.schedule.sellout} · ${fmtDate(m.schedule.selloutDate)}`],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <tr key={k} className="border-t border-slate-100">
                    <Td right={false} className="text-slate-600">{k}</Td>
                    <Td>{v}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Sources & Uses</h3>
            <table className="w-full">
              <thead>
                <tr><Th right={false}>Uses</Th><Th>Amount</Th><Th>$/Home</Th></tr>
              </thead>
              <tbody>
                {uses.map(([k, v]) => (
                  <tr key={k} className="border-t border-slate-100">
                    <Td right={false} className="text-slate-600">{k}</Td>
                    <Td><Money v={v} /></Td>
                    <Td className="text-slate-500">{fmtMoney(v / Math.max(1, m.units))}</Td>
                  </tr>
                ))}
                <tr className="border-t border-slate-300 font-semibold"><Td right={false}>Total uses</Td><Td><Money v={B.total} /></Td><Td>{fmtMoney(B.total / Math.max(1, m.units))}</Td></tr>
                <tr className="border-t border-slate-100"><Td right={false} className="text-slate-600">Construction loan ({fmtPct(m.financing.commitmentPctOfCost, 1)} LTC)</Td><Td><Money v={m.financing.commitment} /></Td><Td className="text-slate-500">{fmtMoney(m.financing.loanPerUnit)}</Td></tr>
                <tr className="border-t border-slate-100"><Td right={false} className="text-slate-600">Equity (GP {fmtPct(a.equity.gpShare, 0)} / LP {fmtPct(1 - a.equity.gpShare, 0)})</Td><Td><Money v={m.financing.equity} /></Td><Td className="text-slate-500">{fmtMoney(m.financing.equity / Math.max(1, m.units))}</Td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Margin on Cost (trended)</h3>
            <table className="w-full">
              <tbody>
                {(
                  [
                    ['Gross sellout at closing prices', T.gross],
                    ['Closing deductions', T.commissions + T.litigation + T.escrow + T.sellerClosing + T.incentives],
                    ['Net sales proceeds', T.netSales],
                    ['Carry, taxes & warranty on unsold inventory', T.directCarry + T.taxes + T.warranty],
                    ['Development cost excl. interest', T.costExInterest],
                    ['Construction interest', T.interest],
                    ['Net profit (levered, before promote)', T.netProfit],
                  ] as [string, number][]
                ).map(([k, v], i, arr) => (
                  <tr key={k} className={`border-t border-slate-100 ${i === arr.length - 1 ? 'font-semibold' : ''}`}>
                    <Td right={false} className="text-slate-600">{k}</Td>
                    <Td><Money v={v} colored /></Td>
                  </tr>
                ))}
                <tr className="border-t border-slate-300"><Td right={false} className="text-slate-600">Margin on gross sales / return on cost</Td><Td>{fmtPct(T.marginOnGross, 1)} / {fmtPct(T.returnOnCost, 1)}</Td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Returns</h3>
            <table className="w-full">
              <thead>
                <tr><Th right={false} /><Th>Unlevered</Th><Th>Levered</Th><Th>LP</Th><Th>GP</Th></tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100"><Td right={false} className="text-slate-600">XIRR</Td><Td>{fmtPct(R.unleveredIrr)}</Td><Td>{fmtPct(R.leveredIrr)}</Td><Td>{fmtPct(R.lpIrr)}</Td><Td>{fmtPct(R.gpIrr)}</Td></tr>
                <tr className="border-t border-slate-100"><Td right={false} className="text-slate-600">Equity multiple</Td><Td>{fmtX(R.unleveredMoic)}</Td><Td>{fmtX(R.leveredMoic)}</Td><Td>{fmtX(R.lpMoic)}</Td><Td>{fmtX(R.gpMoic)}</Td></tr>
                <tr className="border-t border-slate-100"><Td right={false} className="text-slate-600">Profit</Td><Td><Money v={R.unleveredProfit} /></Td><Td><Money v={R.leveredProfit} /></Td><Td><Money v={R.lpProfit} /></Td><Td><Money v={R.gpProfit} /></Td></tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-slate-500">
              Preferred return {fmtPct(a.equity.preferredReturn, 1)} · {fmtPct(a.equity.tier2Promote, 1)} promote to an {fmtPct(a.equity.irrHurdle, 0)} IRR hurdle, {fmtPct(a.equity.tier3Promote, 1)} thereafter · GP promote earned {fmtMoney(R.gpPromote)} · peak equity outstanding {fmtMoney(R.peakEquityOutstanding)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
