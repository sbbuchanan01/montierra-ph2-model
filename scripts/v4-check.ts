import { runModel } from '../src/lib/model/engine';
import { v4Assumptions } from './v4-scenarios';

const targets = {
  16: { uses: 4382997.1731686955, loan: 2739373.233230435, xirr: 0.10613678768277168, moic: 1.5924836857836617, profit: 973820.3699768848, lpIrr: 0.10433720424771309, gpIrr: 0.11322102323174477, sale: 5270848.322474079, extInt: 57251.49955224983, taxes: 92962.72935400004, carry: 180.17727862730618, cont: 66425.03465151416 },
  10: { uses: 4030203.480996626, loan: 0, xirr: 0.16661503911018374, moic: 2.0287, profit: 1554745.27, lpIrr: 0, gpIrr: 0, sale: 0, extInt: 57159.99889669985, taxes: 81515.623585, carry: 1134.5964001980467, cont: 59564.49035849931 },
} as const;

for (const units of [16, 10] as const) {
  const o = runModel(v4Assumptions({ units }));
  const t = targets[units];
  const row = (k: string) => o.budget.rows.filter((r) => r.code === k).reduce((s, r) => s + r.amount, 0);
  const got = {
    uses: o.budget.totalGross, loan: o.financing.loanAmount, xirr: o.returns.projectXirr, moic: o.returns.projectMoic,
    profit: o.waterfall.lpNetCashFlow + o.waterfall.gpNetCashFlow, lpIrr: o.waterfall.lpIrr, gpIrr: o.waterfall.gpIrr,
    sale: o.sale.mfSalePrice, extInt: row('600614'), taxes: row('700703'), carry: row('700702'), cont: row('800807'),
  };
  console.log(`== ${units} units (converged ${o.converged})`);
  for (const k of Object.keys(t) as (keyof typeof t)[]) console.log(k.padEnd(8), String(got[k]).padEnd(22), t[k], ' diff', (got[k] as number) - t[k]);
}
