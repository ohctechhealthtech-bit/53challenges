import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Rocket, Eye, Pencil } from 'lucide-react';
import { hostPortal } from '@/lib/hostPortalClient';
import { toast } from 'sonner';
import SeriesAiAnalyser from './SeriesAiAnalyser';
import ChallengeEditDialog from './ChallengeEditDialog';


// Approved proposals — the admin sees a preview of the draft challenge(s),
// then publishes them live with one click.
export default function GoLiveCard({ proposal: p, org, invoices = [], onRefresh }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [challenges, setChallenges] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editChallenge, setEditChallenge] = useState(null);

  const a = p.answers || {};
  const price = a.main_app_price || {};
  const quote = price.total_price || 0;
  const scope = p.program_scope || a.program_scope || 'single';
  const seriesCount = Number(a.series_count) || 1;
  const isSeries = scope === 'series' || scope === 'annual_program';
  const unpaid = invoices.filter((i) => i.status !== 'paid');
  const paid = unpaid.length === 0 && invoices.length > 0;

  const startDate = a.start_date || '';
  const endDate = a.end_date || '';

  useEffect(() => {
    if (!open || challenges) return;
    let active = true;
    setLoading(true);
    hostPortal('admin_preview_challenges', { proposal_id: p.id })
      .then((res) => { if (active) setChallenges(res.challenges || []); })
      .catch(() => { if (active) setChallenges([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, challenges, p.id]);

  const goLive = async () => {
    setBusy(true); setError('');
    try {
      await hostPortal('admin_decide', { proposal_id: p.id, decision: 'go_live' });
      toast.success('Challenge is now live');
      setOpen(false);
      onRefresh?.();
    } catch (e) {
      setError(e?.message || 'Could not publish');
    } finally { setBusy(false); }
  };

  return (
    <>
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-blue-50/30 shadow-sm">
        <CardContent className="pt-5 pb-5 flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600">
                <Rocket className="w-3.5 h-3.5" />
              </span>
              <p className="font-bold text-slate-900">{p.challenge_title || p.title || 'Untitled'}</p>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
              {org?.name || a.organisation_name || 'Unknown org'}
              {startDate ? ` · ${String(startDate).slice(0, 10)}` : ''}
              {endDate ? ` → ${String(endDate).slice(0, 10)}` : ''}
              {quote ? ` · Quote $${quote} AUD` : ''}
            </p>
            <div className="flex gap-2 mt-2.5 flex-wrap">
              {isSeries && (
                <Badge className="bg-blue-100 text-blue-700 border border-blue-200 text-xs">Series of {seriesCount}</Badge>
              )}
              {paid ? (
                <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs">✓ Paid in full</Badge>
              ) : unpaid.length > 0 ? (
                <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs">{unpaid.length} unpaid invoice(s)</Badge>
              ) : null}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="shrink-0 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-semibold shadow-sm">
            <Eye className="w-4 h-4" /> Preview &amp; publish
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-50 text-slate-900 border-slate-200 shadow-2xl">
          <DialogHeader className="border-b border-slate-200 pb-4">
            <DialogTitle className="text-xl font-bold text-slate-900">
              Challenge Application — {p.challenge_title || 'Untitled'}
            </DialogTitle>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
              {org?.name || a.organisation_name || 'Unknown org'}
              {startDate ? ` · ${String(startDate).slice(0, 10)}` : ''}
              {endDate ? ` → ${String(endDate).slice(0, 10)}` : ''}
              {quote ? ` · Quote $${quote} AUD` : ''}
            </p>
            <div className="flex gap-2 mt-2">
              {isSeries && (
                <Badge className="bg-blue-100 text-blue-700 border border-blue-200 text-xs">Series of {seriesCount}</Badge>
              )}
              {paid ? (
                <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs">✓ Paid in full</Badge>
              ) : unpaid.length > 0 ? (
                <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-xs">Awaiting host payment</Badge>
              ) : null}
            </div>
          </DialogHeader>

          <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-emerald-600" /> Preview before publishing
          </p>

          {challenges?.length > 0 && (
            <SeriesAiAnalyser challenges={challenges} proposal={p} org={org} />
          )}

          {isSeries && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
              <span className="font-semibold">Tip:</span> This is a series of {seriesCount} challenges. Publishing will make all parts live.
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading preview…
            </div>
          ) : !challenges?.length ? (
            <div className="flex flex-col items-center gap-3 py-6 rounded-xl border border-dashed border-slate-300 bg-white">
              <p className="text-sm text-slate-400">No challenges found yet.</p>
              <ChallengeEditDialog
                proposalId={p.id}
                proposalTitle={p.challenge_title}
                onSaved={() => { setChallenges(null); onRefresh?.(); }}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {challenges.map((ch, i) => (
                <div key={ch.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isSeries && (
                      <span className="rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-xs font-semibold shrink-0">Part {i + 1}</span>
                    )}
                    <span className="rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 text-xs font-medium capitalize shrink-0">{ch.status}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{ch.title || ch.theme}</p>
                      <p className="text-xs text-slate-500">
                        {ch.start_date ? String(ch.start_date).slice(0, 10) : 'No start date'}
                        {ch.end_date ? ` → ${String(ch.end_date).slice(0, 10)}` : ''}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditChallenge(ch)} className="shrink-0 text-slate-500 hover:text-slate-900 hover:bg-slate-100">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}

          <DialogFooter className="border-t border-slate-200 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)} className="border-slate-300 text-slate-700">Cancel</Button>
            <Button onClick={goLive} disabled={busy || unpaid.length > 0} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />} Make {isSeries ? 'all ' : ''}live
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChallengeEditDialog
        challenge={editChallenge}
        open={!!editChallenge}
        onOpenChange={(v) => !v && setEditChallenge(null)}
        onSaved={() => { setChallenges(null); onRefresh?.(); }}
      />
    </>
  );
}