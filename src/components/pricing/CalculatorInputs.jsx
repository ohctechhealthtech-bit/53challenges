import React from 'react';
import { PROGRAM_SCOPES, WINNER_MODES, ADDONS } from '@/lib/pricingEngine';

export default function CalculatorInputs({ tiers, bands, categories, inputs, onChange }) {
  const set = (key, val) => onChange({ ...inputs, [key]: val });

  return (
    <div className="space-y-5">
      <Field label="Service tier" hint="How much of the work our team does for you — from you running it yourself to us managing the whole thing.">
        <select className="c53-input" value={inputs.service_tier_id} onChange={(e) => set('service_tier_id', e.target.value)}>
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </Field>

      <Field label="Program scope" hint="Whether you're running one challenge or a set of them over time. More challenges cost more, but each one costs less.">
        <div className="grid grid-cols-3 gap-2">
          {PROGRAM_SCOPES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => set('program_scope', s.key)}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                inputs.program_scope === s.key ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Campaign scale" hint="The size of your audience and reach — local, state-wide or national. This sets the base price band.">
        <select className="c53-input" value={inputs.scale_band_id} onChange={(e) => set('scale_band_id', e.target.value)}>
          {bands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
              {b.pricing_mode === 'by_proposal' ? ' (by proposal)' : ''}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Activity category (for context only — no price effect)" hint="The kind of creative work people will submit. Used to shape the plan, not the price.">
        <select className="c53-input" value={inputs.category_id} onChange={(e) => set('category_id', e.target.value)}>
          <option value="">— select category —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>

      <Field label={`Participants: ${inputs.participants.toLocaleString('en-AU')}`} hint="Roughly how many people you expect to enter. More entries means more moderation and support.">
        <input
          type="range"
          min={0}
          max={5000}
          step={50}
          value={inputs.participants}
          onChange={(e) => set('participants', Number(e.target.value))}
          className="w-full accent-[hsl(var(--primary))]"
        />
      </Field>

      <Field label={`Duration: ${inputs.duration_weeks} weeks`} hint="How long the challenge runs, from opening for entries to announcing the winner.">
        <input
          type="range"
          min={1}
          max={12}
          step={1}
          value={inputs.duration_weeks}
          onChange={(e) => set('duration_weeks', Number(e.target.value))}
          className="w-full accent-[hsl(var(--primary))]"
        />
      </Field>

      <Field label="Winner-decision mode" hint="How the winner is chosen — public votes, a judging panel, or a mix of both. Judging adds cost.">
        <select className="c53-input" value={inputs.winner_mode} onChange={(e) => set('winner_mode', e.target.value)}>
          {WINNER_MODES.map((w) => (
            <option key={w.key} value={w.key}>{w.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Prize pool ($)" hint="Total cash or value you're offering to winners. This is your money to the winners, separate from our fees.">
        <input
          type="number"
          min={0}
          step={100}
          className="c53-input"
          value={inputs.prize_pool}
          onChange={(e) => set('prize_pool', Number(e.target.value))}
        />
      </Field>

      <Field label="Add-ons" hint="Optional extras we can take care of, such as promotion or reporting. Each one adds to the quote.">
        <div className="space-y-2">
          {ADDONS.map((a) => (
            <label key={a.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={inputs.addons.includes(a.key)}
                onChange={(e) =>
                  set('addons', e.target.checked ? [...inputs.addons, a.key] : inputs.addons.filter((x) => x !== a.key))
                }
                className="accent-[hsl(var(--primary))]"
              />
              {a.label}
            </label>
          ))}
        </div>
      </Field>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}