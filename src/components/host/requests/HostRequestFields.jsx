/**
 * The full host request in one form — editable, or plain read-only text when
 * the request is locked.
 */
import {
  INDUSTRIES, CHALLENGE_TYPES, GOALS, AUDIENCE_SIZES, SCOPES, TIMINGS, BUDGETS, PRIZES, HOW_HEARD,
} from '@/lib/hostRequestOptions';

export default function HostRequestFields({ form, set, readOnly }) {
  const F = { form, set, readOnly };
  return (
    <div className="space-y-7">
      <Group title="Your organisation">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text {...F} name="company_name" label="Company / organisation name" required />
          <Text {...F} name="company_website" label="Website" />
          <Choice {...F} name="industry" label="Industry / sector" options={INDUSTRIES} />
          <Text {...F} name="abn" label="ABN / business number" />
          <Text {...F} name="contact_name" label="Primary contact name" required />
          <Text {...F} name="contact_email" label="Contact email" type="email" required />
          <Text {...F} name="contact_phone" label="Phone" />
        </div>
      </Group>

      <Group title="The challenge">
        <div className="grid gap-4">
          <Text {...F} name="challenge_title" label="Working title or theme" required />
          <Choice {...F} name="challenge_type" label="Type of challenge" options={CHALLENGE_TYPES} />
          <Choice {...F} name="challenge_goal" label="Main goal" options={GOALS} />
          <Area {...F} name="challenge_description" label="Describe the challenge" required />
        </div>
      </Group>

      <Group title="Who & when">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text {...F} name="audience_description" label="Who should participate?" required />
          <Choice {...F} name="audience_size" label="Expected number of participants" options={AUDIENCE_SIZES} />
          <Choice {...F} name="geographic_scope" label="Geographic scope" options={SCOPES} />
          <Choice {...F} name="launch_timing" label="When do you want to launch?" options={TIMINGS} />
          <Text {...F} name="start_date" label="Challenge start date" type="date" required />
          <Text {...F} name="end_date" label="Challenge end date" type="date" required min={form.start_date} />
          {!readOnly && form.start_date && form.end_date && form.end_date <= form.start_date && (
            <p className="text-sm font-medium text-destructive sm:col-span-2" role="alert">
              The end date must be after the start date.
            </p>
          )}
        </div>
      </Group>

      <Group title="Budget, prizes & notes">
        <div className="grid gap-4 sm:grid-cols-2">
          <Choice {...F} name="estimated_budget" label="Estimated budget" options={BUDGETS} />
          <Choice {...F} name="prize_format" label="How will winners be rewarded?" options={PRIZES} />
        </div>
        <div className="mt-4 grid gap-4">
          <Area {...F} name="additional_notes" label="Additional notes" />
          <Choice {...F} name="how_heard" label="How did you hear about us?" options={HOW_HEARD} />
        </div>
      </Group>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div>
      <h3 className="mb-3 font-heading text-base font-bold">{title}</h3>
      {children}
    </div>
  );
}

function Wrap({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}{required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  );
}

function Static({ value }) {
  return <p className="rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">{value || '—'}</p>;
}

function Text({ form, set, readOnly, name, label, required, type = 'text', min }) {
  return (
    <Wrap label={label} required={required}>
      {readOnly ? <Static value={form[name]} /> : (
        <input type={type} min={min || undefined} className="c53-input" value={form[name] || ''} onChange={(e) => set(name, e.target.value)} />
      )}
    </Wrap>
  );
}

function Area({ form, set, readOnly, name, label, required }) {
  return (
    <Wrap label={label} required={required}>
      {readOnly ? <Static value={form[name]} /> : (
        <textarea className="c53-input min-h-[120px] resize-y" value={form[name] || ''} onChange={(e) => set(name, e.target.value)} />
      )}
    </Wrap>
  );
}

function Choice({ form, set, readOnly, name, label, options }) {
  return (
    <Wrap label={label}>
      {readOnly ? <Static value={form[name]} /> : (
        <select className="c53-input" value={form[name] || ''} onChange={(e) => set(name, e.target.value)}>
          <option value="">Not specified</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </Wrap>
  );
}