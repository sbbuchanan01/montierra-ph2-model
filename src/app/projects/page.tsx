'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Field, Select, Th, Td, Note } from '@/components/ui';
import {
  tryRunModel, useModelStore, type Project, type ProjectMeta, type ProjectTemplate,
} from '@/store/useModelStore';
import { fmtMoney, fmtPct, fmtX } from '@/lib/format';
import type { ModelOutput } from '@/lib/model/types';

interface Metric {
  label: string;
  value: (m: ModelOutput) => string;
}

const METRICS: Metric[] = [
  { label: 'Units / NRSF', value: (m) => `${m.totalUnits} / ${m.totalNrsf.toLocaleString()}` },
  { label: 'Total Project Cost', value: (m) => fmtMoney(m.budget.totalGross) },
  { label: 'Cost / Unit', value: (m) => (m.totalUnits > 0 ? fmtMoney(m.budget.totalGross / m.totalUnits) : '—') },
  { label: 'Construction Loan', value: (m) => fmtMoney(m.financing.loanAmount) },
  { label: 'Total Equity', value: (m) => fmtMoney(m.financing.equityCommitment) },
  { label: 'Net Sale Proceeds', value: (m) => fmtMoney(m.sale.netSaleProceeds) },
  { label: 'Total Profit', value: (m) => fmtMoney(m.returns.totalDistributions - m.returns.totalEquityInvested) },
  { label: 'Project XIRR', value: (m) => fmtPct(m.returns.projectXirr) },
  { label: 'Project MOIC', value: (m) => fmtX(m.returns.projectMoic) },
  { label: 'LP IRR / MOIC', value: (m) => `${fmtPct(m.waterfall.lpIrr)} / ${fmtX(m.waterfall.lpMoic)}` },
  { label: 'GP IRR / MOIC', value: (m) => `${fmtPct(m.waterfall.gpIrr)} / ${fmtX(m.waterfall.gpMoic)}` },
  { label: 'Untrended ROC', value: (m) => fmtPct(m.operatingYield.untrended.returnOnCostGross) },
  { label: 'Debt Yield / DSCR', value: (m) => `${fmtPct(m.operatingYield.untrended.debtYield)} / ${fmtX(m.operatingYield.untrended.dscr)}` },
];

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400';

const emptyMeta: ProjectMeta = { name: '', city: '', state: '', constructionType: '' };

