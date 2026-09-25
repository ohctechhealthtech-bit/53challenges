import { useState } from 'react';
import { BookOpen, Download, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminChallengeApi } from '@/lib/adminChallengeApi';
import { downloadAuditCsv } from '@/lib/auditCsv';
import FieldGuidePanel from '@/components/admin/FieldGuidePanel';
import AnalysisPanel from '@/components/admin/AnalysisPanel';

// Section title + description with the parent's three tools: field guide,
// audit download and AI analysis. All three come from the parent API.
export default function SectionToolbar({ section, title, description, challengeId }) {
  const [guide, setGuide] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const run = async (kind, fn) => {
    setBusy(kind);
    setError('');
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const toggleGuide = () => {
    if (guide) { setGuide(null); return; }
    run('guide', async () => setGuide(await adminChallengeApi.guide({ section })));
  };

  const download = () => run('audit', async () => {
    const data = await adminChallengeApi.auditExport({ section, ...(challengeId ? { challengeId } : {}) });
    downloadAuditCsv(section, data);
  });

  const analyse = () => run('analysis', async () => {
    setAnalysis(await adminChallengeApi.analysis({ section, ...(challengeId ? { challengeId } : {}) }));
  });

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-bold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={toggleGuide} disabled={busy === 'guide'}>
            {busy === 'guide' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />} Field guide
          </Button>
          <Button variant="outline" size="sm" onClick={download} disabled={busy === 'audit'}>
            {busy === 'audit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download audit
          </Button>
          <Button variant="outline" size="sm" onClick={analyse} disabled={busy === 'analysis'}>
            {busy === 'analysis' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} AI analysis
          </Button>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <FieldGuidePanel guide={guide} />
      <AnalysisPanel analysis={analysis} />
    </div>
  );
}