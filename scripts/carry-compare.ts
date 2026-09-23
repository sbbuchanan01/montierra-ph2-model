import { runModel } from '../src/lib/model/engine';
import { DEFAULT_ASSUMPTIONS } from '../src/lib/model/defaults';
import { v4Assumptions } from './v4-scenarios';
const pct = (x: number | null) => (x == null ? 'n/a' : (x * 100).toFixed(2) + '%');
const m = (x: number) => '$' + Math.round(x).toLocaleString();
for (const [n, a] of [['Base', DEFAULT_ASSUMPTIONS], ['16-unit', v4Assumptions({ units: 16 })], ['10-unit TH', v4Assumptions({ units: 10 })]] as const) {
  for (const cm of ['workbook', 'template'] as const) {
    const o = runModel({ ...structuredClone(a), carryModel: cm });
    const g = (c: string) => o.budget.rows.filter((r) => r.code === c).reduce((s, r) => s + r.amount, 0);
    console.log(`${n.padEnd(11)} ${cm.padEnd(9)} uses ${m(o.budget.totalGross).padEnd(11)} int ${m(g('600614')).padEnd(9)} deficit ${m(g('700702')).padEnd(8)} capTax ${m(g('700703')).padEnd(9)} stabNOI ${m(o.operatingYield.stabilized.combinedNoi).padEnd(9)} ROC(untr) ${pct(o.operatingYield.untrended.returnOnCostGross)} XIRR ${pct(o.returns.projectXirr)} MOIC ${o.returns.projectMoic.toFixed(2)}x loan ${m(o.financing.loanAmount)} ${o.financing.sizing ? '(' + o.financing.sizing.binding + ')' : ''}`);
  }
}
