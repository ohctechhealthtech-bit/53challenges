// The ONE server-side source of every "waiting for the admin" queue.
//
// Both the dashboard tiles and the "waiting the longest" list read this, and
// the content-approval queue itself uses pendingEntries() below — so a count
// can never disagree with the list it links to.
import { ideaApiGet, fromIdeaRecord } from "./hostIdeas.ts";

/** Entries awaiting content approval (shared with the content queue). */
export async function pendingEntries(sr, challengeIds = null) {
  if (challengeIds === null) {
    return (await sr.entities.Entry.filter({ status: "pending" }, "-created_date", 200).catch(() => [])) || [];
  }
  const out = [];
  for (const id of challengeIds) {
    const rows = await sr.entities.Entry.filter(
      { challenge_id: id, status: "pending" }, "-created_date", 200
    ).catch(() => []);
    out.push(...(rows || []));
  }
  return out;
}

const item = (id, name, since, note = "") => ({ id: String(id || ""), name: name || "Untitled", since: since || "", note });

/** Every admin queue, each with its own items — counts are always items.length. */
export async function buildAdminQueues(sr) {
  const [entries, drafts, inquiries, judges, sponsors, findings, messages, ideas] = await Promise.all([
    pendingEntries(sr),
    sr.entities.ChallengeDraft.filter({ review_status: "submitted_for_review" }, "-created_date", 200).catch(() => []),
    sr.entities.PartnerInquiry.filter({ status: "new" }, "-created_date", 200).catch(() => []),
    sr.entities.JudgeProfile.filter({ status: "applicant" }, "-created_date", 200).catch(() => []),
    sr.entities.SponsorProfile.filter({ status: "pending" }, "-created_date", 200).catch(() => []),
    sr.entities.ComplianceAssessmentFinding.filter({ status: "open", blocking: true }, "-created_date", 200).catch(() => []),
    sr.entities.Message.filter({ sender: "user", read: false }, "-created_date", 200).catch(() => []),
    ideaApiGet({ action: "ideas", limit: "200" }).then((r) => (r?.ideas || r?.requests || []).map(fromIdeaRecord)).catch(() => []),
  ]);

  const newIdeas = (ideas || []).filter((i) => (i.review_status || "new") === "new");
  const liveDrafts = (drafts || []).filter((d) => d.is_template !== true);

  return [
    {
      key: "content",
      label: "Entries to approve",
      hint: "Nothing is publicly visible until it's approved.",
      link: "/dashboard?tab=content",
      items: entries.map((e) => item(e.id, e.title, e.submitted_at || e.created_date, e.challenge_title || "")),
    },
    {
      key: "ideas",
      label: "New challenge ideas",
      hint: "Sent in through “Tell us your idea”.",
      link: "/dashboard?tab=hostrequests&sub=ideas",
      items: newIdeas.map((i) => item(i.id, i.challenge_title || i.answers?.organisation_name, i.created_date, i.answers?.organisation_name || "")),
    },
    {
      key: "proposals",
      label: "Challenge applications",
      hint: "Host applications waiting for your approval.",
      link: "/dashboard?tab=hostrequests&sub=host",
      items: liveDrafts.map((d) => item(d.id, d.challenge_title, d.created_date, d.host_type || "")),
    },
    {
      key: "enquiries",
      label: "Host enquiries",
      hint: "Organisations asking about running a challenge.",
      link: "/dashboard?tab=partnerships",
      items: (inquiries || []).map((p) => item(p.id, p.company_name, p.created_date, p.challenge_title || "")),
    },
    {
      key: "judges",
      label: "Judge applications",
      hint: "People applying to join the judging panel.",
      link: "/dashboard?tab=judges",
      items: (judges || []).map((j) => item(j.id, j.name, j.created_date, j.state || "")),
    },
    {
      key: "sponsors",
      label: "Sponsor applications",
      hint: "Sponsors waiting to be activated.",
      link: "/marketing",
      items: (sponsors || []).map((s) => item(s.id, s.name, s.created_date, s.organisation || "")),
    },
    {
      key: "compliance",
      label: "Blocked compliance items",
      hint: "These stop a challenge from moving forward.",
      link: "/compliance-gate",
      items: (findings || []).map((f) => item(f.id, f.rule_code || f.obligation_type || "Compliance item", f.created_date, f.gate || "")),
    },
    {
      key: "messages",
      label: "Unread messages",
      hint: "Participants waiting on a reply.",
      link: "/dashboard?tab=messages",
      items: (messages || []).map((m) => item(m.id, m.participant_name || m.participant_email || "Participant", m.created_date, m.subject || "")),
    },
  ].map((q) => ({ ...q, count: q.items.length }));
}