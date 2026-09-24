/**
 * Prints the "10-Unit TH (For Sale)" scenario assumptions as JSON, ready to insert into
 * montierra_scenarios (or to diff against the saved row). Source: TH_TEMPLATE_ASSUMPTIONS, which is
 * `Townhome For-Sale Development Model - TEMPLATE v2.xlsx` verbatim.
 *   npx tsx scripts/th-forsale-scenario.ts > th.json
 */
import { TH_TEMPLATE_ASSUMPTIONS } from '../src/lib/forsale/defaults';
import { runForSaleModel } from '../src/lib/forsale/engine';

const m = runForSaleModel(TH_TEMPLATE_ASSUMPTIONS);
console.error(
  `total cost ${m.budget.total.toFixed(2)} · commitment ${m.financing.commitment.toFixed(2)} · profit ${m.returns.leveredProfit.toFixed(2)} · levered IRR ${((m.returns.leveredIrr ?? 0) * 100).toFixed(4)}%`,
);
console.log(JSON.stringify(TH_TEMPLATE_ASSUMPTIONS));
