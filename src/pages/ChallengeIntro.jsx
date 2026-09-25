import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { challengeApi } from '@/lib/challengeApi';
import { base44 } from '@/api/base44Client';
import { getPanelForCompetition } from '@/lib/votes';
import { categoryMeta, challengePhase } from '@/lib/challenges-data';
import { accentFor } from '@/components/challenges/intro/accents';
import { fetchChallengeDomainMap, challengeTarget } from '@/lib/challengeDomains';
import IntroHero from '@/components/challenges/intro/IntroHero';
import IntroSnapshotRow from '@/components/challenges/intro/IntroSnapshotRow';
import IntroMission from '@/components/challenges/intro/IntroMission';
import IntroHowItWorks from '@/components/challenges/intro/IntroHowItWorks';
import IntroLatestEntries from '@/components/challenges/intro/IntroLatestEntries';
import IntroWinnerAndShare from '@/components/challenges/intro/IntroWinnerAndShare';
import IntroVideo from '@/components/challenges/intro/IntroVideo';
import IntroHighlights from '@/components/challenges/intro/IntroHighlights';
import IntroGallery from '@/components/challenges/intro/IntroGallery';
import { introContentFor } from '@/lib/challengeIntroContent';

const fmtDate = (d) => { try { return format(new Date(d), 'd MMM yyyy'); } catch { return ''; } };
const prettify = (s) => String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const STATUS = {
  submit: { label: 'Entries Open', primary: 'Enter Challenge' },
  vote: { label: 'Voting Open', primary: 'Vote Now' },
  judging: { label: 'Judging', primary: 'View Finalists' },
  closed: { label: 'Completed', primary: 'See Winners' },
};

