import { useMemo } from 'react';
import { Trophy, MapPin, Crown } from 'lucide-react';
import { computeStateNationalBoards } from '@/lib/pathways';

// Unified standings/leaderboards display for a pathway.
// - series_championship → season points table + champion
// - national_state_ranking → national leaderboard + per-state leaderboards + state title-holders
export default function PathwayStandings({ pathway, entries, standings }) {
  const boards = useMemo(() => computeStateNationalBoards(entries || []), [entries]);
  if (!pathway) return null;

  if (pathway.type === 'series_championship') {
    const rows = standings || [];
    const champion = rows[0];
    return (
      <div className="space-y-3">
        {champion && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
            <Crown className="h-7 w-7 text-amber-400" />
            <div>
              <p className="font-heading text-lg font-bold text-amber-300">Series champion: {champion.creator_name}</p>
              <p className="text-xs text-muted-foreground">{champion.total_points} pts across {champion.events_counted} events</p>
            </div>
          </div>
        )}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <ol className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id || r.rank} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold ${r.rank <= 3 ? 'grad-bg text-white' : 'bg-muted text-muted-foreground'}`}>{r.rank}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.creator_name}</p>
                    <p className="text-xs text-muted-foreground">{r.events_counted} events · best placing {r.best_placing || '—'}</p>
                  </div>
                </div>
                <span className="font-heading text-lg font-extrabold text-primary">{r.total_points}<span className="ml-1 text-xs font-normal text-muted-foreground">pts</span></span>
              </li>
            ))}
            {!rows.length && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No standings computed yet.</li>}
          </ol>
        </div>
      </div>
    );
  }

  if (pathway.type === 'national_state_ranking') {
    const { national, stateBoards, titleHolders } = boards;
    return (
      <div className="space-y-4">
        {/* State title-holders */}
        {titleHolders.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 font-heading text-sm font-bold"><MapPin className="h-4 w-4 text-primary" /> State title-holders</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {titleHolders.map((t) => (
                <div key={t.state} className="rounded-xl border border-border bg-card p-3">
                  <p className="text-xs font-bold uppercase text-primary">{t.state}</p>
                  <p className="mt-1 truncate text-sm font-semibold">{t.entry.title || 'Untitled'}</p>
                  <p className="text-xs text-muted-foreground">{t.entry.creator_name || ''}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <Board title="National leaderboard" icon={<Trophy className="h-4 w-4 text-amber-400" />} rows={national.slice(0, 20)} />
          {stateBoards.map((b) => (
            <Board key={b.state} title={`${b.state} leaderboard`} icon={<MapPin className="h-4 w-4 text-primary" />} rows={b.rows.slice(0, 10)} accent />
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function Board({ title, icon, rows, accent }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h4 className="flex items-center gap-2 font-heading text-sm font-bold">{icon} {title}</h4>
      <ol className="mt-2 divide-y divide-border/60">
        {rows.map((e, i) => {
          const v = e.community_votes ?? e.vote_count ?? 0;
          return (
            <li key={e.id || i} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-extrabold ${i < 3 ? 'grad-bg text-white' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{e.title || 'Untitled'}</p>
                  <p className="text-xs text-muted-foreground">{e.creator_name || ''}</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-muted-foreground">{v} votes</span>
            </li>
          );
        })}
        {!rows.length && <li className="py-4 text-center text-xs text-muted-foreground">No entries yet.</li>}
      </ol>
    </div>
  );
}