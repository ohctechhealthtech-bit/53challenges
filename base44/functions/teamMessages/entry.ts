import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Team-side message workflow.
 *
 * Admin actions (threads / thread / reply) run under the service role so the
 * team can read every participant's thread — admin pages must never read the
 * Message entity directly from the client.
 * Participant actions (my_unread / mark_read) are scoped to the caller's own
 * email.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const sr = base44.asServiceRole;
    const isAdmin = user.role === "admin" || user.is_admin === true;
    const adminOnly = () => Response.json({ error: "Admin only" }, { status: 403 });

    // ── Participant: unread team replies addressed to me ───────────────
    if (action === "my_unread") {
      const mine = await sr.entities.Message.filter(
        { participant_email: user.email, sender: "team", read: false }, "-created_date", 200
      ).catch(() => []);
      return Response.json({ unread: (mine || []).length });
    }

    // ── Participant: mark the team's replies to me as read ─────────────
    if (action === "mark_read") {
      const mine = await sr.entities.Message.filter(
        { participant_email: user.email, sender: "team", read: false }, "-created_date", 200
      ).catch(() => []);
      if ((mine || []).length) {
        await sr.entities.Message.bulkUpdate(mine.map((m) => ({ id: m.id, read: true })));
      }
      return Response.json({ ok: true, marked: (mine || []).length });
    }

    // ── Team: every thread, newest activity first ───────────────────────
    if (action === "threads") {
      if (!isAdmin) return adminOnly();
      const all = await sr.entities.Message.list("-created_date", 500).catch(() => []);
      const threads = new Map();
      for (const m of all || []) {
        const email = m.participant_email || "";
        if (!email) continue; // legacy message with no participant — skip
        if (!threads.has(email)) {
          threads.set(email, {
            participant_email: email,
            participant_name: m.participant_name || "",
            last_body: m.body || "",
            last_sender: m.sender || "user",
            last_at: m.created_date,
            unread: 0,
            total: 0,
          });
        }
        const t = threads.get(email);
        t.total += 1;
        if (!t.participant_name && m.participant_name) t.participant_name = m.participant_name;
        if (m.sender === "user" && m.read === false) t.unread += 1;
      }
      const list = Array.from(threads.values());
      return Response.json({
        threads: list,
        unread_total: list.reduce((a, t) => a + t.unread, 0),
      });
    }

    // ── Team: one participant's full thread (marks their messages read) ─
    if (action === "thread") {
      if (!isAdmin) return adminOnly();
      const email = String(body.participant_email || "");
      if (!email) return Response.json({ error: "participant_email required" }, { status: 400 });
      const messages = await sr.entities.Message.filter(
        { participant_email: email }, "created_date", 300
      ).catch(() => []);
      const unread = (messages || []).filter((m) => m.sender === "user" && m.read === false);
      if (unread.length) {
        await sr.entities.Message.bulkUpdate(unread.map((m) => ({ id: m.id, read: true })));
      }
      return Response.json({ messages: messages || [] });
    }

    // ── Team: reply into a participant's thread ─────────────────────────
    if (action === "reply") {
      if (!isAdmin) return adminOnly();
      const email = String(body.participant_email || "");
      const text = String(body.body || "").trim();
      if (!email || !text) {
        return Response.json({ error: "participant_email and body are required" }, { status: 400 });
      }
      const message = await sr.entities.Message.create({
        body: text,
        sender: "team",
        participant_email: email,
        participant_name: String(body.participant_name || ""),
        read: false,
      });
      return Response.json({ ok: true, message });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}