import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  'art-craft-making', 'food-farming-community', 'music-dance-performance',
  'outdoor-adventure', 'photography-film-digital', 'writing-ideas-innovation',
];

// Orange "AI Suggestion" box — type an optional keyword, hit Suggest, and it
// fills in the empty title/brief/category fields, then auto-generates a cover
// image.  Anything the admin already typed is preserved.
export default function AIChallengeSuggestBox({ onSuggestion }) {
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are helping an admin of "53 Challenges" — an Australian creative community challenge platform — create a new challenge.
${hint ? `The admin's idea/keywords: "${hint}".` : 'No specific idea was given — invent a fresh, inspiring challenge.'}
Suggest one challenge with:
- theme: a short catchy challenge title (max 8 words)
- description: an inspiring 2-4 sentence brief with clear guidelines on what participants should create and submit
- category: one of exactly: ${CATEGORIES.join(', ')}`,
        response_json_schema: {
          type: 'object',
          properties: {
            theme: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
          },
        },
      });
      onSuggestion({ title: res.theme, brief: res.description, category: res.category });
      toast.success('Suggestion applied — creating a cover image...');
      try {
        const img = await base44.integrations.Core.GenerateImage({
          prompt: `Vibrant, inspiring cover image for a community creative challenge titled "${res.theme}". ${res.description} Artistic, colourful, high quality, no text or words in the image.`,
        });
        if (img?.url) onSuggestion({ cover_image: img.url });
        toast.success('Cover image added — edit as needed');
      } catch {
        toast.error('Could not generate a cover image — you can add one manually');
      }
    } catch (e) {
      toast.error('Could not generate a suggestion');
    }
    setLoading(false);
  };

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-orange-800">
        <Sparkles className="w-4 h-4" /> AI Suggestion
      </div>
      <div className="flex gap-2">
        <Input
          value={hint}
          onChange={e => setHint(e.target.value)}
          placeholder="Optional idea, e.g. spring, pottery, nature..."
          className="bg-white"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); generate(); } }}
        />
        <Button type="button" onClick={generate} disabled={loading} className="bg-orange-600 hover:bg-orange-700 text-white shrink-0 gap-1.5">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Suggest
        </Button>
      </div>
      <p className="text-xs text-orange-700/80">Only fills fields that are still empty — anything you've already written is kept.</p>
    </div>
  );
}