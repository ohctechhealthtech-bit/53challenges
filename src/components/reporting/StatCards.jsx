import { Trophy, FileText, Users, Sparkles, TrendingUp, Clock, Mail, Heart } from 'lucide-react';

export default function StatCards({ summary, moderation, audience }) {
  const cards = [
    { label: 'Competitions', value: summary.competitions, icon: Trophy },
    { label: 'Total entries', value: summary.totalEntries, icon: FileText },
    { label: 'Registered users', value: summary.users, icon: Users },
    { label: 'Creators entered', value: summary.creators, icon: Sparkles },
    { label: 'Reg→Submit conversion', value: `${summary.conversionRate}%`, icon: TrendingUp },
    { label: 'Pending moderation', value: moderation.pending, icon: Clock },
    { label: 'Audience members', value: audience.total, icon: Mail },
    { label: 'Active audience', value: audience.active, icon: Heart },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground"><c.icon className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-wide">{c.label}</span></div>
          <p className="mt-2 font-heading text-2xl font-extrabold">{c.value}</p>
        </div>
      ))}
    </div>
  );
}