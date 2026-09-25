import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Loader2, RefreshCw } from 'lucide-react';
import { humanize, humanizeNotes } from './humanizeRequest';

const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    fit_score: { type: 'number', description: '0-100 how ready and suitable this request is to become a challenge' },
    fit_label: { type: 'string', description: 'Strong fit | Promising | Needs work | Poor fit' },
    strengths: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' }, description: 'Missing or unclear information' },
    risks: { type: 'array', items: { type: 'string' } },
    questions_for_applicant: { type: 'array', items: { type: 'string' } },
    recommended_next_step: { type: 'string' },
  },
  required: ['summary', 'fit_score', 'fit_label', 'strengths', 'gaps', 'questions_for_applicant', 'recommended_next_step'],
};

const scoreTone = (n) => (n >= 75 ? 'bg-green-100 text-green-800' : n >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800');

function List({ title, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">{title}</p>
      <ul className="list-disc pl-5 space-y-0.5 text-sm text-stone-800">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}

export default function HostRequestAiAnalysis({ request }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const analyse = async () => {
    setLoading(true); setError('');
    try {
      const facts = {
        organisation: request.company_name, industry: humanize(request.industry), website: request.website,
        working_title: request.working_title, type_of_challenge: humanize(request.challenge_type),
        main_goal: request.main_goal, description: request.description,
        who_should_participate: humanize(request.participants), expected_participants: humanize(request.expected_participants),
        geographic_scope: request.geographic_scope, launch_timeframe: humanize(request.launch_timeframe),
        budget: request.budget_range, prize_format: request.prize_format,
        additional_notes: humanizeNotes(request.additional_notes),
        idea_answers: request.idea_answers,
      };
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are reviewing a "host a challenge" enquiry for 53 Challenges, an Australian creative-challenge platform where hosts run public creative competitions (art, photography, writing, performance, etc.) with judges and public voting.

Assess the enquiry below for an admin. Be specific and practical: judge clarity of the brief, audience fit, feasibility of the participant numbers, timeline, budget/prizes, moderation or safeguarding concerns (especially when children are involved), and anything missing that the admin should ask before converting it into a live challenge. Keep every bullet under 20 words.

ENQUIRY:
${JSON.stringify(facts, null, 2)}`,
        response_json_schema: SCHEMA,
      });
      setResult(res);
    } catch (e) {
      setError(e?.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-violet-50/40 border-violet-200 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold text-stone-900 flex items-center gap-2">
          <Bot className="w-4 h-4 text-violet-600" /> AI analysis
        </h3>
        <Button size="sm" variant="outline" onClick={analyse} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : result ? <RefreshCw className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
          {loading ? 'Analysing…' : result ? 'Re-analyse' : 'Analyse this request'}
        </Button>
      </div>

      {!result && !loading && !error && (
        <p className="text-sm text-stone-500">Get a quick read on fit, gaps, risks and the questions worth asking the applicant.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className={`${scoreTone(result.fit_score)} text-xs`}>{result.fit_label} · {Math.round(result.fit_score)}/100</Badge>
          </div>
          <p className="text-sm text-stone-800">{result.summary}</p>
          <div className="grid md:grid-cols-2 gap-4">
            <List title="Strengths" items={result.strengths} />
            <List title="Gaps to clarify" items={result.gaps} />
            <List title="Risks" items={result.risks} />
            <List title="Questions for the applicant" items={result.questions_for_applicant} />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Recommended next step</p>
            <p className="text-sm text-stone-900">{result.recommended_next_step}</p>
          </div>
        </div>
      )}
    </div>
  );
}