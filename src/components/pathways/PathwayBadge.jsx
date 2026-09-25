import { Network, Lock, Mail, ShieldCheck } from 'lucide-react';

const META = {
  national_state_ranking: { label: 'National + State Rankings', icon: Network, tone: 'bg-primary/15 text-primary' },
  state_to_national: { label: 'State → National Pathway', icon: Network, tone: 'bg-blue-500/15 text-blue-400' },
  local_to_state_to_national: { label: 'Local → State → National Pathway', icon: Network, tone: 'bg-purple-500/15 text-purple-400' },
  series_championship: { label: 'Series Championship', icon: Network, tone: 'bg-amber-500/15 text-amber-400' },
  private_organisation: { label: 'Private Organisation', icon: Lock, tone: 'bg-rose-500/15 text-rose-400' },
  invitational: { label: 'Invitational', icon: ShieldCheck, tone: 'bg-emerald-500/15 text-emerald-400' },
};

export default function PathwayBadge({ pathway, member }) {
  if (!pathway) return null;
  const m = META[pathway.type] || META.national_state_ranking;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${m.tone}`}>
      <Icon className="h-3.5 w-3.5" /> {m.label}
      {member?.region && <span className="opacity-80">· {member.region}</span>}
      {pathway.type === 'invitational' && <Mail className="h-3 w-3 opacity-70" />}
    </span>
  );
}