/** Inline editor for one project's details, saving to Supabase on demand. */
function ProjectDetailsRow({ project, isActive, canDelete }: { project: Project; isActive: boolean; canDelete: boolean }) {
  const { updateProjectMeta, switchProject, deleteProject } = useModelStore.getState();
  const dirty = useModelStore((s) => s.dirty);
  const router = useRouter();
  const [meta, setMeta] = useState<ProjectMeta>({
    name: project.name,
    city: project.city,
    state: project.state,
    constructionType: project.constructionType,
  });
  const changed =
    meta.name !== project.name ||
    meta.city !== project.city ||
    meta.state !== project.state ||
    meta.constructionType !== project.constructionType;

  const guardDirty = (): boolean =>
    !dirty || confirm('You have unsaved model changes that will be discarded. Continue?');

  return (
    <div className={`rounded-xl border p-4 ${isActive ? 'border-slate-400 bg-slate-50' : 'border-slate-200 bg-white'}`}>
      <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-6">
        <Field label="Project name">
          <input className={inputCls} value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
        </Field>
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
            placeholder="e.g. Surface MF, 4-story wrap"
            onChange={(e) => setMeta({ ...meta, constructionType: e.target.value })}
          />
        </Field>
        <div className="col-span-2 flex flex-wrap items-center gap-1.5">
          {changed ? (
            <>
              <button
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                disabled={!meta.name.trim()}
                onClick={() => void updateProjectMeta(project.id, meta)}
              >
                Save details
              </button>
              <button
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                onClick={() =>
                  setMeta({
                    name: project.name,
                    city: project.city,
                    state: project.state,
                    constructionType: project.constructionType,
                  })
                }
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {isActive ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  Currently open
                </span>
              ) : (
                <button
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  onClick={() => {
                    if (!guardDirty()) return;
                    switchProject(project.id);
                    router.push('/');
                  }}
                >
                  Open
                </button>
              )}
              <span className="text-xs text-slate-400">
                {project.scenarios.length === 0
                  ? 'Base case only'
                  : `Base case + ${project.scenarios.length} scenario${project.scenarios.length === 1 ? '' : 's'}`}
              </span>
              {canDelete && (
                <button
                  className="ml-auto rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                  onClick={() => {
                    if (
                      confirm(
                        `Delete project "${project.name}" and its ${project.scenarios.length} scenario(s)? This cannot be undone.`,
                      )
                    ) {
                      void deleteProject(project.id);
                    }
                  }}
                >
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const projects = useModelStore((s) => s.projects);
  const activeProjectId = useModelStore((s) => s.activeProjectId);
  const dirty = useModelStore((s) => s.dirty);
  const { createProject } = useModelStore.getState();
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [meta, setMeta] = useState<ProjectMeta>(emptyMeta);
  const [template, setTemplate] = useState<string>('Blank assumptions');

  const computed = useMemo(
    () => projects.map((p) => ({ project: p, model: tryRunModel(p.baseCase) })),
    [projects],
  );

  const guardDirty = (): boolean =>
    !dirty || confirm('You have unsaved model changes that will be discarded. Continue?');

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Projects</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Each project holds its own base case and saved scenarios. Details are editable below.
            </p>
          </div>
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? 'Cancel' : '＋ Add new project'}
          </button>
        </div>

        {showCreate && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-6">
              <Field label="Project name">
                <input
                  className={inputCls}
                  autoFocus
                  value={meta.name}
                  placeholder="e.g. Montierra Ph. III"
                  onChange={(e) => setMeta({ ...meta, name: e.target.value })}
                />
              </Field>
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
                <Select
                  value={template}
                  onChange={setTemplate}
                  options={['Blank assumptions', 'Copy of current model']}
                />
              </Field>
              <button
                className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                disabled={!meta.name.trim()}
                onClick={() => {
                  if (!guardDirty()) return;
                  const tpl: ProjectTemplate = template === 'Blank assumptions' ? 'blank' : 'copy';
                  void createProject({ ...meta, name: meta.name.trim() }, tpl).then(() => {
                    setMeta(emptyMeta);
                    setShowCreate(false);
                    router.push('/assumptions/unit-mix');
                  });
                }}
              >
                Create
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              &ldquo;Blank assumptions&rdquo; keeps the full model structure (cost line items, rate
              conventions, schedule mechanics) but zeroes unit counts, rents, and every cost dollar.
              &ldquo;Copy of current model&rdquo; duplicates whatever is open right now.
            </p>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {computed.map(({ project }) => (
            <ProjectDetailsRow
              key={project.id}
              project={project}
              isActive={project.id === activeProjectId}
              canDelete={projects.length > 1}
            />
          ))}
        </div>
      </Card>

      {projects.length > 1 && (
        <Card
          title="Project Comparison"
          subtitle="Each project's saved base case, side by side. For scenario-level comparison within a project, open it and use the Compare tab."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  <Th right={false}>Metric</Th>
                  {computed.map(({ project }) => (
                    <Th key={project.id} className={project.id === activeProjectId ? 'text-slate-900' : ''}>
                      {project.name}
                      {project.id === activeProjectId && <span className="ml-1 text-emerald-600">●</span>}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100 text-xs text-slate-400">
                  <Td right={false}>Location / Type</Td>
                  {computed.map(({ project }) => (
                    <Td key={project.id}>
                      {[[project.city, project.state].filter(Boolean).join(', '), project.constructionType]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </Td>
                  ))}
                </tr>
                {METRICS.map((metric) => (
                  <tr key={metric.label} className="border-t border-slate-100">
                    <Td right={false} className="text-slate-700">{metric.label}</Td>
                    {computed.map(({ project, model }) => (
                      <Td key={project.id}>{model ? metric.value(model) : '—'}</Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Note>
        Projects and scenarios are stored in Supabase and shared by all partner accounts — changes
        sync across devices. Unsaved working-draft edits stay local to your browser until you save.
        Use the ↻ button in the bar above to pull the latest saved state.
      </Note>
    </div>
  );
}
