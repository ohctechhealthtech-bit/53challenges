import { useState } from 'react';
import { Compass, FileText, Building2 } from 'lucide-react';
import SubTabs from '@/components/dashboard/SubTabs';
import DiscoverChallenges from '@/components/dashboard/challenges/DiscoverChallenges';
import MyChallenges from '@/components/dashboard/challenges/MyChallenges';
import CreateHostPanel from '@/components/dashboard/challenges/CreateHostPanel';

const TABS = [
  { key: 'discover', label: 'Discover', icon: Compass },
  { key: 'mine', label: 'My Challenges', icon: FileText },
  { key: 'host', label: 'Create / Host', icon: Building2 },
];

/** Challenges tab — the competition hub, in sub-tabs. */
export default function ChallengesTab({ entries, hostInquiries }) {
  const [sub, setSub] = useState('discover');

  return (
    <div className="space-y-6">
      <SubTabs tabs={TABS} active={sub} onChange={setSub} />
      {sub === 'discover' && <DiscoverChallenges />}
      {sub === 'mine' && <MyChallenges entries={entries} />}
      {sub === 'host' && <CreateHostPanel hostInquiries={hostInquiries} />}
    </div>
  );
}