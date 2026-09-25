/** Step 3 — what the host is actually trying to achieve. */
import IdeaPhotoPicker from '@/components/host/idea/IdeaPhotoPicker';
import { PURPOSE_IMAGES } from '@/components/host/idea/ideaTileImages';
import { PURPOSE_OPTIONS } from '@/components/host/idea/ideaOptions';

const REQUIRED_ORGS = ['business', 'workplace', 'council'];

export default function IdeaPurposeStep({ data, set }) {
  const required = REQUIRED_ORGS.some((t) => (data.org_types || []).includes(t));
  const secondary = data.secondary_objectives || [];

  // Keep at most two — picking a third drops the oldest.
  const setSecondary = (next) => set('secondary_objectives', next.slice(-2));

  return (
    <div className="space-y-7">
      <div>
        <p className="mb-2.5 text-sm font-semibold">
          What&rsquo;s your main goal?{' '}
          {required ? null : <span className="font-normal text-muted-foreground">(optional)</span>}
        </p>
        <IdeaPhotoPicker
          options={PURPOSE_OPTIONS}
          images={PURPOSE_IMAGES}
          value={data.primary_objective}
          onChange={(v) => set('primary_objective', v)}
        />
      </div>

      <div>
        <p className="mb-2.5 text-sm font-semibold">
          Any other goals? <span className="font-normal text-muted-foreground">(optional, pick up to 2)</span>
          {secondary.length ? (
            <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              {secondary.length} of 2
            </span>
          ) : null}
        </p>
        <IdeaPhotoPicker
          multi
          images={PURPOSE_IMAGES}
          options={PURPOSE_OPTIONS.filter((o) => o.value !== data.primary_objective)}
          value={secondary}
          onChange={setSecondary}
        />
      </div>

      <div>
        <label htmlFor="participant_next_action" className="mb-1.5 block text-sm font-semibold">
          What is the one action you want participants to take?{' '}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <p className="mb-2 text-xs text-muted-foreground">
          This helps us shape the challenge around a measurable outcome.
        </p>
        <input
          id="participant_next_action"
          type="text"
          value={data.participant_next_action}
          onChange={(e) => set('participant_next_action', e.target.value)}
          placeholder="e.g. Book an appointment, Sign up for our newsletter, Visit our store"
          className="c53-input"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Tip: the more specific this is, the better we can build for it.
        </p>
      </div>
    </div>
  );
}