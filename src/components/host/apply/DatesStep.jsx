/**
 * "When does your challenge run?" — required start/end dates plus an optional
 * voting-close date, with inline validation. D8: plain language, calm feedback.
 *
 * Auto-suggests dates from the earlier series answers:
 *  - program_scope (single / series / annual_program)
 *  - series_cadence (monthly / quarterly / yearly)
 *  - series_count (3 / 6 / 12)
 * The suggestion is for the first challenge in the run; the host can still
 * adjust any date afterwards.
 */
import { CalendarClock, Sparkles } from 'lucide-react';

const DAY = 24 * 60 * 60 * 1000;

function toISO(d) {
  return d.toISOString().slice(0, 10);
}

/** Duration (in days) for one challenge, based on cadence / scope. */
function challengeDurationDays(answers) {
  const scope = answers.program_scope || 'single';
  if (scope === 'single') return 28; // 4 weeks
  const cadence = answers.series_cadence || 'monthly';
  if (cadence === 'monthly') return 21; // 3 weeks per challenge
  if (cadence === 'quarterly') return 56; // 8 weeks per challenge
  if (cadence === 'yearly') return 84; // 12 weeks per challenge
  return 28;
}

/** Human label for the suggestion, shown above the button. */
function suggestionLabel(answers) {
  const scope = answers.program_scope || 'single';
  const count = answers.series_count;
  const cadence = answers.series_cadence;
  if (scope === 'single') return 'a 4-week challenge starting in 2 weeks';
  const parts = [];
  if (count) parts.push(`${count} challenges`);
  if (cadence) parts.push(cadence === 'monthly' ? 'monthly' : cadence === 'quarterly' ? 'each quarter' : 'each year');
  const dur = challengeDurationDays(answers) / 7;
  return `the first of${parts.length ? ' ' + parts.join(', ') : ''} — a ${dur}-week run starting in 2 weeks`;
}

function suggestDates(answers) {
  const start = new Date(Date.now() + 14 * DAY); // 2 weeks for setup + approval
  const dur = challengeDurationDays(answers);
  const end = new Date(start.getTime() + dur * DAY);
  const voting = new Date(end.getTime() + 7 * DAY); // 1 week of voting
  return { start_date: toISO(start), end_date: toISO(end), voting_end_date: toISO(voting) };
}

export default function DatesStep({ answers, set }) {
  const { start_date, end_date, voting_end_date } = answers;
  const orderInvalid = !!start_date && !!end_date && end_date <= start_date;
  const votingInvalid = !!end_date && !!voting_end_date && voting_end_date <= end_date;
  const today = new Date().toISOString().slice(0, 10);

  const applySuggestion = () => {
    const s = suggestDates(answers);
    set('start_date', s.start_date);
    set('end_date', s.end_date);
    set('voting_end_date', s.voting_end_date);
  };

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-blue-900">
              Suggested: {suggestionLabel(answers)}
            </p>
            <p className="mt-0.5 text-xs text-blue-700">
              Based on your earlier answers — tap to fill these in, then adjust any date.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={applySuggestion}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Sparkles className="h-4 w-4" /> Suggest dates
        </button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            Start date <span className="text-destructive">*</span>
          </span>
          <input
            type="date"
            className="c53-input"
            min={today}
            value={start_date || ''}
            onChange={(e) => set('start_date', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            End date <span className="text-destructive">*</span>
          </span>
          <input
            type="date"
            className="c53-input"
            min={start_date || today}
            value={end_date || ''}
            onChange={(e) => set('end_date', e.target.value)}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            Voting closes <span className="text-muted-foreground">(optional)</span>
          </span>
          <input
            type="date"
            className="c53-input"
            min={end_date || start_date || today}
            value={voting_end_date || ''}
            onChange={(e) => set('voting_end_date', e.target.value)}
          />
          <span className="mt-1.5 block text-xs text-muted-foreground">
            If the public votes, this is the last day they can. Leave blank and we'll suggest one.
          </span>
        </label>
      </div>
      {orderInvalid && (
        <p className="mt-3 text-sm font-medium text-destructive" role="alert">
          The end date must be after the start date.
        </p>
      )}
      {votingInvalid && (
        <p className="mt-3 text-sm font-medium text-destructive" role="alert">
          Voting must close after the end date.
        </p>
      )}
    </div>
  );
}