import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

// Lightweight AI readiness check for a challenge series before the admin
// publishes it. Sends the challenge data to the LLM and renders a verdict
// plus per-part findings inline inside the GoLiveCard preview modal.
export default function SeriesAiAnalyser({ challenges = [], proposal, org }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    if (!challenges.length) {
      toast.error('No challenges to analyse yet.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const a = proposal?.answers || {};
      const price = a.main_app_price || {};
      const scope = proposal?.program_scope || a.program_scope || 'single';
      const seriesCount = Number(a.series_count) || 1;
      const isSeries = scope === 'series' || scope === 'annual_program';

      const payload = {
        proposal: {
          title: proposal?.challenge_title || proposal?.title || proposal?.theme,
          host: org?.name || a.organisation_name,
          quote_aud: price.total_price || 0,
          start: a.start_date || '',
          end: a.end_date || '',
          series_count: isSeries ? seriesCount : 1,
          content_type: proposal?.content_type || a.content_type,
        },
        parts: challenges.map((c, i) => ({
          part: i + 1,
          title: c.title || c.theme,
          description: c.brief || c.description || '',
          has_banner: !!c.cover_image,
          category: c.category,
          content_type: c.content_type,
          age_divisions: c.divisions || [],
          start_date: c.start_date || c.starts_at || '',
          end_date: c.end_date || c.submission_ends_at || '',
          voting_end_date: c.voting_ends_at || '',
          status: c.status,
        })),
      };

      const res = await base44.integrations.Core.InvokeLLM({
        prompt:
          'You are a challenge readiness reviewer for a creative community challenges platform. ' +
          'Analyse the following challenge series (and each part) for readiness to publish. ' +
          'Check for missing or weak fields: banner image, description quality/length, age categories, date sanity (end after start, voting after end), and overall completeness. ' +
          'Return a concise verdict (ready / needs_attention / blocked), a one-sentence summary, and per-part findings with severity (ok/warning/block) and a short note. ' +
          'Be practical and specific. Data:\n' + JSON.stringify(payload, null, 2),
        response_json_schema: {
          type: 'object',
          properties: {
            verdict: { type: 'string', enum: ['ready', 'needs_attention', 'blocked'] },
            summary: { type: 'string' },
            parts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  part: { type: 'number' },
                  severity: { type: 'string', enum: ['ok', 'warning', 'block'] },
                  note: { type: 'string' },
                },
              },
            },
            suggestions: { type: 'array', items: { type: 'string' } },
          },
        },
      });
      setResult(res);
    } catch (e) {
      toast.error(`AI analysis failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const verdictStyle = {
    ready: { tone: 'bg-[#dcfce7] text-[#15803d]', icon: CheckCircle2, label: 'Ready to publish' },
    needs_attention: { tone: 'bg-amber-100 text-amber-700', icon: AlertTriangle, label: 'Needs attention' },
    blocked: { tone: 'bg-red-100 text-red-700', icon: XCircle, label: 'Blocked' },
  }[result?.verdict] || { tone: 'bg-stone-100 text-stone-600', icon: AlertTriangle, label: '' };

  const VerdictIcon = verdictStyle.icon;

  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-medium text-stone-700">AI readiness check</span>
          {result && (
            <Badge className={`${verdictStyle.tone} gap-1`}>
              <VerdictIcon className="w-3 h-3" /> {verdictStyle.label}
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={run} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {result ? 'Re-run' : 'Analyse'}
        </Button>
      </div>

      {loading && (
        <div className="px-3 pb-3 text-xs text-stone-500 flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reviewing {challenges.length} part{challenges.length > 1 ? 's' : ''}…
        </div>
      )}

      {result && !loading && (
        <div className="px-3 pb-3 space-y-2.5">
          <p className="text-xs text-stone-600">{result.summary}</p>
          {result.parts?.length > 0 && (
            <div className="space-y-1.5">
              {result.parts.map((p, i) => {
                const tone = p.severity === 'ok'
                  ? 'text-[#15803d]'
                  : p.severity === 'warning'
                    ? 'text-amber-600'
                    : 'text-red-600';
                const Icon = p.severity === 'ok' ? CheckCircle2 : p.severity === 'warning' ? AlertTriangle : XCircle;
                return (
                  <div key={i} className="flex items-start gap-1.5 text-xs">
                    <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${tone}`} />
                    <span className="text-stone-600"><span className="font-medium">Part {p.part}:</span> {p.note}</span>
                  </div>
                );
              })}
            </div>
          )}
          {result.suggestions?.length > 0 && (
            <div className="rounded-md bg-violet-50 border border-violet-200 px-2.5 py-2 space-y-1">
              <p className="text-xs font-medium text-violet-700">Suggestions</p>
              {result.suggestions.map((s, i) => (
                <p key={i} className="text-xs text-violet-800">• {s}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}