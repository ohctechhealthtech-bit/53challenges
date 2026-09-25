import { CheckCircle2, Send, Heart, Layers } from 'lucide-react';

const ACCENTS = ['text-emerald-400', 'text-sky-400', 'text-primary', 'text-amber-400'];

export default function GrowthStats({ completedCount, submittedCount, challengeCount, totalVotes }) {
  const stats = [
    { label: 'Challenges completed', value: completedCount, Icon: CheckCircle2 },
    { label: 'Entries submitted', value: submittedCount, Icon: Send },
    { label: 'Challenges entered', value: challengeCount, Icon: Layers },
    { label: 'Votes received', value: totalVotes, Icon: Heart },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(({ label, value, Icon }, i) => (
        <div key={label} className="rounded-2xl border border-border bg-card p-5">
          <Icon className={`h-5 w-5 ${ACCENTS[i % ACCENTS.length]}`} aria-hidden="true" />
          <p className="mt-3 font-heading text-2xl font-extrabold">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}