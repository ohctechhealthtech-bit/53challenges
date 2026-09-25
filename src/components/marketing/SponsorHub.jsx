import { useState } from 'react';
import { Sparkles, Users } from 'lucide-react';
import SponsorFinder from './SponsorFinder';
import SponsorManager from './SponsorManager';

const VIEWS = [
  { k: 'find', l: 'Find sponsors', icon: Sparkles },
  { k: 'manage', l: 'Sponsor profiles', icon: Users },
];

export default function SponsorHub() {
  const [view, setView] = useState('find');
  return (
    <div>
      <div className="inline-flex rounded-xl border border-border bg-card p-1">
        {VIEWS.map((v) => (
          <button
            key={v.k}
            onClick={() => setView(v.k)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${view === v.k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <v.icon className="h-4 w-4" /> {v.l}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {view === 'find' ? <SponsorFinder /> : <SponsorManager />}
      </div>
    </div>
  );
}