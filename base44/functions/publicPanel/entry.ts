import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Public, read-only list of the judges and sponsors we can show on the
// "53 Sponsor & Judge" page. Only non-sensitive fields are returned.
const PUBLIC_JUDGE_STATUSES = ['approved', 'active'];

export default async function (req) {
  try {
    const sr = createClientFromRequest(req).asServiceRole;
    const [judges, sponsors] = await Promise.all([
      sr.entities.JudgeProfile.list('-created_date', 200).catch(() => []),
      sr.entities.SponsorProfile.list('-created_date', 100).catch(() => []),
    ]);
    return Response.json({
      judges: (judges || [])
        .filter((j) => PUBLIC_JUDGE_STATUSES.includes(j.status))
        .map((j) => ({
          id: j.id,
          name: j.name || '',
          state: j.state || '',
          categories: (j.approved_categories?.length ? j.approved_categories : j.applied_categories) || [],
          experience: j.experience || '',
        })),
      sponsors: (sponsors || [])
        .filter((s) => s.status === 'active')
        .map((s) => ({
          id: s.id,
          name: s.organisation || s.name || '',
        }))
        .filter((s) => s.name),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}