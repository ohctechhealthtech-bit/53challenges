import { useState } from 'react';
import { Link } from 'react-router-dom';
import CorporateIntakeQueue from '@/components/dashboard/CorporateIntakeQueue';
import HostProposalQueue from '@/components/dashboard/HostProposalQueue';
import ServiceDeliveryPanel from '@/components/corporate/ServiceDeliveryPanel';
import IdeaSubmissionsQueue from '@/components/dashboard/IdeaSubmissionsQueue';

const TABS = [
  ['host', 'Host Proposals'],
  ['ideas', 'Idea Submissions'],
  ['intake', 'Organisation Intake'],
  ['service', 'Service Delivery'],
];

export default function HostRequestsPanel({ initialSub = '' }) {
  const [sub, setSub] = useState(TABS.some(([k]) => k === initialSub) ? initialSub : 'host');

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-border">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSub(key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition ${sub === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {label}
          </button>
        ))}
        <Link to="/corporate-intake-admin" className="ml-auto self-center text-xs text-primary hover:underline">
          Questionnaire manager →
        </Link>
      </div>
      <div className="mt-6">
        {sub === 'intake' ? <CorporateIntakeQueue />
          : sub === 'host' ? <HostProposalQueue />
          : sub === 'ideas' ? <IdeaSubmissionsQueue />
          : <ServiceDeliveryPanel />}
      </div>
    </div>
  );
}