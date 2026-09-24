/**
 * Server-renders every for-sale page component against the template case so a rendering error
 * (a missing field, a bad map, a null IRR) shows up without a browser session.
 *   npx tsx scripts/render-forsale.tsx
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import { useModelStore } from '@/store/useModelStore';
import { TH_TEMPLATE_ASSUMPTIONS } from '@/lib/forsale/defaults';
import { DEFAULT_ASSUMPTIONS } from '@/lib/model/defaults';
import { ForSaleSummary } from '@/components/forsale/Summary';
import { ForSaleProgram } from '@/components/forsale/Program';
import { ForSaleSales } from '@/components/forsale/Sales';
import { ForSaleBudget } from '@/components/forsale/Budget';
import { ForSaleFinancing } from '@/components/forsale/Financing';
import { ForSaleCurve } from '@/components/forsale/Curve';
import { ForSaleWaterfall } from '@/components/forsale/Waterfall';
import { ForSaleCashFlow } from '@/components/forsale/CashFlow';
import { ForSaleReturns } from '@/components/forsale/Returns';
import { ForSaleCarryTaxes } from '@/components/forsale/CarryTaxes';
import { ForSaleExport } from '@/components/forsale/Export';

useModelStore.setState({
  loaded: true,
  projects: [
    {
      id: 'p', name: 'Montierra Ph. II', city: 'Leander', state: 'TX', constructionType: 'Townhomes',
      createdAt: '', updatedAt: '', baseCase: TH_TEMPLATE_ASSUMPTIONS, scenarios: [],
    },
  ],
  activeProjectId: 'p',
  activeScenarioId: null,
  assumptions: TH_TEMPLATE_ASSUMPTIONS,
  dirty: false,
});
// renderToString reads useSyncExternalStore's SERVER snapshot, which zustand takes from the store's
// initial state — the DEFAULT_ASSUMPTIONS object itself. Turn that object into the for-sale case in place.
Object.assign(DEFAULT_ASSUMPTIONS, structuredClone(TH_TEMPLATE_ASSUMPTIONS));

const pages: [string, React.ComponentType][] = [
  ['Summary', ForSaleSummary],
  ['Program', ForSaleProgram],
  ['Sales', ForSaleSales],
  ['Budget', ForSaleBudget],
  ['Financing', ForSaleFinancing],
  ['Curve', ForSaleCurve],
  ['Waterfall', ForSaleWaterfall],
  ['CashFlow', ForSaleCashFlow],
  ['Returns', ForSaleReturns],
  ['CarryTaxes', ForSaleCarryTaxes],
  ['Export', ForSaleExport],
];

let failed = 0;
for (const [name, C] of pages) {
  try {
    const html = renderToString(React.createElement(C));
    const bad = ['NaN', 'undefined', '$—', 'Infinity'].filter((t) => html.includes(t));
    console.log(`${name.padEnd(11)} ${String(html.length).padStart(7)} chars${bad.length ? `  ⚠ contains ${bad.join(', ')}` : ''}`);
    if (bad.length) failed++;
  } catch (e) {
    failed++;
    console.log(`${name.padEnd(11)} FAILED: ${(e as Error).message}`);
  }
}
process.exit(failed ? 1 : 0);
