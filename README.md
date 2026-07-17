# Montierra Ph. II — Development Model

Interactive web version of the 19-tab Excel development pro forma for **Montierra Ph. II**
(20-unit surface multifamily, Leander TX). Every assumption is a live input; changing any of
them re-runs the full calculation chain — development budget → construction phasing →
iterative financing solve → lease-up/income → property taxes → sale/exit → XIRR/MOIC →
JV waterfall — exactly the way the source workbook does.

**Live site:** https://montierra-ph2-model.vercel.app (password-gated)

## Structure

- `src/lib/model/` — the calculation engine, a framework-agnostic TypeScript module:
  - `engine.ts` — the 8-stage pipeline with the fixed-point loop that replicates Excel's
    iterative-calculation circularity (capitalized interest / origination fee / project
    contingency are both costs and functions of total cost)
  - `waterfall.ts` — month-by-month tiered promote waterfall (NPV underwater / catch-up tests)
  - `defaults.ts`, `costData.ts`, `curves.ts` — base-case inputs verbatim from the workbook
  - `__tests__/validation.test.ts` — validation against the reviewed workbook
- `src/app/` — Next.js App Router pages (deal summary, assumption pages, cash flow, returns,
  taxes, comps, lender/JV export one-pagers)
- `src/proxy.ts` — site-wide password gate (HMAC-signed cookie, `SITE_PASSWORD` env var)

## Validation (base case vs. the reviewed workbook)

| Metric | Workbook | This engine |
|---|---|---|
| Total Development Cost (Gross) | $4,686,240.67 | $4,686,240.67 |
| Construction Loan | $2,928,900.42 | $2,928,900.42 |
| Total Equity | $1,757,340.25 | $1,757,340.25 |
| MF Sale Price | ≈ $6,641,826 | $6,641,826 |
| Project XIRR | ≈ 19.53% | 19.53% |
| Project MOIC | ≈ 2.26x | 2.26x |
| Untrended ROC / Debt Yield / DSCR | 6.58% / 10.53% / 1.50x | 6.58% / 10.53% / 1.50x |

Run `npx vitest run` for the full checkpoint suite.

## Known deliberate deviations from the source workbook

- **Hurdle 2 is independently editable** (the workbook hard-links it to Hurdle 1). Defaults
  are kept equal so results match.
- **The "Refinance Timing" dropdown is dropped** in favor of a direct refinance-month input
  (in the workbook the dropdown was decorative and did nothing).
- **Gain on sale is a $0 stub** — the workbook formula references a deleted cell and its
  surviving logic is wrong; Texas has no state income tax so the impact is zero. See the
  note on the Taxes page.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npx vitest run     # validation tests
```

Set `SITE_PASSWORD` in `.env.local` to enable the password gate locally (without it the
gate is open).
