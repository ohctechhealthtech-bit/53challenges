// Corporate Intake recommendation helper (Prompt 22).
// Pure weighted aggregation over existing taxonomy records — no new records,
// no category-specific code paths, no hard-coded questionnaire content.

export const DIMENSIONS = [
  { key: "mechanic", optionField: "mechanic_ids", entity: "ChallengeMechanic", topN: 3, label: "Mechanics" },
  { key: "category", optionField: "category_ids", entity: "Category", topN: 2, label: "Activity area" },
  { key: "mode", optionField: "mode_ids", entity: "ParticipationMode", topN: 2, label: "Participation mode" },
  { key: "audience", optionField: "audience_ids", entity: "AudienceType", topN: 3, label: "Audience" },
  { key: "scoring", optionField: "scoring_ids", entity: "ScoringModel", topN: 2, label: "Scoring model" },
  { key: "evidence", optionField: "evidence_ids", entity: "EvidenceRequirement", topN: 3, label: "Evidence" },
  { key: "pathway", optionField: "pathway_ids", entity: "CompetitionPathway", topN: 2, label: "Pathway" },
];

// Aggregate option weights into per-dimension ranked record lists.
// `selectedOptions` = the full IntakeAnswerOption records the host chose.
export function aggregateWeights(selectedOptions) {
  const byDimension = {};
  const complianceFlags = new Set();
  let serviceTierId = "";

  for (const opt of selectedOptions) {
    if (opt.compliance_flags) for (const f of opt.compliance_flags) complianceFlags.add(f);
    if (opt.service_tier_id && !serviceTierId) serviceTierId = opt.service_tier_id;
    for (const dim of DIMENSIONS) {
      const ids = opt[dim.optionField] || [];
      if (!ids.length) continue;
      if (!byDimension[dim.key]) byDimension[dim.key] = {};
      for (const id of ids) {
        byDimension[dim.key][id] = (byDimension[dim.key][id] || 0) + (opt.weight || 1);
      }
    }
  }
  return { byDimension, complianceFlags: Array.from(complianceFlags), serviceTierId };
}

// Rank a score map and return top N as [{ id, score }] (names resolved later).
export function topN(scoreMap, n) {
  return Object.entries(scoreMap)
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

// Resolve record names for each dimension's top records and attach to result.
export async function resolveAndBuild(sr, byDimension, selectedOptions, complianceFlags, serviceTierId) {
  const result = {};
  const rationaleParts = [];

  for (const dim of DIMENSIONS) {
    const scoreMap = byDimension[dim.key] || {};
    const top = topN(scoreMap, dim.topN);
    if (!top.length) { result[dim.key] = []; continue; }
    // Fetch names in one query per dimension.
    const records = await sr.entities[dim.entity].list("-created_date", 100).catch(() => []);
    const nameById = {};
    for (const r of records || []) nameById[r.id] = { name: r.name, slug: r.slug || "" };
    const resolved = top.map((t) => ({
      id: t.id,
      name: nameById[t.id]?.name || "(unknown)",
      slug: nameById[t.id]?.slug || "",
      score: t.score,
    }));
    result[dim.key] = resolved;
    if (resolved.length) {
      rationaleParts.push(`${dim.label}: ${resolved.map((r) => r.name).join(", ")}`);
    }
  }

  // Build a plain-language rationale: which answers drove which recommendations.
  const answerDrivers = [];
  for (const opt of selectedOptions) {
    const drives = [];
    for (const dim of DIMENSIONS) {
      const ids = opt[dim.optionField] || [];
      if (ids.length) drives.push(dim.label);
    }
    if (opt.compliance_flags?.length) drives.push(`flags: ${opt.compliance_flags.join(", ")}`);
    if (opt.service_tier_id) drives.push("service tier");
    if (drives.length) answerDrivers.push(`"${opt.label}" → ${drives.join("; ")}`);
  }

  const rationaleSummary = [
    rationaleParts.length ? `Recommended: ${rationaleParts.join(" | ")}.` : "",
    answerDrivers.length ? `Driven by answers: ${answerDrivers.join(" | ")}.` : "",
    complianceFlags.length ? `Compliance flags raised: ${complianceFlags.join(", ")}.` : "",
  ].filter(Boolean).join(" ");

  return { ...result, complianceFlags, rationaleSummary, serviceTierId };
}