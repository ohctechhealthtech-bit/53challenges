/** Optional step — high-level rules and expectations for participants. */
import IdeaTilePicker from '@/components/host/idea/IdeaTilePicker';
import { RULE_HELPER_OPTIONS } from '@/components/host/idea/ideaOptions';

export default function IdeaRulesStep({ data, set }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2.5 text-sm font-semibold">
          Which of these should apply? <span className="font-normal text-muted-foreground">(optional)</span>
        </p>
        <IdeaTilePicker
          multi
          options={RULE_HELPER_OPTIONS}
          value={data.rules_expectations}
          onChange={(v) => set('rules_expectations', v)}
        />
      </div>

      <div>
        <label htmlFor="rules_notes" className="mb-1.5 block text-sm font-semibold">
          Any specific rules or constraints?
        </label>
        <textarea
          id="rules_notes"
          rows={4}
          value={data.rules_notes}
          onChange={(e) => set('rules_notes', e.target.value)}
          placeholder="e.g. Must be a resident of Moreton Bay, open only to Years 7–10, no drone footage, maximum 2-minute video."
          className="c53-input resize-none"
        />
      </div>
    </div>
  );
}