import { MapPin, Award, Users, Image as ImageIcon, ShieldCheck, Fish } from 'lucide-react';

const pretty = (s) => (s || '').replace(/_/g, ' ');

export default function LaunchCard({ item }) {
  const modules = item.module_extensions || [];
  const badges = [
    { icon: MapPin, label: item.geography === 'national' ? 'National + state rankings' : item.geography },
    { icon: Award, label: pretty(item.mechanic) },
    { icon: Users, label: pretty(item.participation) },
    { icon: ImageIcon, label: pretty(item.evidence) },
    { icon: ShieldCheck, label: pretty(item.scoring_model) },
  ].filter((b) => b.label);
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300">Live now</span>
        {modules.includes && modules.includes('fishing') && <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-bold text-sky-300"><Fish className="h-3 w-3" /> Fishing module</span>}
      </div>
      <h3 className="mt-3 font-heading text-xl font-bold">{item.name}</h3>
      <p className="text-xs text-muted-foreground">{item.category} › {item.subcategory}</p>
      {item.brief && <p className="mt-2 text-sm text-muted-foreground">{item.brief}</p>}
      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        {badges.map((b, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-semibold text-muted-foreground"><b.icon className="h-3 w-3" /> {b.label}</span>
        ))}
        {item.audience && <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">For: {item.audience}</span>}
      </div>
      {item.hold_for_audit && <p className="mt-2 text-xs text-amber-300">Results held for independent audit sign-off.</p>}
    </div>
  );
}