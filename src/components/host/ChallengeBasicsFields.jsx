/**
 * D8 — Host Experience Principles.
 * Title + description fields with persistent labels, helper text, length
 * guidance and a side tip card so hosts never face a blank page.
 */
import { useState } from 'react';
import { Lightbulb, BookOpen, Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const EXAMPLE_TITLE = 'Impressionist Oil Painting Contest';
const EXAMPLE_DESCRIPTION =
  'Create an original piece of work inspired by your local landscape, in any medium you like. Entries should communicate what makes the place meaningful to you, and include a short note explaining your idea. Open to entrants aged 18 and over.';

const TITLE_MAX = 80;
const DESC_MAX = 1500;

const TIPS = [
  'What participants should create',
  'The theme, medium, or required format',
  'Who is eligible to participate',
  'Why the challenge is being organised',
  'Important submission restrictions',
];

export default function ChallengeBasicsFields({ title, description, onTitleChange, onDescriptionChange }) {
  const [showExample, setShowExample] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-6">
        <div>
          <label htmlFor="challenge-title" className="block text-sm font-semibold">
            Challenge Title <span className="font-medium text-primary">(required)</span>
          </label>
          <p className="mb-2 mt-1 text-xs text-muted-foreground">
            Choose a short and memorable name for your challenge.
          </p>
          <input
            id="challenge-title"
            className="c53-input"
            maxLength={TITLE_MAX}
            placeholder="Impressionist Oil Painting Contest"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {title.length} / {TITLE_MAX} characters
          </p>
        </div>

        <div>
          <label htmlFor="challenge-description" className="block text-sm font-semibold">
            Description &amp; Objectives <span className="font-medium text-primary">(required)</span>
          </label>
          <p className="mb-2 mt-1 text-xs text-muted-foreground">
            Explain what participants should create, the purpose of the challenge, and any important requirements.
          </p>
          <textarea
            id="challenge-description"
            className="c53-input min-h-[160px]"
            maxLength={DESC_MAX}
            placeholder="Describe the style, theme or submission guidelines you have in mind..."
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
          />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Suggested length: 100–200 words</span>
            <span className="text-xs text-muted-foreground">
              {description.length} / {DESC_MAX} characters · {wordCount} {wordCount === 1 ? 'word' : 'words'}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!title.trim() || generating}
              onClick={async () => {
                setGenError('');
                setGenerating(true);
                try {
                  const res = await base44.integrations.Core.InvokeLLM({
                    prompt: `Write a description for a creative competition called "${title.trim()}"${
                      description.trim() ? `. The host has started with these notes: "${description.trim()}"` : ''
                    }. Between 140 and 200 words, plain friendly Australian English, second person, finishing with a complete sentence. Cover what participants should create, the theme or format, who can enter, how entries are submitted, and any important requirements or deadlines. Return only the description text, no title, no markdown.`,
                    response_json_schema: {
                      type: 'object',
                      properties: { description: { type: 'string' } },
                    },
                  });
                  const text = (res?.description || '').trim();
                  if (!text) throw new Error('empty');
                  onDescriptionChange(text.slice(0, DESC_MAX));
                } catch {
                  setGenError("We couldn't write that one — please try again.");
                }
                setGenerating(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-full grad-bg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generating ? 'Writing…' : 'Write it for me'}
            </button>
            <button
              type="button"
              onClick={() => setShowExample((s) => !s)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <BookOpen className="h-3.5 w-3.5" /> {showExample ? 'Hide example description' : 'See an example description'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!title.trim()) onTitleChange(EXAMPLE_TITLE);
                onDescriptionChange(EXAMPLE_DESCRIPTION);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/5 px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              Use this example
            </button>
          </div>

          {!title.trim() && (
            <p className="mt-2 text-xs text-muted-foreground">Add a title first and we can draft this for you.</p>
          )}
          {genError && <p className="mt-2 text-xs text-destructive">{genError}</p>}

          {showExample && (
            <p className="mt-3 rounded-xl border border-border bg-white/5 p-3 text-xs leading-relaxed text-muted-foreground">
              {EXAMPLE_DESCRIPTION}
            </p>
          )}
        </div>
      </div>

      <aside className="h-fit rounded-2xl border border-border bg-white/5 p-4">
        <p className="flex items-start gap-2 text-sm font-semibold">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
          A useful description usually includes:
        </p>
        <ul className="mt-3 space-y-2">
          {TIPS.map((tip) => (
            <li key={tip} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" aria-hidden="true" />
              {tip}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}