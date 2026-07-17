'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Field, Select, Th, Td, Note } from '@/components/ui';
import { tryRunModel, useModelStore, type ProjectTemplate } from '@/store/useModelStore';
import { fmtMoney, fmtPct, fmtX } from '@/lib/format';
import type { ModelOutput } from '@/lib/model/types';

const TEMPLATE_LABELS: Record<string, ProjectTemplate> = {
  'Blank assumptions': 'blank',
  'Copy of current model': 'copy',
  'Montierra workbook base case': 'montierra',
};

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

export default function ProjectsPage() {
  const projects = useModelStore((s) => s.projects);
  const activeProjectId = useModelStore((s) => s.activeProjectId);
  const dirty = useModelStore((s) => s.dirty);
  const { createProject, switchProject, renameProject, deleteProject } = useModelStore.getState();
  const router = useRouter();

  const [name, setName] = useState('');
  const [templateLabel, setTemplateLabel] = useState<string>('Blank assumptions');

  const computed = useMemo(
    () =>
      projects.map((p) => ({
        project: p,
        model: tryRunModel(p.baseCase),
      })),
    [projects],
  );

  const guardDirty = (): boolean =>
    !dirty || confirm('You have unsaved changes that will be discarded. Continue?');

  return (
    <div className="space-y-5">
      <Card
        title="New Project"
        subtitle="Re-use the full model for another deal — blank slate, a copy of the current model, or the Montierra workbook defaults"
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Project name">
            <input
              className="w-64 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Montierra Ph. III"
            />
          </Field>
          <Field label="Start from">
            <div className="w-64">
              <Select
                value={templateLabel}
                onChange={setTemplateLabel}
                options={Object.keys(TEMPLATE_LABELS)}
              />
            </div>
          </Field>
          <button
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
            disabled={!name.trim()}
            onClick={() => {
              if (!guardDirty()) return;
              createProject(name.trim(), TEMPLATE_LABELS[templateLabel]);
              setName('');
              router.push('/assumptions/unit-mix');
            }}
          >
            Create project
          </button>
        </div>
        <div className="mt-3">
          <Note>
            &ldquo;Blank assumptions&rdquo; keeps the full model structure (cost line items, rate
            conventions, schedule mechanics) but zeroes unit counts, rents, and every cost dollar,
            so nothing deal-specific carries over.
          </Note>
        </div>
      </Card>

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
                <Td right={false}>Scenarios saved</Td>
                {computed.map(({ project }) => (
                  <Td key={project.id}>{project.scenarios.length}</Td>
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
              <tr className="border-t border-slate-200">
                <Td right={false} className="text-slate-400">Actions</Td>
                {computed.map(({ project }) => (
                  <Td key={project.id}>
                    <div className="flex justify-end gap-1">
                      <button
                        className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
                        onClick={() => {
                          if (!guardDirty()) return;
                          switchProject(project.id);
                          router.push('/');
                        }}
                      >
                        Open
                      </button>
                      <button
                        className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
                        onClick={() => {
                          const n = prompt('Rename project:', project.name);
                          if (n?.trim()) renameProject(project.id, n.trim());
                        }}
                      >
                        Rename
                      </button>
                      {projects.length > 1 && (
                        <button
                          className="rounded border border-red-200 px-1.5 py-0.5 text-[11px] text-red-600 hover:bg-red-50"
                          onClick={() => {
                            if (
                              confirm(
                                `Delete project "${project.name}" and its ${project.scenarios.length} scenario(s)? This cannot be undone.`,
                              )
                            ) {
                              deleteProject(project.id);
                            }
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </Td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Note>
        Projects and scenarios are saved in this browser (localStorage) — they persist across
        visits on this device but do not sync between devices or users. Syncing would be the
        first thing a (free-tier) Supabase backend adds.
      </Note>
    </div>
  );
}
