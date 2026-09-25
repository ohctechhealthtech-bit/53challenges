import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Prize ledger per competition. Sponsored prize money must be recorded as
// received before the competition opens (enforced when funding_source is
// sponsor/mixed and the competition is already active).
//
// actions:
//   save  — create or update the ledger (admin only).
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, competition_id, ledger_id, data } = body;
    if (!competition_id) return Response.json({ error: 'Missing competition_id' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    const sr = base44.asServiceRole;

    const challenge = await sr.entities.Challenge.get(competition_id).catch(() => null);
    if (!challenge) return Response.json({ error: 'Competition not found' }, { status: 404 });
    const now = new Date().toISOString();

    if (action === 'save') {
      const fs = data?.funding_source || 'platform';
      const isActive = challenge.status === 'active';
      // Sponsored money must be received before the competition opens.
      if (isActive && (fs === 'sponsor' || fs === 'mixed') && !data?.sponsor_received) {
        return Response.json({ error: 'Sponsored prize money must be recorded as received before the competition opens.' }, { status: 409 });
      }
      const placings = (data?.placings || []).sort((a, b) => a.placing - b.placing);
      const payload = {
        competition_id,
        competition_title: challenge.title || challenge.theme || '',
        funding_source: fs,
        sponsor_name: data?.sponsor_name || '',
        sponsor_amount: Number(data?.sponsor_amount) || 0,
        sponsor_received: !!data?.sponsor_received,
        sponsor_received_at: data?.sponsor_received ? (data.sponsor_received_at || now) : '',
        sponsor_received_by: data?.sponsor_received ? user.email : '',
        total_pool: Number(data?.total_pool) || 0,
        currency: data?.currency || 'AUD',
        placings,
        status: 'draft',
      };
      // Status 'confirmed' must be set explicitly.
      if (data?.status === 'confirmed') payload.status = 'confirmed';
      if (payload.status === 'confirmed') {
        payload.confirmed_by = user.email;
        payload.confirmed_at = now;
      }

      let saved;
      if (ledger_id) {
        saved = await sr.entities.PrizeLedger.update(ledger_id, payload);
      } else {
        saved = await sr.entities.PrizeLedger.create(payload);
      }
      return Response.json({ success: true, ledger: saved });
    }

    // Generate PrizePayout rows from confirmed winners (combined results) +
    // the ledger placings. Requires the audit to be signed off so winners are
    // verified before any payout row is created.
    if (action === 'generate_payouts') {
      const ledger = ledger_id
        ? await sr.entities.PrizeLedger.get(ledger_id)
        : (await sr.entities.PrizeLedger.filter({ competition_id }, '-created_date', 5))[0];
      if (!ledger) return Response.json({ error: 'No prize ledger for this competition.' }, { status: 404 });
      const review = (await sr.entities.AuditReview.filter({ competition_id }, '-created_date', 5))[0];
      if (!review || review.status !== 'signed_off') {
        return Response.json({ error: 'Payouts cannot be created until the audit is signed off (winners verified).' }, { status: 409 });
      }
      const results = await sr.entities.CombinedResult.filter({ challenge_id: competition_id }, 'combined_rank', 200);
      if (!results.length) return Response.json({ error: 'No locked results to build payouts from.' }, { status: 404 });

      // Replace any existing payouts for this ledger.
      await sr.entities.PrizePayout.deleteMany({ ledger_id: ledger.id });
      const rows = [];
      for (const p of ledger.placings) {
        const r = results[p.placing - 1];
        if (!r) continue;
        const isMinor = r.is_minor || false;
        rows.push({
          ledger_id: ledger.id,
          competition_id,
          entry_id: r.entry_id,
          placing: p.placing,
          label: p.label || `${ordinal(p.placing)} Place`,
          amount: Number(p.amount) || 0,
          winner_name: r.creator_name || p.winner_name || '',
          is_minor: isMinor,
          payee_type: isMinor ? 'guardian' : 'entrant',
          payee_name: isMinor ? '' : (r.creator_name || ''),
          guardian_name: isMinor ? '' : '',
          status: 'pending',
        });
      }
      const created = rows.length ? await sr.entities.PrizePayout.bulkCreate(rows) : [];
      return Response.json({ success: true, payouts: created });
    }

    return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}