import { ShieldAlert } from 'lucide-react';
import { COMPLIANCE_REASONS } from '@/lib/judgeScoring';

// Compliance flag control shown beneath the rubric. Raising a flag never
// blocks scoring — it routes the entry to an administrator for review.
export default function ComplianceFlagBox({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className={`rounded-xl border p-4 transition-colors ${value.flagged ? 'border-amber-500/40 bg-amber-500/10' : 'border-border bg-white/5'}`}>
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={value.flagged}
          onChange={(e) => set({ flagged: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-amber-500"
        />
        <span>
          <span className="flex items-center gap-1.5 text-sm font-semibold"><ShieldAlert className="h-4 w-4 text-amber-400" /> Flag this entry for compliance review</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">Use this if the entry may breach the brief, the rules or content standards.</span>
        </span>
      </label>

      {value.flagged && (
        <div className="mt-3 space-y-2">
          <select
            value={value.reason}
            onChange={(e) => set({ reason: e.target.value })}
            className="w-full rounded-lg border border-input bg-white/5 px-3 py-2 text-sm"
          >
            <option value="">Select a reason…</option>
            {COMPLIANCE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <textarea
            rows={2}
            value={value.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="Add any detail the reviewer needs…"
            className="w-full rounded-lg border border-input bg-white/5 px-3 py-2 text-xs"
          />
        </div>
      )}
    </div>
  );
}