// Growth stats derived from a participant's challenge entries.
// Challenges run weekly, so a "streak" = consecutive calendar weeks with at
// least one submission.

const MS_WEEK = 7 * 24 * 60 * 60 * 1000;

export function entryDate(entry) {
  const raw = entry?.created_date || entry?.submitted_at || entry?.created_at;
  const d = raw ? new Date(raw) : null;
  return d && !isNaN(d.getTime()) ? d : null;
}

// Monday-based week index — stable integer we can compare/subtract.
function weekIndex(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7; // Mon = 0
  d.setUTCDate(d.getUTCDate() - day);
  return Math.floor(d.getTime() / MS_WEEK);
}

export function computeStreaks(entries = []) {
  const weeks = [...new Set(
    entries.map(entryDate).filter(Boolean).map(weekIndex)
  )].sort((a, b) => b - a);

  if (weeks.length === 0) return { current: 0, longest: 0, activeWeeks: 0, lastWeek: null };

  const thisWeek = weekIndex(new Date());

  // Current streak only counts if they submitted this week or last week.
  let current = 0;
  if (weeks[0] === thisWeek || weeks[0] === thisWeek - 1) {
    current = 1;
    for (let i = 1; i < weeks.length; i++) {
      if (weeks[i] === weeks[i - 1] - 1) current++;
      else break;
    }
  }

  let longest = 1;
  let run = 1;
  for (let i = 1; i < weeks.length; i++) {
    if (weeks[i] === weeks[i - 1] - 1) run++;
    else run = 1;
    if (run > longest) longest = run;
  }

  return { current, longest, activeWeeks: weeks.length, lastWeek: weeks[0] };
}

export function summarise(entries = []) {
  const completed = entries.filter((e) => (e.status || 'pending') === 'approved');
  const totalVotes = entries.reduce(
    (sum, e) => sum + Number(e.community_votes ?? e.vote_count ?? 0), 0
  );
  const challenges = new Set(entries.map((e) => e.challenge_id).filter(Boolean));
  return {
    completedCount: completed.length,
    submittedCount: entries.length,
    challengeCount: challenges.size,
    totalVotes,
    ...computeStreaks(entries),
  };
}