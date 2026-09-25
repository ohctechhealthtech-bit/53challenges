import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { templateLibrary } from '@/lib/templateLibrary';
import TemplateIntakeForm from '@/components/host/templates/TemplateIntakeForm';
import TemplateChoiceCard from '@/components/host/templates/TemplateChoiceCard';
import HostBrandCustomiseForm from '@/components/host/templates/HostBrandCustomiseForm';

export default function HostTemplateSelect() {
  const [stage, setStage] = useState('intake'); // intake | choose | brand
  const [options, setOptions] = useState([]);
  const [proposal, setProposal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const recommend = async (answers) => {
    setBusy(true);
    setError('');
    try {
      const data = await templateLibrary.recommend(answers, 5);
      setOptions(data.templates || []);
      setStage('choose');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const choose = async (t) => {
    setBusy(true);
    setError('');
    try {
      const data = await templateLibrary.selectTemplate(t.id);
      setProposal(data.proposal);
      setStage('brand');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="host-light min-h-screen">
      <div className="container-tight py-12">
        <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">Start your challenge</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Pick a ready-made challenge package. We handle the rules, compliance and judging — you bring your brand.
        </p>

        {error && <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}

        <div className="mt-8">
          {busy && stage !== 'brand' && (
            <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
          )}

          {stage === 'intake' && !busy && <TemplateIntakeForm onSubmit={recommend} busy={busy} />}

          {stage === 'choose' && !busy && (
            options.length === 0 ? (
              <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                We don't have a matching package available just yet. Please check back soon.
              </p>
            ) : (
              <>
                <h2 className="font-heading text-xl font-extrabold">Recommended for you</h2>
                <div className="mt-5 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {options.map((t) => <TemplateChoiceCard key={t.id} template={t} onChoose={choose} busy={busy} />)}
                </div>
                <button type="button" onClick={() => setStage('intake')} className="mt-6 text-sm font-semibold text-primary hover:underline">
                  Change my answers
                </button>
              </>
            )
          )}

          {stage === 'brand' && proposal && <HostBrandCustomiseForm proposal={proposal} />}
        </div>
      </div>
    </div>
  );
}