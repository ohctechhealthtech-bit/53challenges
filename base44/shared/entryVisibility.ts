// Visibility rule for a challenge's entry list: unmoderated (pending) and
// rejected entries are admin-only — the public list is approved entries only.
// Kids/teens / minors stay hidden until guardian_approval_status is approved.
export function entryListQuery(challenge_id, isAdmin) {
  const query: Record<string, unknown> = { challenge_id: String(challenge_id) };
  if (!isAdmin) query.status = "approved";
  return query;
}

export function isPubliclyListableEntry(entry) {
  if (!entry) return false;
  const kids = entry.is_minor === true ||
    ["children", "teens"].includes(String(entry.division || entry.division_name || "").toLowerCase());
  if (kids && String(entry.guardian_approval_status || "") !== "approved") return false;
  return true;
}
