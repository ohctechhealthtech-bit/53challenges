/** Step 4 — how the challenge would run: who enters, how many, who decides. */
import IdeaTilePicker from '@/components/host/idea/IdeaTilePicker';
import IdeaJudgingSection from '@/components/host/idea/IdeaJudgingSection';
import { AGE_OPTIONS, PARTICIPANT_OPTIONS, REACH_OPTIONS } from '@/components/host/idea/ideaOptions';

export default function IdeaFormatStep({ data, set }) {
  return (
    <div className="space-y-7">
      <div>
        <p className="mb-2.5 text-sm font-semibold">Who would you like to be able to enter?</p>
        <IdeaTilePicker multi options={AGE_OPTIONS} value={data.age_groups} onChange={(v) => set('age_groups', v)} />
      </div>
      <div>
        <p className="mb-2.5 text-sm font-semibold">Roughly how many people might take part?</p>
        <IdeaTilePicker options={PARTICIPANT_OPTIONS} value={data.participants} onChange={(v) => set('participants', v)} />
      </div>
      <div>
        <p className="mb-2.5 text-sm font-semibold">How far should it reach?</p>
        <IdeaTilePicker options={REACH_OPTIONS} value={data.reach} onChange={(v) => set('reach', v)} />
      </div>
      <IdeaJudgingSection />
    </div>
  );
}