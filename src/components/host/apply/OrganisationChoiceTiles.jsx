/** Two-tile choice: is this challenge for my own organisation, or someone else? */
import { Building2, Users, User, Check } from 'lucide-react';

export default function OrganisationChoiceTiles({ orgName, isIndividual = false, value, onChange }) {
  const tiles = [
    {
      value: 'my_org',
      icon: orgName ? Building2 : (isIndividual ? User : Building2),
      label: orgName
        ? "I'm organising this for my company"
        : isIndividual
          ? "I'm organising this for myself"
          : "I'm organising this for my own organisation",
      hint: orgName || (isIndividual ? 'No extra details needed' : 'Add your organisation details above'),
    },
    {
      value: 'other',
      icon: Users,
      label: "I'm organising this for someone else",
      hint: 'Another company, school, club or community',
    },
  ];

  return (
    <div role="radiogroup" aria-label="Who is this challenge being organised for?" className="grid gap-4 sm:grid-cols-2">
      {tiles.map((t) => {
        const active = value === t.value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(t.value)}
            className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
              active ? 'border-gold bg-gold/10' : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.hint}</span>
            </span>
            {active && <Check className="h-5 w-5 shrink-0 text-gold" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}