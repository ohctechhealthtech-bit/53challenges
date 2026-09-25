import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const isAdmin = user.role === "admin" || user.role === "creator" || user.is_admin === true;
    if (!isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const challengeId = body.challenge_id || null;

    // Scores + assignments are needed for both platform-wide and scoped views.
    const [scores, assigns] = await Promise.all([
      base44.asServiceRole.entities.Score.list("-created_date", 10000),
      base44.asServiceRole.entities.EntryJudgeAssignment.list("-created_date", 10000),
    ]);

    // ── Scoped report for a single challenge ──
    if (challengeId) {
      let challenge = null;
      let entries = [];
      try {
        const chRes = await base44.functions.invoke("challengeApi", { action: "challenges" });
        const allCh = chRes?.data?.challenges || chRes?.challenges || [];
        challenge = (allCh || []).find((c) => String(c.id) === String(challengeId)) || null;
      } catch (e) {}
      try {
        const eRes = await base44.functions.invoke("challengeApi", { action: "entries", challenge_id: challengeId, limit: 500 });
        entries = eRes?.data?.entries || eRes?.entries || [];
      } catch (e) {}

      const byState = {};
      (entries || []).forEach((e) => { const s = e.state || "Unknown"; byState[s] = (byState[s] || 0) + 1; });
      const entriesByState = Object.entries(byState).map(([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count);

      let pending = 0, approved = 0, rejected = 0;
      (entries || []).forEach((e) => {
        const st = e.status || "pending";
        if (st === "approved") approved++;
        else if (st === "rejected") rejected++;
        else pending++;
      });
      const moderation = { pending, approved, rejected, avgPendingAgeDays: 0 };

      const creatorEmails = new Set();
      (entries || []).forEach((e) => { if (e.creator_email) creatorEmails.add(String(e.creator_email).toLowerCase()); });

      const entryIds = new Set((entries || []).map((e) => String(e.id)));
      const assignMap = {};
      (assigns || []).forEach((a) => { assignMap[`${a.panel_id}|${a.entry_id}|${a.judge_profile_id}`] = a.assigned_at; });
      const byJudge = {};
      const perEntryTotals = {};
      (scores || []).forEach((s) => {
        if (!entryIds.has(String(s.entry_id))) return;
        const id = s.judge_profile_id;
        if (!byJudge[id]) byJudge[id] = { judge: s.judge_name || id, scored: 0, turnSumMs: 0, turnCount: 0 };
        byJudge[id].scored++;
        const assignedAt = assignMap[`${s.panel_id}|${s.entry_id}|${id}`];
        if (assignedAt && s.submitted_at) {
          const ms = new Date(s.submitted_at).getTime() - new Date(assignedAt).getTime();
          if (ms >= 0) { byJudge[id].turnSumMs += ms; byJudge[id].turnCount++; }
        }
        const total = (s.scores || []).reduce((a, x) => a + (x.value || 0), 0);
        if (!perEntryTotals[s.entry_id]) perEntryTotals[s.entry_id] = [];
        perEntryTotals[s.entry_id].push(total);
      });
      const judgeRows = Object.values(byJudge).map((j) => ({ judge: j.judge, scored: j.scored, avgTurnaroundHours: j.turnCount ? Math.round((j.turnSumMs / j.turnCount) / 3600000 * 10) / 10 : null })).sort((a, b) => b.scored - a.scored);
      let consSum = 0, consCount = 0;
      Object.values(perEntryTotals).forEach((arr) => {
        if (arr.length > 1) {
          const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
          const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
          consSum += Math.sqrt(variance); consCount++;
        }
      });
      const consistency = consCount ? Math.round((consSum / consCount) * 100) / 100 : null;
      const totalVotes = (entries || []).reduce((a, e) => a + (e.community_votes || e.vote_count || 0), 0);

      return Response.json({
        scoped: true,
        challenge: { id: challenge?.id || challengeId, title: challenge?.theme || challenge?.title || "Selected challenge" },
        summary: { competitions: 1, totalEntries: (entries || []).length, users: 0, creators: creatorEmails.size, conversionRate: 0 },
        entriesByCompetition: [{ id: challenge?.id || challengeId, title: challenge?.theme || challenge?.title || "Selected challenge", count: challenge?.total_entries ?? (entries || []).length, votes: challenge?.total_votes ?? totalVotes }],
        entriesByState,
        moderation,
        judges: judgeRows,
        consistency,
        totalVotes,
        entries: (entries || []).map((e) => ({
          id: e.id,
          title: e.title || e.work_title || "Untitled",
          creator_name: e.creator_name || "",
          state: e.state || "",
          category: e.category || "",
          division: e.division || "",
          status: e.status || "pending",
          vote_count: e.community_votes || e.vote_count || 0,
          submitted_at: e.submitted_at || "",
        })),
      });
    }

    const [audience, campaigns, inquiries, users] = await Promise.all([
      base44.asServiceRole.entities.AudienceMember.list("-created_date", 10000),
      base44.asServiceRole.entities.EmailCampaign.list("-created_date", 500),
      base44.asServiceRole.entities.PartnerInquiry.list("-created_date", 10000),
      base44.asServiceRole.entities.User.list("-created_date", 10000),
    ]);

    // Challenges + entries (capped to recent 12 to bound runtime)
    let challenges = [];
    try {
      const chRes = await base44.functions.invoke("challengeApi", { action: "challenges" });
      challenges = chRes?.data?.challenges || chRes?.challenges || [];
    } catch (e) {}
    const scoped = (challenges || []).slice(0, 12);
    const entryResults = await Promise.all((scoped || []).map((c) =>
      base44.functions.invoke("challengeApi", { action: "entries", challenge_id: c.id, limit: 500 })
        .then((r) => ({ id: c.id, entries: r?.data?.entries || r?.entries || [] }))
        .catch(() => ({ id: c.id, entries: [] }))
    ));
    const entryMap = {};
    let allEntries = [];
    entryResults.forEach((er) => { entryMap[er.id] = er.entries; allEntries = allEntries.concat(er.entries); });

    const entriesByCompetition = (scoped || []).map((c) => {
      const ents = entryMap[c.id] || [];
      return {
        id: c.id, title: c.theme || c.title || "Untitled",
        count: c.total_entries ?? ents.length,
        votes: c.total_votes ?? ents.reduce((a, e) => a + (e.community_votes || e.vote_count || 0), 0),
      };
    }).sort((a, b) => b.count - a.count).slice(0, 12);

    const byState = {};
    (allEntries || []).forEach((e) => { const s = e.state || "Unknown"; byState[s] = (byState[s] || 0) + 1; });
    const entriesByState = Object.entries(byState).map(([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count);

    const creatorEmails = new Set();
    (allEntries || []).forEach((e) => { if (e.creator_email) creatorEmails.add(String(e.creator_email).toLowerCase()); });
    const totalUsers = (users || []).length;
    const conversionRate = totalUsers ? Math.round((creatorEmails.size / totalUsers) * 1000) / 10 : 0;

    let pending = 0, approved = 0, rejected = 0, pendingAgeSum = 0, pendingAgeCount = 0;
    (allEntries || []).forEach((e) => {
      const st = e.status || "pending";
      if (st === "approved") approved++;
      else if (st === "rejected") rejected++;
      else { pending++; if (e.submitted_at) { const days = (Date.now() - new Date(e.submitted_at).getTime()) / 86400000; if (days >= 0) { pendingAgeSum += days; pendingAgeCount++; } } }
    });
    const moderation = { pending, approved, rejected, avgPendingAgeDays: pendingAgeCount ? Math.round((pendingAgeSum / pendingAgeCount) * 10) / 10 : 0 };

    const audByType = {}, audByState = {}, audBySource = {}, audByCat = {};
    let audTotal = 0, audActive = 0;
    (audience || []).forEach((m) => {
      audTotal++; if (m.status === "active") audActive++;
      audByType[m.audience_type] = (audByType[m.audience_type] || 0) + 1;
      if (m.state) audByState[m.state] = (audByState[m.state] || 0) + 1;
      audBySource[m.source] = (audBySource[m.source] || 0) + 1;
      (m.category_interests || []).forEach((c) => { audByCat[c] = (audByCat[c] || 0) + 1; });
    });
    const toArr = (o) => Object.entries(o).map(([k, v]) => ({ label: k, count: v })).sort((a, b) => b.count - a.count);
    const audienceStats = { total: audTotal, active: audActive, unsubscribed: audTotal - audActive, byType: toArr(audByType), byState: toArr(audByState), bySource: toArr(audBySource), byCategory: toArr(audByCat).slice(0, 8) };

    const campaignRows = (campaigns || []).map((c) => ({ id: c.id, name: c.name, type: c.type, status: c.status, sent: c.sent_count || 0, skipped: c.skipped_unregistered || 0, audience: c.audience_count || 0 }));

    const assignMap = {};
    (assigns || []).forEach((a) => { assignMap[`${a.panel_id}|${a.entry_id}|${a.judge_profile_id}`] = a.assigned_at; });
    const byJudge = {};
    const perEntryTotals = {};
    (scores || []).forEach((s) => {
      const id = s.judge_profile_id;
      if (!byJudge[id]) byJudge[id] = { judge: s.judge_name || id, scored: 0, turnSumMs: 0, turnCount: 0 };
      byJudge[id].scored++;
      const assignedAt = assignMap[`${s.panel_id}|${s.entry_id}|${id}`];
      if (assignedAt && s.submitted_at) {
        const ms = new Date(s.submitted_at).getTime() - new Date(assignedAt).getTime();
        if (ms >= 0) { byJudge[id].turnSumMs += ms; byJudge[id].turnCount++; }
      }
      const total = (s.scores || []).reduce((a, x) => a + (x.value || 0), 0);
      if (!perEntryTotals[s.entry_id]) perEntryTotals[s.entry_id] = [];
      perEntryTotals[s.entry_id].push(total);
    });
    const judgeRows = Object.values(byJudge).map((j) => ({ judge: j.judge, scored: j.scored, avgTurnaroundHours: j.turnCount ? Math.round((j.turnSumMs / j.turnCount) / 3600000 * 10) / 10 : null })).sort((a, b) => b.scored - a.scored);
    let consSum = 0, consCount = 0;
    Object.values(perEntryTotals).forEach((arr) => {
      if (arr.length > 1) {
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
        consSum += Math.sqrt(variance); consCount++;
      }
    });
    const consistency = consCount ? Math.round((consSum / consCount) * 100) / 100 : null;

    const pipeBy = {};
    (inquiries || []).forEach((i) => { const s = i.pipeline_status || "new"; pipeBy[s] = (pipeBy[s] || 0) + 1; });
    const pipeline = ["new", "in_discussion", "confirmed", "live"].map((s) => ({ status: s, count: pipeBy[s] || 0 }));

    return Response.json({
      summary: { competitions: (challenges || []).length, totalEntries: (allEntries || []).length, users: totalUsers, creators: creatorEmails.size, conversionRate },
      entriesByCompetition,
      entriesByState,
      moderation,
      audience: audienceStats,
      campaigns: campaignRows,
      judges: judgeRows,
      consistency,
      pipeline,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}