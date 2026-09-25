/** Step 5 — timing, prizes and budget, plus anything else worth knowing. */
import IdeaTilePicker from '@/components/host/idea/IdeaTilePicker';
import { SCOPE_OPTIONS, TIMING_OPTIONS, PRIZE_OPTIONS, BUDGET_OPTIONS } from '@/components/host/idea/ideaOptions';

export default function IdeaPracticalStep({ data, set }) {
  return (
    <div className="space-y-7">
      <div>
        <p className="mb-2.5 text-sm font-semibold">Is this a one-off, or something ongoing?</p>
        <IdeaTilePicker options={SCOPE_OPTIONS} value={data.scope} onChange={(v) => set('scope', v)} />
      </div>
      <div>
        <p className="mb-2.5 text-sm font-semibold">When would you like it to run?</p>
        <IdeaTilePicker options={TIMING_OPTIONS} value={data.timing} onChange={(v) => set('timing', v)} />
      </div>
      <div>
        <p className="mb-2.5 text-sm font-semibold">Are there prizes involved?</p>
        <IdeaTilePicker options={PRIZE_OPTIONS} value={data.prize_pool} onChange={(v) => set('prize_pool', v)} />
      </div>
      <div>
        <p className="mb-2.5 text-sm font-semibold">What budget do you have in mind for running it?</p>
        <IdeaTilePicker options={BUDGET_OPTIONS} value={data.budget} onChange={(v) => set('budget', v)} />
      </div>
      <div>
        <label htmlFor="extra_notes" className="mb-1.5 block text-sm font-semibold">
          Anything else we should know? <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="extra_notes"
          rows={4}
          value={data.extra_notes}
          onChange={(e) => set('extra_notes', e.target.value)}
          placeholder="Sponsors, partners, key dates, or anything that matters to you."
          className="c53-input resize-none"
        />
      </div>
    </div>
  );
}