'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Field, Note, StatCard, Th, Td } from '@/components/ui';
import {
  Delta, Kpi, METRICS, Pill, btn, fmtShort, fmtUpdated, inputCls, metric, useGuardDirty, useOpenScenario,
} from '@/components/deals';
import { tryRunModel, useModelStore, type Project, type ProjectMeta, type ScenarioSource } from '@/store/useModelStore';
import { fmtDate, fmtMoney, fmtNum, fmtPct, fmtX } from '@/lib/format';
import { headline, isForSaleOutput, kindOf, type AnyOutput, type ModelKind } from '@/lib/any';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

interface Column {
  id: string | null;
  name: string;
  savedAt: string;
  kind: ModelKind;
  model: AnyOutput | null;
}

/** The six headline figures on every scenario card, each with its delta vs. the base case. */
const CARD_KPIS: { label: string | ((kind: ModelKind) => string); short?: boolean; sub?: (m: AnyOutput) => string }[] = [
  { label: 'Total Project Cost', short: true, sub: (m) => { const h = headline(m); return h.units > 0 ? `${fmtShort(h.totalCost / h.units)}/unit` : ''; } },
  { label: 'Total Equity', short: true, sub: (m) => `Loan ${fmtShort(headline(m).loan)}` },
  { label: 'Total Profit', short: true, sub: (m) => { const h = headline(m); return `${h.exitLabel} ${fmtShort(h.grossExit)}`; } },
  { label: 'Project XIRR', sub: (m) => `${fmtX(headline(m).projectMoic)} MOIC` },
  { label: 'LP IRR', sub: (m) => `GP ${fmtPct(headline(m).gpIrr, 1)}` },
  { label: (kind) => (kind === 'forSale' ? 'Margin on Gross Sales' : 'Untrended ROC'), sub: (m) => headline(m).yieldSub },
];

const SHORT_LABEL: Record<string, string> = {
  'Total Project Cost': 'Total cost',
  'Total Equity': 'Equity',
  'Total Profit': 'Profit',
  'Margin on Gross Sales': 'Margin',
};

const KIND_LABEL: Record<ModelKind, string> = { rental: 'For rent', forSale: 'For sale' };

