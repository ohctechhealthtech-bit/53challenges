import { safeExternalUrl } from '@/lib/safeUrl';
import { useState } from 'react';
import { X, ExternalLink, AlertTriangle } from 'lucide-react';
import ScoreForm from '@/components/judging/ScoreForm';
import ComplianceFlagBox from '@/components/judging/ComplianceFlagBox';
import { submitScore } from '@/lib/judgeScoring';

// Blind score sheet: the anonymous entry, the panel rubric, and a compliance
// flag. Judge identity is attached server-side — never sent from here.
export default function ScoreSheet({ panel, assignment, onClose, onSubmitted }) {
  const [compliance, setCompliance] = useState({ flagged: false, reason: '', note: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (scores, comments) => {
    if (compliance.flagged && !compliance.reason) {
      setError('Choose a reason for the compliance flag.');
      return;
    }
    setError('');
    try {
      await submitScore({ panelId: panel.id, entryId: assignment.entry_id, scores, comments, compliance });
      onSubmitted();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-border bg-card p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-heading text-xl font-extrabold">Blind scoring · <span className="font-mono">{assignment.anonymous_id}</span></h3>
            <p className="text-xs text-muted-foreground">{panel.competition_title}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-white/5 p-4">
          {assignment.work_type === 'text' ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{assignment.work_text || '(No text provided)'}</p>
          ) : safeExternalUrl(assignment.work_link) ? (
            <a href={safeExternalUrl(assignment.work_link)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              <ExternalLink className="h-4 w-4" /> Open submitted work
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">(No work attached)</p>
          )}
        </div>

        <div className="mt-4">
          <ComplianceFlagBox value={compliance} onChange={setCompliance} />
        </div>

        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        <div className="mt-4">
          <ScoreForm criteria={panel.criteria} scaleMax={panel.scale_max || 10} onSubmit={handleSubmit} submitLabel="Submit scores" />
        </div>
      </div>
    </div>
  );
}