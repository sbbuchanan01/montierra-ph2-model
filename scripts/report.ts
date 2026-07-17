import { runModel } from '../src/lib/model/engine';
import { DEFAULT_ASSUMPTIONS } from '../src/lib/model/defaults';

const o = runModel(DEFAULT_ASSUMPTIONS);
const f = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 2 });
const p = (v: number | null) => (v == null ? 'n/a' : (v * 100).toFixed(2) + '%');

console.log('converged:', o.converged, 'iterations:', o.iterations);
console.log('Total Cost (Gross):', f(o.budget.totalGross), '(target 4,686,240.67)');
console.log('Loan:', f(o.financing.loanAmount), '(target 2,928,900.42)');
console.log('Equity:', f(o.financing.equityCommitment), '(target 1,757,340.25)');
console.log('GP:', f(o.financing.gpEquity), ' LP:', f(o.financing.lpEquity));
console.log('MF Sale Price:', f(o.sale.mfSalePrice), '(target ~6,641,826)');
console.log('XIRR:', p(o.returns.projectXirr), '(target ~19.53%)');
console.log('MOIC:', o.returns.projectMoic.toFixed(4), '(target ~2.26x)');
console.log('ROC gross:', p(o.operatingYield.untrended.returnOnCostGross), '(target ~6.58%)');
console.log('Debt Yield:', p(o.operatingYield.untrended.debtYield), '(target ~10.53%)');
console.log('DSCR:', o.operatingYield.untrended.dscr.toFixed(3), '(target ~1.50)');
console.log('Construction end month:', o.constructionEndMonth, ' Lease-up end:', o.leaseUpEndMonth);
console.log('First draw month:', o.financing.firstDrawMonth);
console.log('Capitalized interest:', f(o.financing.capitalizedInterest));
console.log('Origination fee:', f(o.financing.originationFee));
console.log('Net sale proceeds:', f(o.sale.netSaleProceeds));
console.log('--- Waterfall (LP / GP) ---');
console.log('LP IRR:', p(o.waterfall.lpIrr), ' LP MOIC:', o.waterfall.lpMoic.toFixed(3));
console.log('GP IRR:', p(o.waterfall.gpIrr), ' GP MOIC:', o.waterfall.gpMoic.toFixed(3));
console.log('Blended IRR:', p(o.waterfall.projectIrr), ' MOIC:', o.waterfall.projectMoic.toFixed(3));
console.log('LP tiers:', JSON.stringify(o.waterfall.tierTotals.lp, (k, v) => (typeof v === 'number' ? Math.round(v) : v)));
console.log('GP tiers:', JSON.stringify(o.waterfall.tierTotals.gp, (k, v) => (typeof v === 'number' ? Math.round(v) : v)));
