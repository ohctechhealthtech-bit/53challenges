import { fetchChallengeApi } from "./challengeApiHelper.ts";

// Single source of truth for what an entry actually costs. The fee is ALWAYS
// derived here from the challenge record — never from client input.
// Returns the fee in cents (0 = free challenge).
export async function resolveEntryFeeCents(sr, challengeId, divisionId, apiKey, baseUrl) {
  const id = String(challengeId || "");
  if (!id) return 0;

  // Native challenges (this app's Challenge entity) have no entry fee.
  try {
    const native = await sr.entities.Challenge.get(id);
    if (native && native.source === "native") return 0;
  } catch {
    /* not a native challenge — fall through to the upstream record */
  }

  const data = await fetchChallengeApi("challenges", { id }, apiKey, baseUrl);
  const ch = Array.isArray(data?.challenges) ? data.challenges[0] : data?.challenge;
  if (!ch) throw new Error("Challenge not found");

  const override = (ch.division_fee_overrides || []).find(
    (o) => o.division_id === divisionId || o.division_slug === divisionId
  );
  const fee = Number(override?.amount ?? ch.entry_fee ?? 0) || 0;
  return Math.round(fee * 100);
}