/**
 * AI helper for the custom challenge description — drafts a brief from the
 * title and category, or polishes what the host already wrote.
 */
import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export const DESC_MAX = 500;
export const DESC_MIN_WORDS = 30;
export const DESC_TARGET_WORDS = 100;

export default function AiDescriptionButton({ title, description, category, onGenerated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hasDraft = !!String(description || '').trim();

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Write the "Description & Objectives" text for a creative challenge that will be hosted on an Australian community arts platform.

Challenge title: ${title || '(not provided yet)'}
Creative category: ${category || 'open to any creative format'}
Host's rough notes: ${hasDraft ? description : '(none — invent something suitable for the title and category)'}

Rules:
- Keep the host's intent and any specifics from their notes; fix grammar and spelling.
- Cover: what participants should create, the theme or medium, who can enter, why the challenge is being run, and any submission requirements.
- Warm, encouraging, plain Australian English. Second person ("you", "your artwork").
- Between ${DESC_MIN_WORDS} and ${DESC_TARGET_WORDS} words, and never more than ${DESC_MAX} characters.
- Plain prose only: no headings, no bullet points, no markdown, no quotation marks around the text.`,
        response_json_schema: {
          type: 'object',
          properties: { description: { type: 'string' } },
          required: ['description'],
        },
      });
      const text = String(res?.description || '').trim();
      if (!text) throw new Error('The writer came back empty — please try again.');
      onGenerated(text.slice(0, DESC_MAX));
    } catch (e) {
      setError(e.message || 'Could not write a description right now.');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={generate}
        className="gap-2 border-amber-300 bg-card text-amber-700 hover:bg-amber-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? 'Writing…' : hasDraft ? 'Improve with AI' : 'Write it for me with AI'}
      </Button>
      <p className="text-xs text-muted-foreground">
        {hasDraft
          ? 'Polishes and expands what you wrote — you can still edit it after.'
          : 'Uses your title and category to draft a brief you can edit.'}
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}