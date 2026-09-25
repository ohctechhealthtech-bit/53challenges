// Season exclusion guard. Returns whether an email is blocked from entering any
// challenge this season. No exclusion source is maintained yet, so every email
// is currently eligible — wire a banned-account entity here when one exists.
export default async function (req) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").toLowerCase().trim();
    if (!email) return Response.json({ blocked: false, reason: null });
    return Response.json({ blocked: false, reason: null, email });
  } catch (error) {
    return Response.json({ blocked: false, reason: null });
  }
}