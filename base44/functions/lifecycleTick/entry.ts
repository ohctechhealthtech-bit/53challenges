import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { passGate, evaluateGate, logGateEvaluation } from "../../shared/lifecycleGateHelper.ts";

// Time-driven lifecycle advancement for native challenges.
//
//   published    → entry_open   once starts_at is reached (gate must pass)
//   entry_open   → voting_open  once submission_ends_at has passed (gate must pass)
//   voting_open  → closed       once voting_ends_at has passed
//
// Gate conditions are still authoritative — this only attempts the transition
// when the schedule says it is due; a challenge with unmet conditions stays put.

const actor = { id: "", email: "system" };

function toChallengeData(c) {
  return {
    id: c.id,
    theme: c.theme || c.title || "",
    title: c.title || c.theme || "",
    category: c.category || "",
    brief: c.brief || "",
    starts_at: c.starts_at,
    submission_ends_at: c.submission_ends_at,
    voting_ends_at: c.voting_ends_at,
  };
}

const due = (v) => !!v && new Date(v).getTime() <= Date.now();

export default async function (req) {
  try {
    const sr = createClientFromRequest(req).asServiceRole;
    const challenges = await sr.entities.Challenge.filter(
      { source: "native", lifecycle_status: { $in: ["published", "entry_open", "voting_open"] } },
      "-created_date", 500
    );

    const advanced = [];
    for (const c of challenges || []) {
      // Voting finished — close it out.
      if (c.lifecycle_status === "voting_open") {
        if (due(c.voting_ends_at)) {
          await sr.entities.Challenge.update(c.id, { lifecycle_status: "closed" });
          advanced.push({ id: c.id, to: "closed" });
        }
        continue;
      }

      let gate_code = null;
      if (c.lifecycle_status === "published" && due(c.starts_at)) gate_code = "entry_open";
      if (c.lifecycle_status === "entry_open" && due(c.submission_ends_at)) gate_code = "voting_open";
      if (!gate_code) continue;

      const challengeData = toChallengeData(c);
      const evalResult = await evaluateGate(sr, c.id, gate_code, challengeData);
      await logGateEvaluation(sr, c.id, gate_code, evalResult, actor);
      const result = await passGate(sr, c.id, gate_code, actor, { challengeData });
      if (!result.passed) continue;

      await sr.entities.Challenge.update(c.id, { lifecycle_status: gate_code });
      advanced.push({ id: c.id, to: gate_code });
    }

    return Response.json({ ok: true, checked: (challenges || []).length, advanced });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}