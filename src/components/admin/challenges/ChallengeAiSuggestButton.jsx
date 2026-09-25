import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    theme: { type: 'string' },
    description: { type: 'string' },
    season: { type: 'string' },
    start_date: { type: 'string', description: 'YYYY-MM-DD' },
    end_date: { type: 'string', description: 'YYYY-MM-DD' },
    voting_end_date: { type: 'string', description: 'YYYY-MM-DD' },
    accepted_entry_types: { type: 'array', items: { type: 'string' } },
    age_divisions: { type: 'array', items: { type: 'string' } },
  },
};

const isEmpty = (v) => (Array.isArray(v) ? v.length === 0 : v === '' || v === null || v === undefined);
const optValues = (opts) => (opts || []).map((o) => (typeof o === 'string' ? o : o.value ?? o.key)).filter(Boolean);

// Suggests content for the fields that are still empty. Anything already
// filled in is left exactly as-is.
export default function ChallengeAiSuggestButton({ values, reference, onApply }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const empties = Object.keys(SCHEMA.properties).filter((k) => isEmpty(values[k]));

  const run = async () => {
    setBusy(true);
    setNote('');
    try {
      const entryTypes = optValues(reference?.entry_types);
      const divisions = optValues(reference?.age_divisions);
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are helping an admin set up a creative community challenge on the "53 Challenges" platform (Australia).

Here is what the admin has already entered (do NOT change these, use them as context):
${JSON.stringify(
          Object.fromEntries(Object.entries(values).filter(([, v]) => !isEmpty(v))),
          null,
          2
        )}

Suggest sensible values ONLY for these missing fields: ${empties.join(', ')}.

Rules:
- title/theme: short, punchy, human (max 8 words).
- description: 2-4 warm, inviting sentences explaining what to create and submit.
- season: the calendar year as a string.
- dates: today is ${new Date().toISOString().slice(0, 10)}. start_date should be within the next 2 weeks, end_date about 3-4 weeks after start, voting_end_date about 1 week after end. Format YYYY-MM-DD.
- accepted_entry_types: choose only from ${JSON.stringify(entryTypes)} and pick the formats that genuinely suit the challenge.
- age_divisions: choose only from ${JSON.stringify(divisions)}; usually include all unless the challenge clearly suits one group.
Return only the requested fields.`,
        response_json_schema: SCHEMA,
      });

      const patch = {};
      for (const k of empties) {
        const v = res?.[k];
        if (isEmpty(v)) continue;
        if (k === 'accepted_entry_types') patch[k] = v.filter((x) => entryTypes.includes(x));
        else if (k === 'age_divisions') patch[k] = v.filter((x) => divisions.includes(x));
        else patch[k] = v;
      }
      if (Object.keys(patch).length === 0) setNote('No suggestions came back — try adding a theme first.');
      else onApply(patch);
    } catch (e) {
      setNote(e.message || 'Could not generate suggestions.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy || empties.length === 0}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {busy ? 'Thinking…' : 'Suggest with AI'}
      </button>
      <span className="text-xs text-muted-foreground">
        {empties.length === 0 ? 'Nothing left to fill in.' : 'Fills only the empty fields — your entries stay untouched.'}
      </span>
      {note && <span className="text-xs text-destructive">{note}</span>}
    </div>
  );
}