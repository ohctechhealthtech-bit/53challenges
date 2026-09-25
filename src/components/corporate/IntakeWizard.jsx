import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronRight, ChevronLeft, Building2 } from 'lucide-react';
import { corporateIntake } from '@/lib/corporateIntake';

const AU_STATES = [
  { code: 'NSW', name: 'New South Wales' },
  { code: 'VIC', name: 'Victoria' },
  { code: 'QLD', name: 'Queensland' },
  { code: 'WA', name: 'Western Australia' },
  { code: 'SA', name: 'South Australia' },
  { code: 'TAS', name: 'Tasmania' },
  { code: 'ACT', name: 'Australian Capital Territory' },
  { code: 'NT', name: 'Northern Territory' },
];

// Plain-language family name for the recommended challenge format.
// Presentation only — derives a friendly label from the top mechanic/scoring
// record slugs. No business logic, no new records.
function familyName(rec) {
  const m = (rec.top_mechanics?.[0]?.slug) || '';
  const s = (rec.top_scoring?.[0]?.slug) || '';
  if (s.includes('judge') || s.includes('blind')) return 'Judged Showcase';
  if (s.includes('combined') || s.includes('public')) return 'Community Voting Battle';
  if (m.includes('best')) return 'UGC Submission Challenge';
  if (m.includes('verified')) return 'Skill Sprint';
  if (m.includes('prompt')) return 'UGC Submission Challenge';
  return 'Custom Challenge';
}

