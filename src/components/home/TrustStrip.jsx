import { Link } from 'react-router-dom';
import { ShieldCheck, Users, Lock, MapPin } from 'lucide-react';
import RevealOnScroll from '@/components/home/RevealOnScroll';

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: 'Transparent Judging', desc: 'Independent panels and audited results' },
  { icon: Users, label: 'Verified Organisers', desc: 'Every challenge is run by a vetted host' },
  { icon: Lock, label: 'Safe Participation', desc: 'Moderated entries and community guidelines' },
  { icon: MapPin, label: 'Australia-Wide Access', desc: 'Compete from every state and territory' },
];

export default function TrustStrip() {
  return (
    <RevealOnScroll as="section" className="border-y border-border/60 bg-card/40 py-6">
      <div className="container-tight">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <item.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </RevealOnScroll>
  );
}