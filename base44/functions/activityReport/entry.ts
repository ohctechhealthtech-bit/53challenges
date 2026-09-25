import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Admin activity report: entry counts per challenge and per category.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const isAdmin = user.role === "admin" || user.is_admin === true;
    if (!isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

    const sr = base44.asServiceRole;
    const [challenges, entries, categories] = await Promise.all([
      sr.entities.Challenge.list("-created_date", 1000),
      sr.entities.Entry.list("-created_date", 20000),
      sr.entities.Category.list("-created_date", 100),
    ]);

    const catName = {};
    (categories || []).forEach((c) => {
      catName[c.id] = c.name;
      if (c.slug) catName[c.slug] = c.name;
    });

    const perChallenge = {};
    (entries || []).forEach((e) => {
      const key = String(e.challenge_id || "");
      if (!perChallenge[key]) perChallenge[key] = { total: 0, pending: 0, approved: 0, rejected: 0 };
      perChallenge[key].total++;
      const st = e.status || "pending";
      perChallenge[key][st === "approved" ? "approved" : st === "rejected" ? "rejected" : "pending"]++;
    });

    const challengeRows = (challenges || []).map((c) => {
      const stats = perChallenge[String(c.id)] || { total: 0, pending: 0, approved: 0, rejected: 0 };
      const cat = catName[c.category_id] || catName[c.category] || c.category || "Uncategorised";
      return {
        id: c.id,
        title: c.title || c.theme || "Untitled",
        category: cat,
        lifecycle_status: c.lifecycle_status || "draft",
        ...stats,
      };
    }).sort((a, b) => b.total - a.total);

    const catAgg = {};
    challengeRows.forEach((r) => {
      if (!catAgg[r.category]) catAgg[r.category] = { category: r.category, challenges: 0, entries: 0 };
      catAgg[r.category].challenges++;
      catAgg[r.category].entries += r.total;
    });
    const categoryRows = Object.values(catAgg)
      .map((c) => ({ ...c, avgPerChallenge: c.challenges ? Math.round((c.entries / c.challenges) * 10) / 10 : 0 }))
      .sort((a, b) => b.entries - a.entries);

    // Today's moderation batches (local-day boundary is fine at UTC granularity here).
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const batchMap = {};
    (entries || []).forEach((e) => {
      if (!e.moderated_at || !e.moderation_batch_id) return;
      if (new Date(e.moderated_at).getTime() < startOfToday.getTime()) return;
      const key = e.moderation_batch_id;
      if (!batchMap[key]) batchMap[key] = { batch_id: key, moderated_at: e.moderated_at, approved: 0, rejected: 0, pending: 0, total: 0 };
      const b = batchMap[key];
      b.total++;
      b[e.status === "approved" ? "approved" : e.status === "rejected" ? "rejected" : "pending"]++;
      if (new Date(e.moderated_at) < new Date(b.moderated_at)) b.moderated_at = e.moderated_at;
    });
    const batches = Object.values(batchMap).sort((a, b) => new Date(b.moderated_at) - new Date(a.moderated_at));

    return Response.json({
      batches,
      totals: {
        challenges: challengeRows.length,
        entries: (entries || []).length,
        challengesWithEntries: challengeRows.filter((r) => r.total > 0).length,
      },
      challenges: challengeRows,
      categories: categoryRows,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}