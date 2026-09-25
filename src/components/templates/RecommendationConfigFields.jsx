/**
 * Controls which hosts this template is recommended to when they answer the
 * intake questions on the host template selector.
 */
export default function RecommendationConfigFields({ template, onChange }) {
  const cfg = template.template_recommendation_config || {};
  const set = (patch) => onChange({ template_recommendation_config: { ...cfg, ...patch } });
  const list = (v) => (Array.isArray(v) ? v.join(', ') : '');
  const toList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm font-bold">Who should this template be recommended to?</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold">Organisation types</span>
          <input className="c53-input mt-1.5" placeholder="school, workplace, club" value={list(cfg.target_organisation_types)} onChange={(e) => set({ target_organisation_types: toList(e.target.value) })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Categories</span>
          <input className="c53-input mt-1.5" placeholder="art, writing" value={list(cfg.target_categories)} onChange={(e) => set({ target_categories: toList(e.target.value) })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Service tiers</span>
          <input className="c53-input mt-1.5" placeholder="standard, professional" value={list(cfg.target_service_tiers)} onChange={(e) => set({ target_service_tiers: toList(e.target.value) })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Audience types</span>
          <input className="c53-input mt-1.5" placeholder="students, staff" value={list(cfg.target_audience_types)} onChange={(e) => set({ target_audience_types: toList(e.target.value) })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Minimum participants</span>
          <input type="number" className="c53-input mt-1.5" value={cfg.min_participant_count ?? ''} onChange={(e) => set({ min_participant_count: e.target.value === '' ? null : Number(e.target.value) })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Maximum participants</span>
          <input type="number" className="c53-input mt-1.5" value={cfg.max_participant_count ?? ''} onChange={(e) => set({ max_participant_count: e.target.value === '' ? null : Number(e.target.value) })} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Priority weight</span>
          <input type="number" min="1" className="c53-input mt-1.5" value={cfg.recommendation_weight ?? 1} onChange={(e) => set({ recommendation_weight: Number(e.target.value) })} />
        </label>
      </div>
    </div>
  );
}