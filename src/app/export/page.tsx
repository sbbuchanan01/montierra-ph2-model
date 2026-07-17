'use client';

import { useState } from 'react';
import { Card, Th, Td, Money } from '@/components/ui';
import { useModel, useModelStore } from '@/store/useModelStore';
import { fmtDate, fmtMoney, fmtNum, fmtPct, fmtX } from '@/lib/format';

type Variant = 'jv' | 'debt';

export default function ExportPage() {
  const m = useModel();
  const a = useModelStore((s) => s.assumptions);
  const [variant, setVariant] = useState<Variant>('jv');

  const perUnit = (v: number) => fmtMoney(v / Math.max(1, m.totalUnits));
  const perSf = (v: number) => fmtMoney(v / Math.max(1, m.totalNrsf));

  const uses: [string, number][] = [
    ['Land', m.budget.landTotal],
    ['Hard Costs', m.budget.hardCostTotal],
    ['Soft Costs (Consultants, Etc.)', m.budget.softCostConsultants + m.budget.softCostMarketing + m.budget.softCostMunicipal],
    ['Soft Costs (Financing)', m.budget.softCostFinancing],
    ['Soft Costs (Operating, G&A)', m.budget.softCostOperating + m.budget.softCostGa],
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 print:hidden">
        {(
          [
            ['jv', 'JV Equity Request'],
            ['debt', 'Loan Request'],
          ] as [Variant, string][]
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setVariant(v)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              variant === v ? 'bg-slate-900 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => window.print()}
          className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="border-b-2 border-slate-900 pb-3">
          <h2 className="text-xl font-bold text-slate-900">
            {a.project.name} — {variant === 'jv' ? 'JV Equity Request' : 'Loan Request'}
          </h2>
          <p className="text-sm text-slate-500">
            {a.project.location} · {a.project.productType} · {fmtNum(m.totalUnits)} units / {fmtNum(m.totalNrsf)} NRSF
          </p>
        </div>

        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Property Summary</h3>
            <table className="w-full">
              <tbody>
                {(
                  [
                    ['Location', a.project.location],
                    ['Acreage', `${a.project.siteAcres} ac`],
                    ['Product Type', a.project.productType],
                    ['Units', fmtNum(m.totalUnits)],
                    ['Net Rentable SF', fmtNum(m.totalNrsf)],
                    ['Average Unit Size', `${fmtNum(m.totalNrsf / Math.max(1, m.totalUnits))} SF`],
                    ['Retail SF', fmtNum(m.retailSf)],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <tr key={k} className="border-t border-slate-100">
                    <Td right={false} className="text-slate-500">{k}</Td>
                    <Td className="font-medium">{v}</Td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">Financial Projections</h3>
            <table className="w-full">
              <tbody>
                {(
                  [
                    ['Total Project Cost', fmtMoney(m.budget.totalGross)],
                    ['Loan to Cost', fmtPct(a.financing.construction.ltc, 1)],
                    ['Proforma Rent / Month', fmtMoney(m.avgRent)],
                    ['Proforma Rent PSF', `$${(m.avgRent / (m.totalNrsf / Math.max(1, m.totalUnits))).toFixed(2)}`],
                    ['Untrended Return on Cost', fmtPct(m.operatingYield.untrended.returnOnCostGross)],
                    ['Stabilized Return on Cost', fmtPct(m.operatingYield.stabilized.returnOnCostGross)],
                    ...(variant === 'jv'
                      ? ([
                          ['Project Level IRR', fmtPct(m.returns.projectXirr)],
                          ['Project Level Equity Multiple', fmtX(m.returns.projectMoic)],
                        ] as [string, string][])
                      : ([
                          ['Untrended Debt Yield', fmtPct(m.operatingYield.untrended.debtYield)],
                          ['Untrended DSCR', fmtX(m.operatingYield.untrended.dscr)],
                        ] as [string, string][])),
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <tr key={k} className="border-t border-slate-100">
                    <Td right={false} className="text-slate-500">{k}</Td>
                    <Td className="font-medium">{v}</Td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">Estimated Timeline</h3>
            <table className="w-full">
              <tbody>
                {(
                  [
                    ['Land Closing', m.monthly[a.schedule.landClosingMonth - 1]?.date],
                    ['Construction Commencement', m.monthly[a.schedule.softCostStartMonth - 1]?.date],
                    ['Completion (CO)', m.monthly[m.constructionEndMonth - 1]?.date],
                    ['Stabilization', m.stabilizationDate],
                    ['Sale', m.sale.date],
                  ] as [string, string | undefined][]
                ).map(([k, v]) => (
                  <tr key={k} className="border-t border-slate-100">
                    <Td right={false} className="text-slate-500">{k}</Td>
                    <Td className="font-medium">{v ? fmtDate(v) : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Capitalization Summary</h3>
            <table className="w-full">
              <thead>
                <tr>
                  <Th right={false} />
                  <Th>Amount</Th>
                  <Th>Per Unit</Th>
                  <Th>%</Th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <Td right={false}>{variant === 'jv' ? 'Assumed Loan Amount' : 'Loan Request'}</Td>
                  <Td><Money v={m.financing.loanAmount} /></Td>
                  <Td>{perUnit(m.financing.loanAmount)}</Td>
                  <Td>{fmtPct(a.financing.construction.ltc, 1)}</Td>
                </tr>
                <tr className="border-t border-slate-100">
                  <Td right={false}>Total Equity Requirement</Td>
                  <Td><Money v={m.financing.equityCommitment} /></Td>
                  <Td>{perUnit(m.financing.equityCommitment)}</Td>
                  <Td>{fmtPct(1 - a.financing.construction.ltc, 1)}</Td>
                </tr>
                <tr className="border-t border-slate-300 font-semibold">
                  <Td right={false}>Total Project Capitalization</Td>
                  <Td><Money v={m.budget.totalGross} /></Td>
                  <Td>{perUnit(m.budget.totalGross)}</Td>
                  <Td>100%</Td>
                </tr>
                <tr className="border-t border-slate-100">
                  <Td right={false}>Sponsor (GP) Equity Commitment</Td>
                  <Td><Money v={m.financing.gpEquity} /></Td>
                  <Td>{perUnit(m.financing.gpEquity)}</Td>
                  <Td>{fmtPct(a.waterfall.gpOwnershipPct, 0)}</Td>
                </tr>
                <tr className="border-t border-slate-100">
                  <Td right={false}>{variant === 'jv' ? 'JV Equity Request' : 'JV Equity Commitment'}</Td>
                  <Td className="font-semibold"><Money v={m.financing.lpEquity} /></Td>
                  <Td>{perUnit(m.financing.lpEquity)}</Td>
                  <Td>{fmtPct(1 - a.waterfall.gpOwnershipPct, 0)}</Td>
                </tr>
              </tbody>
            </table>

            <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">Project Cost Summary</h3>
            <table className="w-full">
              <thead>
                <tr>
                  <Th right={false}>Cost</Th>
                  <Th>Amount</Th>
                  <Th>Per Unit</Th>
                  <Th>Per SF</Th>
                </tr>
              </thead>
              <tbody>
                {uses.map(([k, v]) => (
                  <tr key={k} className="border-t border-slate-100">
                    <Td right={false} className="text-slate-600">{k}</Td>
                    <Td><Money v={v} /></Td>
                    <Td>{perUnit(v)}</Td>
                    <Td>{perSf(v)}</Td>
                  </tr>
                ))}
                <tr className="border-t border-slate-300 font-semibold">
                  <Td right={false}>Total Project Cost</Td>
                  <Td><Money v={m.budget.totalGross} /></Td>
                  <Td>{perUnit(m.budget.totalGross)}</Td>
                  <Td>{perSf(m.budget.totalGross)}</Td>
                </tr>
              </tbody>
            </table>

            <h3 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-slate-500">
              {variant === 'jv' ? 'Returns to JV Partner' : 'Coverage Metrics'}
            </h3>
            <table className="w-full">
              <tbody>
                {(variant === 'jv'
                  ? ([
                      ['LP IRR', fmtPct(m.waterfall.lpIrr)],
                      ['LP Equity Multiple', fmtX(m.waterfall.lpMoic)],
                      ['Preferred Return', fmtPct(a.waterfall.preferredReturn, 1)],
                      ['Hold Period', `${a.schedule.saleMonth} months`],
                    ] as [string, string][])
                  : ([
                      ['Untrended Debt Yield', fmtPct(m.operatingYield.untrended.debtYield)],
                      ['Stabilized Debt Yield', fmtPct(m.operatingYield.stabilized.debtYield)],
                      ['Untrended DSCR', fmtX(m.operatingYield.untrended.dscr)],
                      ['All-in Rate (mo. 1)', fmtPct(m.monthly[0]?.loanRate ?? 0)],
                    ] as [string, string][])
                ).map(([k, v]) => (
                  <tr key={k} className="border-t border-slate-100">
                    <Td right={false} className="text-slate-500">{k}</Td>
                    <Td className="font-medium">{v}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
