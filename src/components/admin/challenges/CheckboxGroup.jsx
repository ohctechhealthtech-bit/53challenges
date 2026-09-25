// Multi-select checkbox row used for accepted entry types and age divisions.
export default function CheckboxGroup({ label, options, values = [], disabled, onChange }) {
  const toggle = (v) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <fieldset disabled={disabled}>
      <legend className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const value = o.value ?? o;
          const text = o.label ?? String(o).replace(/_/g, ' ');
          const on = values.includes(value);
          return (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm capitalize ${on ? 'border-primary bg-primary/10 font-semibold' : 'border-border'} ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(value)} />
              {text}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}