import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Publishes the public transparency page for the season.
export default function ReportPanel({ report, url, season, readOnly, onGenerate }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState(url || '');

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await onGenerate({ season });
      if (res?.public_report_url) setLink(res.public_report_url);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card/60 p-5">
      <h3 className="font-heading text-base font-bold">Public transparency report</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        A public page showing where the season's money came from and where it went.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={generate} disabled={busy || readOnly}>
          {busy ? 'Publishing…' : link ? 'Republish report' : 'Publish report'}
        </Button>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            View public page <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      {report?.generated_at && (
        <p className="mt-3 text-xs text-muted-foreground">Last published {new Date(report.generated_at).toLocaleString('en-AU')}</p>
      )}
    </section>
  );
}