export default function IntakeWizard({ onComplete }) {
  const [accountTypes, setAccountTypes] = useState([]);
  const [questionnaire, setQuestionnaire] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0); // 0 = org, then 1..N questions
  const [org, setOrg] = useState({ name: '', account_type_id: '', abn: '', state: '', contact_name: '', contact_email: '', contact_phone: '' });
  const [answers, setAnswers] = useState({}); // question_id -> [option_ids] | string
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [atRes, qRes] = await Promise.all([corporateIntake.listAccountTypes(), corporateIntake.getQuestionnaire()]);
        const at = atRes?.data || atRes;
        const q = qRes?.data || qRes;
        setAccountTypes(at.account_types || []);
        setQuestionnaire(q.questionnaire);
        setQuestions(q.questions || []);
      } catch (e) {
        setError(e.message || 'Failed to load questionnaire');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error) return <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>;
  if (!questionnaire) return <div className="py-20 text-center text-muted-foreground">No active questionnaire is configured yet. Please check back soon.</div>;

  const totalSteps = questions.length + 1; // org + questions
  const isOrgStep = step === 0;
  const currentQ = isOrgStep ? null : questions[step - 1];

  const canProceed = () => {
    if (isOrgStep) {
      return !!(org.name.trim() && org.account_type_id && org.contact_name.trim()
        && /^\S+@\S+\.\S+$/.test(org.contact_email.trim()) && org.contact_phone.trim());
    }
    if (!currentQ) return true;
    if (!currentQ.is_required) return true;
    if (currentQ.type === 'free_text') return (answers[currentQ.id] || '').trim().length > 0;
    return (answers[currentQ.id] || []).length > 0;
  };

  const toggleOption = (qid, oid) => {
    setAnswers((a) => {
      const cur = a[qid] || [];
      return { ...a, [qid]: cur.includes(oid) ? cur.filter((x) => x !== oid) : [...cur, oid] };
    });
  };

  const setSingle = (qid, oid) => setAnswers((a) => ({ ...a, [qid]: [oid] }));
  const setText = (qid, val) => setAnswers((a) => ({ ...a, [qid]: val }));

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const selected_option_ids = [];
      const free_text_answers = {};
      let program_scope = 'single';
      for (const q of questions) {
        if (q.type === 'free_text') {
          free_text_answers[q.id] = answers[q.id] || '';
        } else {
          for (const oid of answers[q.id] || []) selected_option_ids.push(oid);
        }
      }
      // Derive program_scope from Q7 (single-select) option.
      const q7 = questions.find((qq) => qq.options?.some((o) => o.program_scope));
      if (q7) {
        const chosenId = (answers[q7.id] || [])[0];
        const chosen = q7.options.find((o) => o.id === chosenId);
        if (chosen?.program_scope) program_scope = chosen.program_scope;
      }
      const res = await corporateIntake.submitIntake({
        host_org: {
          ...org,
          contacts: `${org.contact_name} / ${org.contact_email} / ${org.contact_phone}`,
        },
        questionnaire_id: questionnaire.id,
        selected_option_ids,
        free_text_answers,
        program_scope,
      });
      onComplete(res?.data || res);
    } catch (e) {
      setError(/401/.test(e.message || '') ? 'Please sign in to submit your intake.' : (e.message || 'Submission failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (step < totalSteps - 1) setStep(step + 1);
    else submit();
  };
  const back = () => step > 0 && setStep(step - 1);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl grad-bg text-white"><Building2 className="h-5 w-5" /></div>
        <div>
          <h1 className="font-heading text-2xl font-bold">Corporate Challenge Intake</h1>
          <p className="text-sm text-muted-foreground">{questionnaire.name} · tell us about your challenge and we'll recommend a format.</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6 flex gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-border'}`} />
        ))}
      </div>

      {isOrgStep ? (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-heading text-lg font-semibold">Your organisation</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Organisation name *</label>
              <input className="c53-input" value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} placeholder="Acme Corp" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account type *</label>
              <select className="c53-input" value={org.account_type_id} onChange={(e) => setOrg({ ...org, account_type_id: e.target.value })}>
                <option value="">Select…</option>
                {accountTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">ABN</label>
              <input className="c53-input" value={org.abn} onChange={(e) => setOrg({ ...org, abn: e.target.value })} placeholder="optional" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">State</label>
              <select className="c53-input" value={org.state} onChange={(e) => setOrg({ ...org, state: e.target.value })}>
                <option value="">Select…</option>
                {AU_STATES.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact name *</label>
              <input className="c53-input" value={org.contact_name} onChange={(e) => setOrg({ ...org, contact_name: e.target.value })} placeholder="Jane Smith" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact email *</label>
              <input type="email" className="c53-input" value={org.contact_email} onChange={(e) => setOrg({ ...org, contact_email: e.target.value })} placeholder="jane@acme.com.au" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact phone *</label>
              <input type="tel" className="c53-input" value={org.contact_phone} onChange={(e) => setOrg({ ...org, contact_phone: e.target.value })} placeholder="04XX XXX XXX" />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-heading text-lg font-semibold">{currentQ.prompt}</h2>
          {currentQ.type === 'free_text' ? (
            <textarea className="c53-input min-h-[120px]" value={answers[currentQ.id] || ''} onChange={(e) => setText(currentQ.id, e.target.value)} placeholder="Type your answer…" />
          ) : currentQ.type === 'single_select' ? (
            <div className="grid gap-2">
              {currentQ.options.map((o) => {
                const selected = (answers[currentQ.id] || [])[0] === o.id;
                return (
                  <button key={o.id} onClick={() => setSingle(currentQ.id, o.id)} className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-white/5 text-muted-foreground hover:border-primary/50'}`}>
                    <span className="font-medium">{o.label}</span>
                    {selected && <ChevronRight className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-2">
              {currentQ.options.map((o) => {
                const selected = (answers[currentQ.id] || []).includes(o.id);
                return (
                  <button key={o.id} onClick={() => toggleOption(currentQ.id, o.id)} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-white/5 text-muted-foreground hover:border-primary/50'}`}>
                    <span className={`grid h-5 w-5 place-items-center rounded-md border ${selected ? 'border-primary bg-primary text-white' : 'border-muted-foreground'}`}>{selected && <ChevronRight className="h-3 w-3" />}</span>
                    <span className="font-medium">{o.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" onClick={back} disabled={step === 0 || submitting}><ChevronLeft className="mr-1 h-4 w-4" /> Back</Button>
        <Button onClick={next} disabled={!canProceed() || submitting} className="btn-glow">
          {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          {step === totalSteps - 1 ? 'Get my recommendation' : 'Continue'}
          {!submitting && <ChevronRight className="ml-1 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}