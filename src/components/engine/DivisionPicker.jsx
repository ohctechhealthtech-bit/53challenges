// Which age / eligibility divisions a challenge is open to.
// Nothing selected = every division is open.
export const DIVISION_OPTIONS = [
  { slug: 'children', label: 'Children · Ages 7–12' },
  { slug: 'teens', label: 'Teens · Ages 13–19' },
  { slug: 'adults', label: 'Adults · 20+' },
  { slug: 'ndi', label: 'NDIS division' },
];

export default function DivisionPicker({ value = [], onChange }) {
  const toggle = (slug) =>
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {DIVISION_OPTIONS.map((d) => (
          <label key={d.slug} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 text-sm">
            <input type="checkbox" checked={value.includes(d.slug)} onChange={() => toggle(d.slug)} />
            <span className="font-medium">{d.label}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Each selected division is judged separately, so there's a winner per division. Leave all unticked to open the challenge to everyone.
      </p>
    </div>
  );
}