/**
 * Challenge Idea Templates API — the single source of truth for the
 * ready-to-run templates hosts start from in the /host-idea wizard.
 * Nothing about these templates is stored in this app's database.
 */
const BASE = 'https://base44.app/api/apps/69341410f89d26a8fc73a4d1/functions/ideaTemplatesApi';

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': Deno.env.get('CHALLENGE_API_KEY') || '',
  };
}

export async function templatesApiGet(params: Record<string, string>) {
  const res = await fetch(`${BASE}?${new URLSearchParams(params)}`, { headers: headers() });
  return await res.json();
}

export async function templatesApiPost(body: Record<string, unknown>) {
  const res = await fetch(BASE, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  return await res.json();
}

/** Host-safe shape the wizard understands. */
export function toWizardTemplate(t: any) {
  return {
    id: t.id,
    template_name: t.template_name,
    summary: t.summary || '',
    entry_type: t.entry_type || '',
    recommended_duration_weeks: t.recommended_duration_weeks || null,
    category: t.category || '',
    age_groups: Array.isArray(t.age_groups) ? t.age_groups : [],
    rules_expectations: Array.isArray(t.rules_expectations) ? t.rules_expectations : [],
    winner_selection_method: t.winner_selection_method || '',
    entry_limit_per_participant: t.entry_limit_per_participant || null,
    image_url: t.image_url || '',
    status: t.status || 'active',
    sort_order: t.sort_order ?? 0,
  };
}