function DetailsEditor({ project, onDone }: { project: Project; onDone: () => void }) {
  const [meta, setMeta] = useState<ProjectMeta>({
    name: project.name,
    city: project.city,
    state: project.state,
    constructionType: project.constructionType,
  });
  return (
    <div className="grid grid-cols-2 items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6">
      <div className="col-span-2">
        <Field label="Deal name">
          <input className={inputCls} value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
        </Field>
      </div>
      <Field label="City">
        <input className={inputCls} value={meta.city} onChange={(e) => setMeta({ ...meta, city: e.target.value })} />
      </Field>
      <Field label="State">
        <input className={inputCls} value={meta.state} onChange={(e) => setMeta({ ...meta, state: e.target.value })} />
      </Field>
      <Field label="Construction type">
        <input className={inputCls} value={meta.constructionType} onChange={(e) => setMeta({ ...meta, constructionType: e.target.value })} />
      </Field>
      <div className="flex gap-1.5">
        <button
          className={btn.primary}
          disabled={!meta.name.trim()}
          onClick={() => void useModelStore.getState().updateProjectMeta(project.id, { ...meta, name: meta.name.trim() }).then(onDone)}
        >
          Save
        </button>
        <button className={btn.secondary} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function DealDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const project = useModelStore((s) => s.projects.find((p) => p.id === id));
  const projectCount = useModelStore((s) => s.projects.length);
  const activeProjectId = useModelStore((s) => s.activeProjectId);
  const activeScenarioId = useModelStore((s) => s.activeScenarioId);
  const dirty = useModelStore((s) => s.dirty);
  const open = useOpenScenario();
  const guardDirty = useGuardDirty();

  const [editing, setEditing] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFrom, setNewFrom] = useState<string>('__base__');
  const newSource = (): ScenarioSource => (newFrom === '__base__' ? null : newFrom === '__forsale__' ? { template: 'forSale' } : newFrom);
  const [busy, setBusy] = useState(false);
  // Case shown in the headline KPI row. undefined = follow the case open in the model.
  const [pickedId, setPickedId] = useState<string | null | undefined>(undefined);

  const columns: Column[] = useMemo(
    () =>
      project
        ? [
            { id: null, name: 'Base case', savedAt: project.updatedAt, kind: kindOf(project.baseCase), model: tryRunModel(project.baseCase) },
            ...project.scenarios.map((sc) => ({ id: sc.id, name: sc.name, savedAt: sc.savedAt, kind: kindOf(sc.assumptions), model: tryRunModel(sc.assumptions) })),
          ]
        : [],
    [project],
  );

  if (!project) {
    return (
      <Card title="Deal not found">
        <p className="text-sm text-slate-600">
          This deal no longer exists or you don&rsquo;t have access to it.{' '}
          <Link href="/" className="font-medium text-slate-900 underline">Back to all deals</Link>
        </p>
      </Card>
    );
  }

  const isActiveDeal = project.id === activeProjectId;
  const base = columns[0].model;
  const wantedId = pickedId !== undefined ? pickedId : isActiveDeal ? activeScenarioId : null;
  const focused = columns.find((c) => c.id === wantedId) ?? columns[0];
  const fm = focused.model;
  const fh = fm ? headline(fm) : null;
  const location = [project.city, project.state].filter(Boolean).join(', ');

  const createScenario = async (thenOpen: boolean) => {
    const name = newName.trim();
    if (!name) return;
    if (thenOpen && !guardDirty()) return;
    setBusy(true);
    const scId = await useModelStore.getState().createScenario(project.id, name, newSource());
    setBusy(false);
    if (!scId) return;
    setNewName('');
    setShowNew(false);
    if (thenOpen) {
      useModelStore.getState().openScenario(project.id, scId);
      router.push('/summary');
    }
  };

  const duplicate = async (c: Column) => {
    const name = prompt('Name for the copy:', `${c.name} (copy)`);
    if (name?.trim()) await useModelStore.getState().createScenario(project.id, name.trim(), c.id);
  };

  const chartData = columns
    .filter((c) => c.model)
    .map((c) => {
      const h = headline(c.model!);
      return {
        name: c.name,
        xirr: Math.round((h.projectIrr ?? 0) * 10000) / 100,
        lpIrr: Math.round((h.lpIrr ?? 0) * 10000) / 100,
        gpIrr: Math.round((h.gpIrr ?? 0) * 10000) / 100,
      };
    });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-xs font-medium text-slate-500 hover:text-slate-900">
          ← All deals
        </Link>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <p className="text-sm text-slate-500">
              {[location, project.constructionType].filter(Boolean).join(' · ') || 'No location set'} · base case +{' '}
              {project.scenarios.length} scenario{project.scenarios.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btn.secondary} onClick={() => setEditing((v) => !v)}>
              Edit details
            </button>
            {projectCount > 1 && (
              <button
                className={`${btn.secondary} !border-red-200 !text-red-600 hover:!bg-red-50`}
                onClick={() => {
                  if (confirm(`Delete deal "${project.name}" and its ${project.scenarios.length} scenario(s)? This cannot be undone.`)) {
                    void useModelStore.getState().deleteProject(project.id).then(() => router.push('/'));
                  }
                }}
              >
                Delete deal
              </button>
            )}
            <button className={btn.secondary} onClick={() => setShowNew((v) => !v)}>
              {showNew ? 'Cancel' : '＋ New scenario'}
            </button>
            <button className={btn.primary} onClick={() => open(project.id, null)}>
              Open base case →
            </button>
          </div>
        </div>
      </div>

      {editing && <DetailsEditor project={project} onDone={() => setEditing(false)} />}

      {showNew && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">New scenario</h3>
          <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-5">
            <div className="col-span-2">
              <Field label="Scenario name">
                <input
                  className={inputCls}
                  autoFocus
                  value={newName}
                  placeholder="e.g. 6.0% exit cap, +10% hard costs"
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void createScenario(true)}
                />
              </Field>
            </div>
            <Field label="Start from">
              <select className={inputCls} value={newFrom} onChange={(e) => setNewFrom(e.target.value)}>
                <option value="__base__">Base case</option>
                {project.scenarios.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
                <option value="__forsale__">For-sale townhome template (10 homes)</option>
              </select>
            </Field>
            <div className="col-span-2 flex gap-1.5">
              <button className={btn.primary} disabled={!newName.trim() || busy} onClick={() => void createScenario(true)}>
                Create &amp; open
              </button>
              <button className={btn.secondary} disabled={!newName.trim() || busy} onClick={() => void createScenario(false)}>
                Create
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            A scenario starts as an exact copy of the case you pick. Open it, change assumptions on any tab, then Save
            scenario in the bar at the top. The for-sale template is the Townhome For-Sale Development Model
            (homes sold at closing, carry on unsold inventory, loan swept from closings) rather than a rental case.
          </p>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Showing</span>
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            {columns.map((c) => {
              const on = c.id === focused.id;
              return (
                <button
                  key={c.id ?? '__base__'}
                  onClick={() => setPickedId(c.id)}
                  className={`rounded-md px-3 py-1 text-sm font-medium ${on ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {c.name}
                  {isActiveDeal && c.id === activeScenarioId && <span className={`ml-1.5 ${on ? 'text-emerald-300' : 'text-emerald-600'}`}>●</span>}
                </button>
              );
            })}
          </div>
          {isActiveDeal && focused.id === activeScenarioId && dirty && (
            <span className="text-xs text-amber-700">Saved figures — your unsaved edits are not reflected</span>
          )}
        </div>
        {fm && fh ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Total Project Cost" value={fmtMoney(fh.totalCost)} sub={fh.units > 0 ? `${fmtMoney(fh.totalCost / fh.units)} / unit` : undefined} />
            <StatCard label={fh.kind === 'forSale' ? 'Homes / Saleable SF' : 'Units / NRSF'} value={fmtNum(fh.units)} sub={fh.kind === 'forSale' ? `${fmtNum(fh.nsf)} SF · for sale` : `${fmtNum(fh.nsf)} SF · ${fmtMoney(isForSaleOutput(fm) ? 0 : fm.avgRent)}/mo avg`} />
            <StatCard label="Total Equity" value={fmtMoney(fh.equity)} sub={`Loan ${fmtMoney(fh.loan)}`} />
            <StatCard label={fh.kind === 'forSale' ? 'Net Sales Proceeds' : 'Net Sale Proceeds'} value={fmtMoney(fh.netExit)} sub={fh.exitDate ? `${fh.exitLabel} ${fmtDate(fh.exitDate)}` : undefined} />
            <StatCard label={fh.kind === 'forSale' ? 'Levered IRR' : 'Project XIRR'} value={fmtPct(fh.projectIrr)} sub={`MOIC ${fmtX(fh.projectMoic)}`} accent />
            <StatCard label="LP / GP IRR" value={fmtPct(fh.lpIrr)} sub={`GP ${fmtPct(fh.gpIrr)}`} />
          </div>
        ) : (
          <p className="text-sm text-red-600">Model error in {focused.name} — open it to fix inputs.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Scenarios</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {columns.map((c) => {
            const isOpen = isActiveDeal && c.id === activeScenarioId;
            const isShown = c.id === focused.id;
            const m = c.model;
            return (
              <div
                key={c.id ?? '__base__'}
                onClick={() => setPickedId(c.id)}
                className={`flex cursor-pointer flex-col rounded-xl border bg-white p-5 shadow-sm ${isShown ? 'border-slate-900 ring-1 ring-slate-900' : isOpen ? 'border-slate-400 ring-1 ring-slate-300' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button className="truncate text-left text-base font-semibold text-slate-900 hover:underline" onClick={() => open(project.id, c.id)}>
                      {c.name}
                    </button>
                    <p className="mt-0.5 text-xs text-slate-500">Saved {fmtUpdated(c.savedAt)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {isOpen && dirty && <Pill tone="amber">Unsaved</Pill>}
                    {isOpen && <Pill tone="green">Open</Pill>}
                    {c.id === null && <Pill tone="navy">Base case</Pill>}
                    {c.kind === 'forSale' && <Pill tone="sky">{KIND_LABEL.forSale}</Pill>}
                  </div>
                </div>
                {m ? (
                  <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
                    {CARD_KPIS.map((k) => {
                      const label = typeof k.label === 'function' ? k.label(c.kind) : k.label;
                      const mt = metric(label);
                      const v = mt.value(m);
                      return (
                        <Kpi
                          key={label}
                          label={SHORT_LABEL[label] ?? label}
                          value={v == null ? '—' : k.short ? fmtShort(v) : mt.fmt(v)}
                          sub={k.sub?.(m)}
                          delta={c.id !== null && base ? <Delta m={mt} v={v} base={mt.value(base)} /> : undefined}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-red-600">Model error — open this case to fix inputs.</p>
                )}
                <div className="grow" />
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                  <button className={btn.small} onClick={() => open(project.id, c.id)}>
                    Open model
                  </button>
                  <button className={btn.small} onClick={() => open(project.id, c.id, '/cash-flow')}>
                    Cash flow
                  </button>
                  <button className={btn.small} onClick={() => void duplicate(c)}>
                    Duplicate
                  </button>
                  {c.id !== null && (
                    <>
                      <button
                        className={btn.small}
                        onClick={() => {
                          const name = prompt('Rename scenario:', c.name);
                          if (name?.trim()) void useModelStore.getState().renameScenario(c.id!, name.trim());
                        }}
                      >
                        Rename
                      </button>
                      <button
                        className={`${btn.danger} ml-auto`}
                        onClick={() => {
                          if (confirm(`Delete scenario "${c.name}"? This cannot be undone.`)) {
                            void useModelStore.getState().deleteScenario(c.id!);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <button
            onClick={() => setShowNew(true)}
            className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/50 p-5 text-sm font-medium text-slate-500 hover:border-slate-400 hover:text-slate-800"
          >
            ＋ New scenario
          </button>
        </div>
      </section>

      {columns.length > 1 && (
        <>
          <Card
            title="Scenario Comparison"
            subtitle={`Saved figures, deltas vs. base case${isActiveDeal && dirty ? ' · your unsaved edits are not reflected here — save first' : ''}`}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    <Th right={false}>Metric</Th>
                    {columns.map((c) => (
                      <Th key={c.id ?? '__base__'} className={isActiveDeal && c.id === activeScenarioId ? 'text-slate-900' : ''}>
                        {c.name}
                        {isActiveDeal && c.id === activeScenarioId && <span className="ml-1 text-emerald-600">●</span>}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map((mt) => (
                    <tr key={mt.label} className="border-t border-slate-100">
                      <Td right={false} className="text-slate-700">{mt.label}</Td>
                      {columns.map((c, ci) => {
                        if (!c.model) return <Td key={c.id ?? '__base__'}>—</Td>;
                        const v = mt.value(c.model);
                        return (
                          <Td key={c.id ?? '__base__'}>
                            {v == null ? <span className="text-slate-300">—</span> : mt.fmt(v)}
                            {ci > 0 && base && <Delta m={mt} v={v} base={mt.value(base)} />}
                          </Td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Returns by Scenario">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ left: 0, right: 10, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" width={44} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="xirr" fill="#0f2a43" name="Project / Levered XIRR" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="lpIrr" fill="#3f6b94" name="LP IRR" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="gpIrr" fill="#9dbcd6" name="GP IRR" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      {columns.length === 1 && (
        <Note>
          No scenarios yet. Use <span className="font-semibold">＋ New scenario</span> to copy the base case, then open it
          and change assumptions — saved scenarios appear here side by side with deltas against the base case.
        </Note>
      )}
    </div>
  );
}
