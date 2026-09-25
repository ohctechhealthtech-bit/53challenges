/** Step 3 — the idea itself. */
import IdeaPhotoPicker from '@/components/host/idea/IdeaPhotoPicker';
import { ACTIVITY_IMAGES } from '@/components/host/idea/ideaTileImages';
import IdeaTemplatePicker from '@/components/host/idea/IdeaTemplatePicker';
import IdeaSuggestButton from '@/components/host/idea/IdeaSuggestButton';
import { templateDefaults, TEMPLATE_CLEARED } from '@/components/host/idea/templateDefaults';
import { ACTIVITY_OPTIONS } from '@/components/host/idea/ideaOptions';

export default function IdeaDetailsStep({ data, set }) {
  // Picking an existing challenge template prefills the idea and everything
  // that comes with it (category, who can enter, how the winner is decided).
  // Hosts can still change any of it on the later steps.
  const apply = (patch) => Object.entries(patch).forEach(([k, v]) => set(k, v));
  const pickTemplate = (t) => apply(templateDefaults(t));
  const clearTemplate = () => apply(TEMPLATE_CLEARED);

  return (
    <div className="space-y-6">
      <IdeaTemplatePicker selectedId={data.template_id} onSelect={pickTemplate} onCustom={clearTemplate} />

      <div>
        <label htmlFor="challenge_title" className="mb-1.5 block text-sm font-semibold">
          What would you call your challenge?
        </label>
        <input
          id="challenge_title"
          value={data.challenge_title}
          onChange={(e) => set('challenge_title', e.target.value)}
          placeholder="e.g. The Great Backyard Bake-Off"
          className="c53-input"
        />
      </div>

      <div>
        <label htmlFor="challenge_description" className="mb-1.5 block text-sm font-semibold">
          Tell us what you have in mind
        </label>
        <textarea
          id="challenge_description"
          rows={6}
          value={data.challenge_description}
          onChange={(e) => set('challenge_description', e.target.value)}
          placeholder="Who would take part, what would they do, and what would make it special?"
          className="c53-input resize-none"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {data.challenge_description.trim().split(/\s+/).filter(Boolean).length} words — a few sentences is plenty.
        </p>
        <IdeaSuggestButton data={data} onSuggestion={(t) => set('challenge_description', t)} />
      </div>

      <div>
        <p className="mb-2.5 text-sm font-semibold">What kind of activity is it? <span className="font-normal text-muted-foreground">(optional)</span></p>
        <IdeaPhotoPicker
          options={ACTIVITY_OPTIONS}
          images={ACTIVITY_IMAGES}
          value={data.activity_type}
          onChange={(v) => set('activity_type', v)}
        />
      </div>
    </div>
  );
}