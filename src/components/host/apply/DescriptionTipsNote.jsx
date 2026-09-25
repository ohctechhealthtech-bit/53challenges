/** Small tips card shown above the custom challenge description field. */
import { Lightbulb } from 'lucide-react';

const TIPS = [
  'What participants should create',
  'The theme, medium, or required format',
  'Who is eligible to participate',
  'Why the challenge is being organised',
  'Important submission restrictions',
];

export default function DescriptionTipsNote() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="flex items-center gap-2 font-heading text-base font-bold text-[#102A43]">
        <Lightbulb className="h-4 w-4 text-amber-400" aria-hidden="true" />
        A useful description usually includes:
      </p>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {TIPS.map((tip) => (
          <li key={tip} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}