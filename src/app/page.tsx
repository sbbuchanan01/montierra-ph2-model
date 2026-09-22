'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Note, StatCard } from '@/components/ui';
import { Kpi, Pill, btn, fmtShort, fmtUpdated, inputCls, useGuardDirty } from '@/components/deals';
import { tryRunModel, useModelStore, type ProjectMeta } from '@/store/useModelStore';
import { fmtMoney, fmtNum, fmtPct, fmtX } from '@/lib/format';

const emptyMeta: ProjectMeta = { name: '', city: '', state: '', constructionType: '' };

export default function DealsPage() {
  const projects = useModelStore((s) => s.projects);
  const activeProjectId = useModelStore((s) => s.activeProjectId);
  const dirty = useModelStore((s) => s.dirty);
  const router = useRouter();
  const guardDirty = useGuardDirty();

  const [showCreate, setShowCreate] = useState(false);
  const [meta, setMeta] = useState<ProjectMeta>(emptyMeta);
  const [template, setTemplate] = useState<string>('blank');
  const [busy, setBusy] = useState(false);

  const rows = useMemo(
    () =>
      projects
        .map((p) => ({ project: p, m: tryRunModel(p.baseCase) }))
        .sort((a, b) => (b.project.updatedAt || '').localeCompare(a.project.updatedAt || '')),
    [projects],
  );

  const totals = rows.reduce(
    (t, { m }) =>
      m
        ? {
            units: t.units + m.totalUnits,
            cost: t.cost + m.budget.totalGross,
            equity: t.equity + m.financing.equityCommitment,
            profit: t.profit + (m.returns.totalDistributions - m.returns.totalEquityInvested),
          }
        : t,
    { units: 0, cost: 0, equity: 0, profit: 0 },
  );
  const scenarioCount = projects.reduce((n, p) => n + p.scenarios.length, 0);

  const create = async () => {
    if (!meta.name.trim() || !guardDirty()) return;
    setBusy(true);
    const id = await useModelStore
      .getState()
      .createProject({ ...meta, name: meta.name.trim() }, template === 'blank' ? 'blank' : { copyFrom: template });
    setBusy(false);
    if (!id) return;
    setMeta(emptyMeta);
    setShowCreate(false);
    router.push(`/deals/${id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Deals</h1>
          <p className="text-sm text-slate-500">Multifamily development models — each deal holds a base case and any number of scenarios</p>
        </div>
        <button className={btn.primary} onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? 'Cancel' : '＋ New deal'}
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">New deal</h3>
          <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-6">
            <div className="col-span-2 md:col-span-1">
              <Field label="Deal name">
                <input
                  className={inputCls}
                  autoFocus
                  value={meta.name}
                  placeholder="e.g. Montierra Ph. III"
                  onChange={(e) => setMeta({ ...meta, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && void create()}
                />
              </Field>
            </div>
            <Field label="City">
              <input className={inputCls} value={meta.city} onChange={(e) => setMeta({ ...meta, city: e.target.value })} />
            </Field>
            <Field label="State">
              <input className={inputCls} value={meta.state} onChange={(e) => setMeta({ ...meta, state: e.target.value })} />
            </Field>
            <Field label="Construction type">
              <input
                className={inputCls}
                value={meta.constructionType}
                placeholder="e.g. Surface MF"
                onChange={(e) => setMeta({ ...meta, constructionType: e.target.value })}
              />
            </Field>
            <Field label="Start from">
              <select className={inputCls} value={template} onChange={(e) => setTemplate(e.target.value)}>
                <option value="blank">Blank assumptions</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    Copy of {p.name} (base case)
                  </option>
                ))}
              </select>
            </Field>
            <button className={btn.primary} disabled={!meta.name.trim() || busy} onClick={() => void create()}>
              {busy ? 'Creating…' : 'Create deal'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            &ldquo;Blank assumptions&rdquo; keeps the full model structure (cost line items, rate conventions, schedule
            mechanics) but zeroes unit counts, rents and every cost dollar. Copying a deal duplicates its saved base
            case only — add scenarios on the new deal&rsquo;s dashboard.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Deals" value={fmtNum(projects.length)} sub={`${scenarioCount} saved scenario${scenarioCount === 1 ? '' : 's'}`} />
        <StatCard label="Units" value={fmtNum(totals.units)} sub="Base cases, all deals" />
        <StatCard label="Total Project Cost" value={fmtShort(totals.cost)} sub={`Equity ${fmtShort(totals.equity)}`} />
        <StatCard label="Projected Profit" value={fmtShort(totals.profit)} sub={totals.equity > 0 ? `${fmtX(1 + totals.profit / totals.equity)} on equity` : undefined} accent />
      </div>

      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Pipeline</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ project: p, m }) => {
            const location = [p.city, p.state].filter(Boolean).join(', ');
            const isActive = p.id === activeProjectId;
            return (
              <Link
                key={p.id}
                href={`/deals/${p.id}`}
                className="group block rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-slate-900 group-hover:underline">{p.name}</h3>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {[location, p.constructionType].filter(Boolean).join(' · ') || 'No location set'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {isActive && dirty && <Pill tone="amber">Unsaved</Pill>}
                    {isActive && <Pill tone="green">Open</Pill>}
                    <Pill tone="navy">
                      {p.scenarios.length + 1} case{p.scenarios.length === 0 ? '' : 's'}
                    </Pill>
                  </div>
                </div>
                {m ? (
                  m.totalUnits > 0 ? (
                    <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
                      <Kpi label="Total cost" value={fmtShort(m.budget.totalGross)} sub={`${fmtShort(m.budget.totalGross / m.totalUnits)}/unit`} />
                      <Kpi label="Units" value={fmtNum(m.totalUnits)} sub={`${fmtNum(m.totalNrsf)} NRSF`} />
                      <Kpi label="Project XIRR" value={fmtPct(m.returns.projectXirr, 1)} sub={`${fmtX(m.returns.projectMoic)} MOIC`} />
                      <Kpi label="Equity" value={fmtShort(m.financing.equityCommitment)} sub={`Loan ${fmtShort(m.financing.loanAmount)}`} />
                      <Kpi label="Untrended ROC" value={fmtPct(m.operatingYield.untrended.returnOnCostGross)} sub={`DY ${fmtPct(m.operatingYield.untrended.debtYield, 1)}`} />
                      <Kpi label="LP IRR" value={fmtPct(m.waterfall.lpIrr, 1)} sub={`Profit ${fmtShort(m.returns.totalDistributions - m.returns.totalEquityInvested)}`} />
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">No units yet — open the deal and fill in the unit mix and budget.</p>
                  )
                ) : (
                  <p className="mt-4 text-sm text-red-600">Model error — open the deal to fix inputs.</p>
                )}
                <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Base case · updated {fmtUpdated(p.updatedAt)}</span>
                  {m && m.totalUnits > 0 && <span>Cost {fmtMoney(m.budget.totalGross)}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <Note>
        Deals and scenarios are stored in Supabase and shared by all partner accounts. Card figures are each deal&rsquo;s
        saved base case; open a deal to see and compare its scenarios.
      </Note>
    </div>
  );
}
