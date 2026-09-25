import { useEffect, useState } from 'react';
import { Shield, Scale, Gavel, FileCheck, ScrollText, ShieldCheck, Stamp, FileText, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import RulePanel from '@/components/compliance/RulePanel';
import AssessmentPanel from '@/components/compliance/AssessmentPanel';
import GatePanel from '@/components/compliance/GatePanel';
import PermitPanel from '@/components/compliance/PermitPanel';
import TermsPanel from '@/components/compliance/TermsPanel';
import ConsentPanel from '@/components/compliance/ConsentPanel';
import RightsPanel from '@/components/compliance/RightsPanel';

const TABS = [
  { id: 'rules', label: 'Rules & Versions', icon: Scale },
  { id: 'triggers', label: 'Triggers', icon: Gavel },
  { id: 'jurisdictions', label: 'Jurisdictions', icon: Shield },
  { id: 'positions', label: 'Legal Positions', icon: FileCheck },
  { id: 'assessment', label: 'Assessment', icon: ScrollText },
  { id: 'gates', label: 'Lifecycle Gates', icon: ShieldCheck },
  { id: 'permits', label: 'Permits', icon: Stamp },
  { id: 'terms', label: 'Terms', icon: FileText },
  { id: 'consent', label: 'Consent', icon: Users },
  { id: 'rights', label: 'Rights', icon: ScrollText },
];

async function invoke(action, payload = {}) {
  return base44.functions.invoke('runComplianceAssessment', { action, ...payload });
}

export default function ComplianceRulesAdmin() {
  const [tab, setTab] = useState('rules');
  const [triggers, setTriggers] = useState([]);
  const [jurisdictions, setJurisdictions] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [t, j, p] = await Promise.all([
          invoke('list_triggers'),
          invoke('list_jurisdictions'),
          invoke('list_legal_positions'),
        ]);
        setTriggers(t.triggers || []);
        setJurisdictions(j.jurisdictions || []);
        setPositions(p.legal_positions || []);
      } catch { /* non-fatal */ } finally { setLoading(false); }
    })();
  }, [tab]);

  return (
    <div className="container-tight py-10">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Prompt 16</p>
        <h1 className="mt-1 font-heading text-3xl font-extrabold">Compliance Rule Engine</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Versioned regulatory rules, declarative triggers, and challenge classification. Unsigned rules are drafts the engine ignores.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${tab === t.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-secondary'}`}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">Loading…</div>
      ) : tab === 'rules' ? (
        <RulePanel />
      ) : tab === 'assessment' ? (
        <AssessmentPanel />
      ) : tab === 'gates' ? (
        <GatePanel />
      ) : tab === 'permits' ? (
        <PermitPanel />
      ) : tab === 'terms' ? (
        <TermsPanel />
      ) : tab === 'consent' ? (
        <ConsentPanel />
      ) : tab === 'rights' ? (
        <RightsPanel />
      ) : tab === 'triggers' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {triggers.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <code className="text-xs font-bold text-primary">{t.code}</code>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t.detection_source}</span>
              </div>
              <p className="mt-1.5 text-sm font-semibold">{t.name}</p>
              {t.detection_definition?.conditions?.length > 0 && (
                <pre className="mt-2 overflow-x-auto rounded-lg bg-black/30 p-2 text-xs text-muted-foreground">{JSON.stringify(t.detection_definition.conditions, null, 2)}</pre>
              )}
            </div>
          ))}
        </div>
      ) : tab === 'jurisdictions' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {jurisdictions.map((j) => (
            <div key={j.id} className="rounded-xl border border-border bg-card p-4">
              <code className="text-xs font-bold text-primary">{j.code}</code>
              <p className="mt-1 text-sm font-semibold">{j.name}</p>
              {j.regulator_name && <p className="mt-1 text-xs text-muted-foreground">{j.regulator_name}</p>}
              {j.regulator_link && <a href={j.regulator_link} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-primary hover:underline">Regulator ↗</a>}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {positions.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{p.topic}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{p.position}</span>
              </div>
              {p.source_document && <p className="mt-1 text-xs text-muted-foreground">{p.source_document}</p>}
              {p.review_by && <p className="mt-0.5 text-xs text-muted-foreground">Reviewed by: {p.review_by}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}