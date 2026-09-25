import { useState } from 'react';
import { Gauge, Users, Mail, Building2, ListTree, Award, Image as ImageIcon, Plus } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import CommandCentre from '@/components/marketing/CommandCentre';
import AudienceTable from '@/components/marketing/AudienceTable';
import CampaignBuilder from '@/components/marketing/CampaignBuilder';
import OrganisationsPanel from '@/components/marketing/OrganisationsPanel';
import PipelineList from '@/components/marketing/PipelineList';
import SponsorHub from '@/components/marketing/SponsorHub';
import ShareCardGenerator from '@/components/marketing/ShareCardGenerator';

const TABS = [
  { k: 'command', l: 'Command Centre', icon: Gauge },
  { k: 'audience', l: 'Audience', icon: Users },
  { k: 'campaigns', l: 'Campaigns', icon: Mail },
  { k: 'orgs', l: 'Organisations', icon: Building2 },
  { k: 'sponsors', l: 'Sponsors', icon: Award },
  { k: 'outreach', l: 'Outreach', icon: ListTree },
  { k: 'cards', l: 'Creative Assets', icon: ImageIcon },
];

export default function Marketing() {
  const { user } = useAuth();
  const [tab, setTab] = useState('command');
  const isAdmin = user?.role === 'admin' || user?.role === 'creator' || user?.is_admin === true;
  if (!isAdmin) return <div className="container-tight py-24 text-center text-muted-foreground">Admins only.</div>;

  return (
    <div className="container-tight py-12">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.22em] text-primary">53 Challenges · Growth Operations</p>
          <h1 className="mt-2 font-heading text-3xl font-extrabold sm:text-4xl">Turn every challenge into a movement.</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Recruit contestants, activate communities, and measure the path from first impression to verified submission.</p>
        </div>
        <button onClick={() => setTab('campaigns')} className="inline-flex items-center gap-2 rounded-xl grad-bg px-5 py-3 text-sm font-bold text-white">
          <Plus className="h-4 w-4" /> Create campaign
        </button>
      </div>
      <div className="mt-6 inline-flex flex-wrap rounded-xl border border-border bg-card p-1">
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${tab === t.k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><t.icon className="h-4 w-4" /> {t.l}</button>
        ))}
      </div>
      <div className="mt-8">
        {tab === 'command' && <CommandCentre onGoTo={setTab} />}
        {tab === 'audience' && <AudienceTable />}
        {tab === 'campaigns' && <CampaignBuilder />}
        {tab === 'orgs' && <OrganisationsPanel />}
        {tab === 'outreach' && <PipelineList />}
        {tab === 'sponsors' && <SponsorHub />}
        {tab === 'cards' && <ShareCardGenerator />}
      </div>
    </div>
  );
}