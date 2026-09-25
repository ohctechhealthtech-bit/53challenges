import { Button } from '@/components/ui/button';
import { CheckCircle2, ShieldAlert, ArrowRight, Sparkles, Wrench, Handshake, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';

const DIMENSION_LABELS = {
  top_mechanics: 'Mechanic',
  top_categories: 'Activity area',
  top_modes: 'Participation mode',
  top_audiences: 'Audience',
  top_scoring: 'Scoring model',
  top_evidence: 'Evidence',
  top_pathways: 'Pathway',
};

const COMPLIANCE_BANNERS = {
  public_voting: { title: 'Public voting selected', body: 'A VotingConfiguration record will be required before this challenge can pass the voting_open lifecycle gate. It remains blocked until counsel signs the voting legal opinion.' },
  minors_involved: { title: 'Minors may participate', body: 'Guardian consent and the minors safeguard checklist are attached. A signed GuardianConsent record is required before any minor can enter.' },
  hybrid: { title: 'Hybrid judging', body: 'Both judge and public-vote obligations apply — the assessment engine will surface both.' },
  enterprise_pipeline: { title: 'National / enterprise scope', body: 'Flagged for enterprise pipeline account management follow-up.' },
  account_management: { title: 'Program / multi-round', body: 'Account management follow-up flagged for this program.' },
  community_local_band: { title: 'Community / local band', body: 'Scoped to a community/local band (full band definitions arrive in a later module).' },
};

function familyName(rec) {
  const m = (rec.top_mechanics?.[0]?.slug) || '';
  const s = (rec.top_scoring?.[0]?.slug) || '';
  if (s.includes('judge') || s.includes('blind')) return 'Judged Showcase';
  if (s.includes('combined') || s.includes('public')) return 'Community Voting Battle';
  if (m.includes('best') || m.includes('prompt')) return 'UGC Submission Challenge';
  if (m.includes('verified')) return 'Skill Sprint';
  return 'Custom Challenge';
}

export default function RecommendationScreen({ recommendation, draft, onRestart }) {
  const flags = recommendation.compliance_flags || [];
  const tierId = recommendation.service_tier_id || draft?.service_tier_id || '';

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl grad-bg text-white"><Sparkles className="h-5 w-5" /></div>
        <div>
          <h1 className="font-heading text-2xl font-bold">Your recommended challenge format</h1>
          <p className="text-sm text-muted-foreground">Based on your answers — every item below is a pre-existing platform record.</p>
        </div>
      </div>

      {/* Format headline */}
      <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Recommended format</p>
        <h2 className="mt-1 font-heading text-3xl font-extrabold grad-text">{familyName(recommendation)}</h2>
        {recommendation.rationale_summary && (
          <p className="mt-3 text-sm text-muted-foreground">{recommendation.rationale_summary}</p>
        )}
      </div>

      {/* Compliance banners */}
      {flags.length > 0 && (
        <div className="mb-6 space-y-3">
          {flags.map((f) => {
            const b = COMPLIANCE_BANNERS[f] || { title: f, body: 'Compliance flag raised on the draft.' };
            return (
              <div key={f} className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{b.title}</p>
                  <p className="text-xs text-muted-foreground">{b.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recommended records by dimension */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {Object.entries(DIMENSION_LABELS).map(([key, label]) => {
          const items = recommendation[key] || [];
          if (!items.length) return null;
          return (
            <div key={key} className="rounded-xl border border-border bg-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
              <div className="space-y-1.5">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{it.name}</span>
                    <span className="text-xs text-muted-foreground">score {it.score}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Service tier choice */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Service tier</p>
        <p className="text-sm text-foreground">
          {tierId === draft?.service_tier_id ? 'Based on your involvement level, we recommend: ' : 'Selected: '}
          <span className="font-semibold">{draft?.service_tier_id ? 'See tier below' : ''}</span>
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <TierCard icon={Wrench} title="Self-Serve" desc="Open the Competition Builder pre-populated from this recommendation." cta="Open Competition Builder" to="/run-a-challenge" highlight={tierId} />
          <TierCard icon={Handshake} title="Assisted" desc="53 designs the challenge; you operate it." cta="Submit — we'll contact you" submit />
          <TierCard icon={Crown} title="Managed by 53" desc="53 operates end to end; you sponsor and approve." cta="Submit — we'll contact you" submit />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onRestart}>Start over</Button>
        <Link to="/challenges"><Button variant="outline">Browse challenges</Button></Link>
      </div>
    </div>
  );
}

function TierCard({ icon: Icon, title, desc, cta, to, submit, highlight }) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-white/5 p-4">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-2 font-heading font-semibold">{title}</p>
      <p className="mt-1 flex-1 text-xs text-muted-foreground">{desc}</p>
      {submit ? (
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => alert('Thank you — we\'ll contact you within 2 business days.')}>{cta}</Button>
      ) : (
        <Button size="sm" className="mt-3" asChild><Link to={to}>{cta}</Link></Button>
      )}
    </div>
  );
}