export default function ChallengeIntro({ challengeId }) {
  const { id: routeId } = useParams();
  const id = challengeId || routeId;
  const [challenge, setChallenge] = useState(null);
  const [entries, setEntries] = useState([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [voteCounts, setVoteCounts] = useState({});
  const [panel, setPanel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);

  // A challenge with its own domain is served from there, so a visitor who
  // reaches /challenges/<id> on the main site — from a shared link, search
  // result, or any link not yet converted — is sent straight on rather than
  // shown a second copy of the page here. Links on the main site use
  // ChallengeLink and skip this hop entirely; this is the safety net.
  //
  // Not applied when `challengeId` is passed: that is the subdomain rendering
  // its own challenge, so there is nowhere to redirect to. This used to rely on
  // challengeTarget returning an in-app target for the host we are already on —
  // which is correct, but only after fetching the whole domain map to reach
  // that conclusion. Checking the prop skips the request entirely.
  useEffect(() => {
    if (!id || challengeId) return undefined;
    let cancelled = false;
    fetchChallengeDomainMap().then((map) => {
      if (cancelled) return;
      const target = challengeTarget(id, map);
      if (target.href) {
        setLeaving(true);
        // replace(), not assign(), so Back returns to where they came from
        // rather than bouncing through this page again.
        window.location.replace(target.href);
      }
    });
    return () => { cancelled = true; };
  }, [id, challengeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try {
        // Fetched together rather than one after another. None of the last
        // three depend on the challenge record — they are all keyed on `id`
        // alone — so awaiting them in sequence made the page wait out four
        // round trips end to end when one would do. On a subdomain, where the
        // visitor sees "Loading challenge…" until this resolves, that was the
        // bulk of the perceived load time.
        const [fetched, ents, votes, p] = await Promise.all([
          challengeApi.getChallenge(id),
          challengeApi.listEntries(id, { sort: '-community_votes' }).catch(() => []),
          challengeApi.getChallengeVotes(id).catch(() => null),
          getPanelForCompetition(id).catch(() => null),
        ]);
        if (cancelled) return;

        // Fallback: try the local Challenge entity (for subdomain-mapped
        // challenges that may not be in the external API or may have a
        // lifecycle_status that challengeApi.getChallenge filters out).
        let ch = fetched;
        if (!ch) {
          try { ch = await base44.entities.Challenge.get(id); } catch { /* not found locally either */ }
          if (cancelled) return;
        }

        setChallenge(ch);
        setEntries(ents || []);
        const counts = votes?.counts || {};
        const live = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
        setVoteCounts(counts);
        setTotalVotes(live || (ents || []).reduce((a, e) => a + (e.vote_count || e.community_votes || 0), 0));
        setPanel(p);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Could not load this challenge.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (leaving) return <div className="container-tight py-24 text-center text-muted-foreground">Taking you to the challenge…</div>;
  if (loading) return <div className="container-tight py-24 text-center text-muted-foreground">Loading challenge…</div>;
  if (error) return <div className="container-tight py-24 text-center text-destructive">{error}</div>;
  if (!challenge) return (
    <div className="container-tight py-24 text-center">
      <p className="text-muted-foreground">Challenge not found.</p>
      <Link to="/challenges" className="mt-4 inline-block text-primary hover:underline">← Back to challenges</Link>
    </div>
  );

  const intro = { ...(challenge.intro || {}), ...(introContentFor(challenge.id) || {}) };
  const accent = accentFor(intro.accent);
  const baseCat = categoryMeta(challenge.category);
  // Prefer the category name the API returns over the local slug map.
  const cat = { ...baseCat, name: challenge.category_label || baseCat.name };
  const body = intro.body || challenge.brief || '';
  const phase = challengePhase(challenge);
  const status = STATUS[phase] || STATUS.submit;
  const deadline = phase === 'vote' ? challenge.voting_ends_at : challenge.submission_ends_at;
  const entriesCount = entries.length;
  const fee = Number(challenge.entry_fee) || 0;

  const rawPrize = intro.prize || challenge.prize_summary || challenge.prize || challenge.prize_pool || challenge.prize_amount;
  const prize = rawPrize
    ? (typeof rawPrize === 'number' || /^\d+(\.\d+)?$/.test(String(rawPrize)) ? `$${rawPrize}` : String(rawPrize))
    : 'To be announced';

  // Divisions from the challenge itself, or from the divisions entrants
  // actually competed in when the challenge doesn't declare them.
  const divisionNames = challenge.divisions?.length
    ? challenge.divisions.map(prettify)
    : [...new Set(entries.map((e) => e.division_name).filter(Boolean))];
  const audience = divisionNames.join(' · ');

  const requirements = intro.requirements?.length
    ? intro.requirements
    : [
        deadline ? `Submit by ${fmtDate(deadline)}` : null,
        audience ? `Open to ${audience}` : null,
        fee > 0 ? `Entry fee of $${fee} applies` : 'Free to enter',
        entriesCount ? `${entriesCount} entries received so far` : null,
      ].filter(Boolean);

  const primaryCta = phase === 'closed'
    ? { to: `/challenges/${challenge.id}/vote`, label: status.primary }
    : challenge.compliance_blocked
      ? null
      : phase === 'submit'
        ? { to: `/challenges/${challenge.id}/submit`, label: intro.cta_participate_label || status.primary }
        : { to: `/challenges/${challenge.id}/vote`, label: status.primary };
  const secondaryCta = challenge.compliance_blocked
    ? null
    : (phase === 'submit' && entriesCount > 0
      ? { to: `/challenges/${challenge.id}/vote`, label: intro.cta_vote_label || 'View & Vote' }
      : null);

  const snapshot = [
    { key: 'prize', label: 'Prize', value: prize, hint: 'Winner prize' },
    { key: 'who', label: 'Who Can Enter', value: audience || 'All divisions', hint: 'Divisions' },
    { key: 'deadline', label: 'Deadline', value: deadline ? fmtDate(deadline) : 'To be announced', hint: phase === 'vote' ? 'Voting closes' : 'Entries close' },
    { key: 'entry', label: 'Entry Type', value: fee > 0 ? `$${fee}` : 'Free', hint: fee > 0 ? 'Entry fee' : 'No entry fee' },
  ];

  return (
    <div className="pb-20">
      <IntroHero
        challenge={challenge}
        intro={intro}
        accent={accent}
        cat={cat}
        entriesCount={entriesCount}
        totalVotes={totalVotes}
        statusLabel={status.label}
        deadline={deadline}
        prize={prize}
        audience={audience}
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        phase={phase}
      />

      {challenge.compliance_blocked && phase !== 'closed' && (
        <div className="container-tight mt-6">
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm font-semibold text-amber-300">
            Entries &amp; voting are paused for this challenge pending review.
          </div>
        </div>
      )}

      <IntroSnapshotRow items={snapshot} />

      <div className="container-tight mt-6 grid gap-4 lg:grid-cols-2">
        <IntroMission body={body} requirements={requirements} />
        <IntroHowItWorks />
      </div>

      <div className="container-tight mt-6">
        <IntroLatestEntries
          challengeId={challenge.id}
          entries={entries.slice(0, 5).map((e) => ({ ...e, vote_count: voteCounts[e.id] ?? e.vote_count ?? 0 }))}
        />
      </div>

      {intro.video_url && (
        <div className="container-tight mt-6 max-w-3xl">
          <IntroVideo url={intro.video_url} />
        </div>
      )}

      {intro.highlights?.length > 0 && (
        <div className="container-tight mt-10">
          <h2 className="mb-6 font-heading text-2xl font-bold">Highlights</h2>
          <IntroHighlights highlights={intro.highlights} accent={accent} />
        </div>
      )}

      {intro.gallery?.length > 0 && (
        <div className="container-tight mt-10">
          <h2 className="mb-6 font-heading text-2xl font-bold">Inspiration gallery</h2>
          <IntroGallery gallery={intro.gallery} />
        </div>
      )}

      <div className="container-tight mt-6">
        <IntroWinnerAndShare
          challengeId={challenge.id}
          title={challenge.theme || challenge.title}
          judgeWeight={panel ? Math.round((panel.judge_weight ?? 0) * 100) : null}
          publicWeight={panel ? Math.round((panel.public_weight ?? 0) * 100) : null}
        />
      </div>
    </div>
  );
}