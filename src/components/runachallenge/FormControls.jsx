/**
 * Reusable form primitives for the Run a Challenge discussion form.
 * Keeps select options black-on-white (via .c53-input) and provides
 * accessible labels, focus states, and inline error display.
 */

export function Section({ title, description, children }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-heading text-lg font-bold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function Field({ label, required, error, full, field, children }) {
  return (
    <div className={`text-sm ${full ? 'sm:col-span-2' : ''}`} data-field={field}>
      <span className="mb-1.5 block font-medium">
        {label}{required && <span className="text-primary"> *</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-destructive">{error}</span>}
    </div>
  );
}

export function TextInput(props) {
  return <input className="c53-input" {...props} />;
}

export function TextArea(props) {
  return <textarea className="c53-input min-h-24" {...props} />;
}

export function Select({ options, placeholder, ...props }) {
  return (
    <select className="c53-input" {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/** Pill-style multi-select toggle backed by a checkbox for accessibility. */
export function MultiSelect({ options, values, onChange }) {
  const toggle = (v) => {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else onChange([...values, v]);
  };
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {options.map((o) => {
        const active = values.includes(o);
        return (
          <button
            type="button"
            key={o}
            onClick={() => toggle(o)}
            aria-pressed={active}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/50'
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function Checkbox({ label, checked, onChange, required, error }) {
  return (
    <label className="flex items-start gap-2.5 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
      />
      <span>
        {label}{required && <span className="text-primary"> *</span>}
      </span>
      {error && <span className="mt-0.5 block text-xs text-destructive">{error}</span>}
    </label>
  );
}