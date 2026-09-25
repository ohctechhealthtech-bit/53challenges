import { Download, FileText, Sparkles, Clock, CheckCircle, XCircle, Heart } from 'lucide-react';
import { downloadCSV } from '@/lib/csv';
import CompetitionPanel from '@/components/reporting/CompetitionPanel';
import ModerationPanel from '@/components/reporting/ModerationPanel';
import JudgePanel from '@/components/reporting/JudgePanel';

function slug(s) {
  return (s || 'challenge').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'challenge';
}

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

export default function ChallengeReportView({ report }) {
  const nameSlug = slug(report.challenge?.title);

  const exportSummary = () => {
    const rows = [];
    rows.push(['Challenge Report']);
    rows.push(['Challenge', report.challenge?.title || '']);
    rows.push(['Total Entries', report.summary?.totalEntries ?? '']);
    rows.push(['Total Votes', report.totalVotes ?? '']);
    rows.push([]);
    rows.push(['Entries by State']);
    rows.push(['State', 'Count']);
    (report.entriesByState || []).forEach((s) => rows.push([s.state, s.count]));
    rows.push([]);
    rows.push(['Moderation Status']);
    rows.push(['Status', 'Count']);
    rows.push(['Pending', report.moderation?.pending ?? 0]);
    rows.push(['Approved', report.moderation?.approved ?? 0]);
    rows.push(['Rejected', report.moderation?.rejected ?? 0]);
    rows.push([]);
    rows.push(['Judge Statistics']);
    rows.push(['Judge', 'Scored', 'Avg Turnaround (hrs)']);
    (report.judges || []).forEach((j) => rows.push([j.judge, j.scored, j.avgTurnaroundHours ?? '']));
    rows.push([]);
    rows.push(['Vote Counts per Entry']);
    rows.push(['Entry Title', 'Votes']);
    (report.entries || []).forEach((e) => rows.push([e.title, e.vote_count]));
    downloadCSV(`report-${nameSlug}.csv`, rows);
  };

  const exportEntries = () => {
    const rows = [['Entry Title', 'Creator Name', 'State', 'Category', 'Division', 'Status', 'Votes', 'Submission Date']];
    (report.entries || []).forEach((e) => {
      rows.push([
        e.title,
        e.creator_name,
        e.state,
        e.category,
        e.division,
        e.status,
        e.vote_count,
        fmtDate(e.submitted_at),
      ]);
    });
    downloadCSV(`entries-${nameSlug}.csv`, rows);
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
        <div>
          <h2 className="font-heading text-xl font-bold">{report.challenge?.title}</h2>
          <p className="text-sm text-muted-foreground">Scoped report — data for this challenge only.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportSummary}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90"
          >
            <Download className="h-4 w-4" /> Export Report (CSV)
          </button>
          <button
            onClick={exportEntries}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold transition hover:bg-muted"
          >
            <Download className="h-4 w-4" /> Export Entries (CSV)
          </button>
        </div>
      </div>

      {/* Scoped stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Stat icon={FileText} label="Total entries" value={report.summary?.totalEntries ?? 0} />
        <Stat icon={Sparkles} label="Creators" value={report.summary?.creators ?? 0} />
        <Stat icon={Clock} label="Pending" value={report.moderation?.pending ?? 0} />
        <Stat icon={CheckCircle} label="Approved" value={report.moderation?.approved ?? 0} />
        <Stat icon={XCircle} label="Rejected" value={report.moderation?.rejected ?? 0} />
        <Stat icon={Heart} label="Total votes" value={report.totalVotes ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CompetitionPanel byCompetition={report.entriesByCompetition} byState={report.entriesByState} />
        <ModerationPanel moderation={report.moderation} />
        <JudgePanel judges={report.judges} consistency={report.consistency} />

        {/* Entries table */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-lg font-bold">Entries</h3>
            <button
              onClick={exportEntries}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
          <div className="mt-3 max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-1">Title</th>
                  <th className="py-1">Creator</th>
                  <th className="py-1">State</th>
                  <th className="py-1">Status</th>
                  <th className="py-1 text-right">Votes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(report.entries || []).map((e) => (
                  <tr key={e.id}>
                    <td className="max-w-[160px] truncate py-2">{e.title}</td>
                    <td className="max-w-[120px] truncate py-2">{e.creator_name}</td>
                    <td className="py-2">{e.state || '—'}</td>
                    <td className="py-2 capitalize">{e.status}</td>
                    <td className="py-2 text-right">{e.vote_count}</td>
                  </tr>
                ))}
                {!report.entries?.length && (
                  <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No entries.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 font-heading text-2xl font-extrabold">{value}</p>
    </div>
  );
}