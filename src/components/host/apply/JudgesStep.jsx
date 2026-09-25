/**
 * Judging question — hosts either use judges from our panel (loaded from the
 * judges master), bring their own, or mix both. Host-added judges are added
 * to the judge list straight away and linked to this application.
 */
import { useEffect, useState } from 'react';
import { Plus, Award, UserPlus, Users } from 'lucide-react';
import QuestionTiles from '@/components/host/QuestionTiles';
import PlatformJudgePicker from '@/components/host/apply/PlatformJudgePicker';
import HostJudgeRow from '@/components/host/apply/HostJudgeRow';
import { judgesMaster } from '@/lib/judgesMaster';
import { hostPortalJudges } from '@/lib/hostPortalJudges';

const SOURCE_OPTIONS = [
  { value: 'platform', label: 'Use our judges', description: 'Pick from our panel, or let us appoint them.', icon: Award },
  { value: 'host', label: 'Add my own judges', description: 'You nominate the people who will score entries.', icon: UserPlus },
  { value: 'both', label: 'A mix of both', description: 'Your judges sit alongside ours on the panel.', icon: Users },
];

const BLANK = { name: '', email: '', level: 'state', disciplines: [], id: '' };

export default function JudgesStep({ answers, set }) {
  const source = answers.judge_source || 'platform';
  const judges = answers.host_judges?.length ? answers.host_judges : [BLANK];
  const needsOwn = source === 'host' || source === 'both';
  const usesOurs = source === 'platform' || source === 'both';
  const selected = answers.selected_judge_ids || [];

  const [pool, setPool] = useState([]);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    hostPortalJudges
      .panel()
      .then((res) => setPool(res.judges || []))
      .catch(() => setError('We could not load our judge list just now — we can appoint judges for you.'))
      .finally(() => setLoading(false));
    judgesMaster.options().then(setOptions).catch(() => {});
  }, []);

  const replace = (i, next) => set('host_judges', judges.map((j, idx) => (idx === i ? next : j)));

  const toggleSelected = (id) =>
    set('selected_judge_ids', selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="space-y-6">
      <QuestionTiles options={SOURCE_OPTIONS} value={source} onChange={(v) => set('judge_source', v)} />

      {usesOurs && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <PlatformJudgePicker
            judges={pool}
            loading={loading}
            error={error}
            selected={selected}
            onToggle={toggleSelected}
          />
        </div>
      )}

      {needsOwn && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Add the people you'd like on the panel — they're added to your panel straight away and we'll invite them.
          </p>
          {judges.map((j, i) => (
            <HostJudgeRow
              key={i}
              index={i}
              judge={j}
              options={options}
              onChange={(next) => replace(i, next)}
              onRemove={judges.length > 1 ? () => set('host_judges', judges.filter((_, idx) => idx !== i)) : null}
            />
          ))}
          <button
            type="button"
            onClick={() => set('host_judges', [...judges, { ...BLANK }])}
            className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm font-semibold transition hover:border-primary/50"
          >
            <Plus className="h-4 w-4" /> Add another judge
          </button>
        </div>
      )}
    </div>
  );
}