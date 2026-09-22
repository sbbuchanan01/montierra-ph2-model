<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Montierra Ph. II Development Model

Web app version of the Montierra Phase II multifamily development model (built 2026-07-17
from `2026.7.6 Montierra Ph II MF Dev Model 16 mo - REVIEWED.xlsx`). Owner: Stephen Buchanan.

## Where it lives
- Repo: this folder (`C:\Users\sbbuc\montierra-ph2-model`) → **github.com/sbbuchanan01/montierra-ph2-model (public)**
- Live: **https://montierra-ph2-model.vercel.app** (Vercel project `montierra-ph2-model`, team buchanananalysis)
- **Pushes to `main` auto-deploy to production.** No manual deploy step.

## Stack & auth
- Next.js 16 (App Router, TypeScript, Tailwind). Note the Next.js warning above — read the
  bundled docs in `node_modules/next/dist/docs/` before writing framework code.
- Auth: **Supabase email/password**, same partner accounts as the real-estate-portal, gated by
  `allowed_emails` / `is_allowed()`. The old shared site password is retired.
- Route gate lives in `src/proxy.ts` (Next 16 renamed middleware → proxy; it **must** sit in `src/`).
  A stale `.next` cache can 500 after moving it — delete `.next` if that happens.
- Self-serve reset: "Forgot password?" on `/login` → recovery email → `/reset-password` (gate-exempt).
  Requires `https://montierra-ph2-model.vercel.app/reset-password` in Supabase Auth → URL
  Configuration → Redirect Urls. Resetting also changes the portal password (shared accounts).

## Data
- Supabase tables `montierra_projects` / `montierra_scenarios` (jsonb, RLS = `is_allowed()`), in the
  **shared** portal Supabase project `jxbuqodvnpxknyxcewdr`.
- Saves sync across devices; working drafts stay per-device (localStorage v3, partialized).
  First login seeds/migrates any local projects.
- Structure: **Deals (DB: projects) → base case + named Scenarios → working draft**
  (`src/store/useModelStore.ts`). The UI says "deal"; tables/types still say "project".
- Routes: `/` = **Deals dashboard** (card per deal, base-case KPIs, "+ New deal" blank or copy of a
  deal). `/deals/[id]` = **deal dashboard** (base-case KPIs, a card per scenario with deltas vs. base,
  new/duplicate/rename/delete scenario, comparison table + IRR chart). `/summary` and the other tabs
  are the model for the open deal+scenario (`openScenario()`). `/compare` redirects to the open
  deal's dashboard; `/projects` redirects to `/` (next.config). Deal metadata
  (name/city/state/construction_type) are DB columns.
- Light theme only: `globals.css` has no dark-mode override (it used to turn body text near-white
  on the white cards under OS dark mode).

## Engine
- `src/lib/model/engine.ts` validates against the workbook **to the penny**:
  cost $4,686,240.67 · loan $2,928,900.42 · XIRR 19.53% · MOIC 2.26x.
- Budget is per-line-item: each `CostLineItem` has a basis (`fixed | perUnit | perRsf |
  hardCostContingencyPct`) plus optional `startMonth`/`endMonth` overrides. Engine emits one
  BudgetRow per item keyed by **item id, not code** (multiple rows may share a code). GC (200202)
  stays curve-phased; user-added items get pseudo-codes like `200299` (the prefix drives category
  and contingency-base rules).
- The REVIEWED xlsx has no cached formula values, so `Waterfall!D24:F25` LP/GP targets were never
  readable — the waterfall is verified by conservation + brief checkpoints only.

## Workflow
1. Edit assumptions in `src/lib/model/defaults.ts` or logic in `src/lib/model/engine.ts`.
2. `npx vitest run` — 20 tests, validation is exact. Keep it that way.
3. `git push` → auto-deploys.

Dev preview from a portal session: launch config `montierra-dev` (port 3421) in
`real-estate-portal/.claude/launch.json`.

## Related projects
See `~/.claude/CLAUDE.md` for the index of Stephen's other apps that share this Supabase project.
