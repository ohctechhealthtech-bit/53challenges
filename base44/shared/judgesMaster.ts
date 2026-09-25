/**
 * Judges Master API helper — shared by backend functions.
 * Reads/writes the external judges master (options, list, upsert, set_active).
 */
const DEFAULT_BASE = "https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/judgesMasterApi";

export function judgesMasterBase(publicBase) {
  if (!publicBase) return DEFAULT_BASE;
  return publicBase.replace(/publicChallengeApi\/?$/, "judgesMasterApi");
}

const GET_PARAMS = ["active", "level", "discipline", "limit", "skip", "id", "email"];

export async function judgesMasterGet(action, params, apiKey, base) {
  if (!apiKey) throw new Error("CHALLENGE_API_KEY secret not set");
  const qs = new URLSearchParams({ action });
  for (const k of GET_PARAMS) {
    const v = params?.[k];
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const res = await fetch(`${base}?${qs.toString()}`, { headers: { "x-api-key": apiKey } });
  return res.json();
}

export async function judgesMasterPost(body, apiKey, base) {
  if (!apiKey) throw new Error("CHALLENGE_API_KEY secret not set");
  const res = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Saves each host-nominated judge into the master and returns their ids. */
export async function upsertHostJudges(judges, apiKey, base) {
  const saved = [];
  for (const j of judges || []) {
    const name = (j.name || "").trim();
    const email = (j.email || "").trim().toLowerCase();
    if (!name || !email.includes("@")) continue;
    const out = await judgesMasterPost(
      {
        action: "upsert",
        name,
        email,
        disciplines: j.disciplines || (j.expertise ? [j.expertise] : []),
        level: j.level || "state",
        active: true,
      },
      apiKey,
      base,
    );
    if (out?.judge?.id) {
      saved.push({ id: out.judge.id, name: out.judge.name, email: out.judge.email, created: !!out.created });
    }
  }
  return saved;
}