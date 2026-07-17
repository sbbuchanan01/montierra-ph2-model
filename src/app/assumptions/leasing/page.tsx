'use client';

import { Card, Field, NumberInput, PctInput } from '@/components/ui';
import { useModel, useModelStore } from '@/store/useModelStore';
import { fmtDate } from '@/lib/format';
import {
  ResponsiveContainer, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

export default function LeasingPage() {
  const a = useModelStore((s) => s.assumptions);
  const update = useModelStore((s) => s.update);
  const m = useModel();

  const ramp = m.monthly
    .filter((r) => r.month >= a.schedule.leaseUpStartMonth - 2 && r.month <= m.leaseUpEndMonth + 10)
    .map((r) => ({ month: r.month, occupancy: Math.round(r.occupancy * 1000) / 10, units: r.leasedUnits }));

  const L = a.leasing;
  const O = a.otherIncome;
  const P = a.parking;

  const setL = (patch: Partial<typeof L>) => update((d) => ({ ...d, leasing: { ...d.leasing, ...patch } }));
  const setO = (patch: Partial<typeof O>) => update((d) => ({ ...d, otherIncome: { ...d.otherIncome, ...patch } }));
  const setP = (patch: Partial<typeof P>) => update((d) => ({ ...d, parking: { ...d.parking, ...patch } }));
  const setSchedule = (patch: Partial<typeof a.schedule>) =>
    update((d) => ({ ...d, schedule: { ...d.schedule, ...patch } }));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Lease-Up Pace" subtitle={`Stabilizes month ${m.leaseUpEndMonth} (${fmtDate(m.stabilizationDate)})`}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Lease-up start month">
              <NumberInput value={a.schedule.leaseUpStartMonth} onChange={(v) => setSchedule({ leaseUpStartMonth: Math.max(1, Math.round(v)) })} min={1} />
            </Field>
            <Field label="Leases signed at CO">
              <NumberInput value={L.leasesSignedAtCO} onChange={(v) => setL({ leasesSignedAtCO: v })} min={0} />
            </Field>
            <Field label="Monthly absorption (leases/mo)">
              <NumberInput value={L.monthlyAbsorption} onChange={(v) => setL({ monthlyAbsorption: v })} min={0} />
            </Field>
            <Field label="Stabilization occupancy">
              <PctInput value={L.stabilizationOccupancy} onChange={(v) => setL({ stabilizationOccupancy: v })} />
            </Field>
            <Field label="Lease-up concessions (weeks free)">
              <NumberInput value={L.leaseUpConcessionWeeks} onChange={(v) => setL({ leaseUpConcessionWeeks: v })} min={0} step={0.5} />
            </Field>
            <Field label="Expense growth % (construction/lease-up)">
              <PctInput value={L.expenseGrowthPct} onChange={(v) => setL({ expenseGrowthPct: v })} />
            </Field>
          </div>
          <div className="mt-4 h-56">
            <ResponsiveContainer>
              <ComposedChart data={ramp} margin={{ left: 0, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(v) => `M${v}`} />
                <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} width={40} />
                <Tooltip formatter={(v, name) => (name === 'occupancy' ? `${v}%` : v)} labelFormatter={(l) => `Month ${l}`} />
                <Area type="stepAfter" dataKey="occupancy" stroke="#0f2a43" fill="#c9dbea" name="occupancy" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Stabilized Haircuts">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stabilized concessions">
              <PctInput value={L.stabilizedConcessionsPct} onChange={(v) => setL({ stabilizedConcessionsPct: v })} />
            </Field>
            <Field label="Loss to lease">
              <PctInput value={L.lossToLeasePct} onChange={(v) => setL({ lossToLeasePct: v })} />
            </Field>
            <Field label="Admin units">
              <PctInput value={L.adminUnitsPct} onChange={(v) => setL({ adminUnitsPct: v })} />
            </Field>
            <Field label="Stabilized vacancy">
              <PctInput value={L.stabilizedVacancyPct} onChange={(v) => setL({ stabilizedVacancyPct: v })} />
            </Field>
            <Field label="Collection loss">
              <PctInput value={L.collectionLossPct} onChange={(v) => setL({ collectionLossPct: v })} step={0.01} />
            </Field>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Other Income Assumptions">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Field label="RUBS recovery (% of utilities)">
              <PctInput value={O.rubsPctOfUtilities} onChange={(v) => setO({ rubsPctOfUtilities: v })} />
            </Field>
            <Field label="Admin fee ($/new lease)">
              <NumberInput value={O.adminFeePerLease} onChange={(v) => setO({ adminFeePerLease: v })} />
            </Field>
            <Field label="Pet fee ($/new lease)">
              <NumberInput value={O.petFeePerLease} onChange={(v) => setO({ petFeePerLease: v })} />
            </Field>
            <Field label="Pet rent ($/mo)">
              <NumberInput value={O.petRentPerMonth} onChange={(v) => setO({ petRentPerMonth: v })} />
            </Field>
            <Field label="Bulk WiFi ($/unit/mo)">
              <NumberInput value={O.bulkWifiPerUnitMonth} onChange={(v) => setO({ bulkWifiPerUnitMonth: v })} />
            </Field>
            <Field label="Trash ($/unit/mo)">
              <NumberInput value={O.trashPerUnitMonth} onChange={(v) => setO({ trashPerUnitMonth: v })} />
            </Field>
            <Field label="Pest ($/unit/mo)">
              <NumberInput value={O.pestPerUnitMonth} onChange={(v) => setO({ pestPerUnitMonth: v })} />
            </Field>
            <Field label="Pet renters %">
              <PctInput value={O.petRenterPct} onChange={(v) => setO({ petRenterPct: v })} />
            </Field>
            <Field label="Turnover %">
              <PctInput value={O.turnoverPct} onChange={(v) => setO({ turnoverPct: v })} />
            </Field>
            <Field label="Income growth %/yr">
              <PctInput value={O.incomeGrowthPct} onChange={(v) => setO({ incomeGrowthPct: v })} />
            </Field>
          </div>
        </Card>

        <Card title="Parking">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total spaces">
              <NumberInput value={P.totalSpaces} onChange={(v) => setP({ totalSpaces: v })} min={0} />
            </Field>
            <Field label="Guest / ADA spaces">
              <NumberInput value={P.guestAdaSpaces} onChange={(v) => setP({ guestAdaSpaces: v })} min={0} />
            </Field>
            <Field label="% of spaces rented">
              <PctInput value={P.pctOfSpacesRented} onChange={(v) => setP({ pctOfSpacesRented: v })} />
            </Field>
            <Field label="Rate ($/space/mo)">
              <NumberInput value={P.ratePerSpaceMonth} onChange={(v) => setP({ ratePerSpaceMonth: v })} min={0} />
            </Field>
          </div>
        </Card>
      </div>

      <Card title="Operating Expenses ($/unit/year)">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {(
            [
              ['payroll', 'Payroll'],
              ['marketing', 'Marketing'],
              ['leasingCommissions', 'Leasing Commissions'],
              ['repairsMaintenance', 'Repairs & Maint. (× occ)'],
              ['turnover', 'Turnover (× occ)'],
              ['contractServices', 'Contract Services'],
              ['utilities', 'Utilities (× occ)'],
              ['generalAdmin', 'General / Admin'],
              ['insurance', 'Insurance'],
              ['capitalReserves', 'Capital Reserves'],
            ] as [keyof typeof a.opex, string][]
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <NumberInput
                value={a.opex[key] as number}
                onChange={(v) => update((d) => ({ ...d, opex: { ...d.opex, [key]: v } }))}
                min={0}
              />
            </Field>
          ))}
          <Field label="Mgmt fee (% of income)">
            <PctInput value={a.opex.mgmtFeePct} onChange={(v) => update((d) => ({ ...d, opex: { ...d.opex, mgmtFeePct: v } }))} />
          </Field>
          <Field label="Mgmt fee floor ($/mo)">
            <NumberInput value={a.opex.mgmtFeeFloorPerMonth} onChange={(v) => update((d) => ({ ...d, opex: { ...d.opex, mgmtFeeFloorPerMonth: v } }))} min={0} />
          </Field>
        </div>
      </Card>
    </div>
  );
}
