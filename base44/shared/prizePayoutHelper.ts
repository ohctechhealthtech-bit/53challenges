// Ownership rule for prize payouts: payee / payment details may only be
// changed by the winner whose entry the payout belongs to, or by an admin
// acting on their behalf.
export function isPlatformAdmin(user) {
  return !!user && (user.role === "admin" || user.is_admin === true);
}

export async function canEditPayoutDetails(sr, payout, user) {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  if (!payout?.entry_id) return false;
  const entry = await sr.entities.Entry.get(String(payout.entry_id)).catch(() => null);
  if (!entry) return false;
  const owner = String(entry.creator_email || "").toLowerCase();
  return !!owner && owner === String(user.email || "").toLowerCase();
}