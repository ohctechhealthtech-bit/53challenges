/** Step 1 — who's hosting and how we reach them (mirrors the host application). */
import { ORG_KIND_OPTIONS } from '@/components/host/idea/ideaOptions';
import EmailVerifyGate from '@/components/verify/EmailVerifyGate';

// Defined outside the step so typing never remounts the input (which would
// drop focus after every keystroke).
function Field({ label, name, type = 'text', placeholder, optional, required, value, onChange, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1.5 block text-sm font-semibold">
        {label} {optional ? <span className="font-normal text-muted-foreground">(optional)</span> : null}
        {required ? <span className="font-bold text-destructive">(required)</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        className="c53-input"
      />
    </div>
  );
}

export default function IdeaContactStep({ data, set, emailVerified, onEmailVerified }) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Tell us who's hosting — we'll save this with your idea, so you only do it once.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          className="sm:col-span-2"
          label="Organisation name"
          name="organisation_name"
          placeholder="Riverside Primary School"
          value={data.organisation_name}
          onChange={set}
        />
        <div>
          <label htmlFor="org_kind" className="mb-1.5 block text-sm font-semibold">
            What kind of organisation?
          </label>
          <select
            id="org_kind"
            className="c53-input"
            value={data.org_kind}
            onChange={(e) => set('org_kind', e.target.value)}
          >
            {ORG_KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </div>
        <Field label="State" name="org_state" placeholder="NSW" value={data.org_state} onChange={set} />
        <Field label="Your name" name="name" placeholder="Jamie Taylor" value={data.name} onChange={set} />
        <Field label="Email address" name="email" type="email" required placeholder="jamie@example.com" value={data.email} onChange={set} />
        <Field label="Phone number" name="phone" type="tel" required placeholder="0400 000 000" value={data.phone} onChange={set} />
        <Field label="ABN" name="org_abn" optional placeholder="12 345 678 901" value={data.org_abn} onChange={set} />
      </div>

      {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((data.email || '').trim()) ? (
        <EmailVerifyGate
          light
          email={data.email.trim()}
          purpose="host_application"
          label="your idea"
          verified={emailVerified}
          onVerified={onEmailVerified}
        />
      ) : null}

      <p className="text-xs text-muted-foreground">
        We only use these to get back to you about your idea.
      </p>
    </div>
  );
}