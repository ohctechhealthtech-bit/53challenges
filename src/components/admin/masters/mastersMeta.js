// Field specs for the Masters & packages editors, mirroring the parent's
// inline editors and dialogs. Types: text, textarea, number, checkbox,
// select, lines (array <-> one item per line).
export const SERVICE_CATEGORIES = ['design', 'legal', 'creative', 'marketing', 'operations', 'reporting'];
export const SERVICE_QUEUES = ['design', 'compliance', 'marketing', 'operations', 'finance'];
export const TEMPLATE_ENTRY_TYPES = ['individual', 'team', 'either'];
export const TEMPLATE_STATUSES = ['active', 'draft', 'archived'];

export const CATEGORY_FIELDS = [
  { name: 'label', label: 'Label', type: 'text', required: true },
  { name: 'key', label: 'Key', type: 'text', hint: 'Left blank on create, the key is derived from the label. Changing a key later is unsafe.' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'image_url', label: 'Image URL', type: 'text' },
  { name: 'is_active', label: 'Active (shown in new forms)', type: 'checkbox' },
  { name: 'sort_order', label: 'Sort order', type: 'number' },
];

export const PACKAGE_FIELDS = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'tagline', label: 'Tagline', type: 'text' },
  { name: 'price', label: 'Price', type: 'text' },
  { name: 'price_note', label: 'Price note', type: 'text' },
  { name: 'audience', label: 'Audience', type: 'text' },
  { name: 'features_intro', label: 'Features intro', type: 'text' },
  { name: 'features', label: 'Features (one per line)', type: 'lines' },
  { name: 'cta', label: 'Button label (CTA)', type: 'text' },
  { name: 'badge', label: 'Badge', type: 'text' },
  { name: 'highlighted', label: 'Highlighted on the packages page', type: 'checkbox' },
  { name: 'is_active', label: 'Active', type: 'checkbox' },
  { name: 'sort_order', label: 'Sort order', type: 'number' },
];

export const SERVICE_FIELDS = [
  { name: 'name', label: 'Name', type: 'text', required: true },
  { name: 'key', label: 'Key', type: 'text' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'price', label: 'Price (AUD)', type: 'number' },
  { name: 'price_note', label: 'Price note', type: 'text' },
  { name: 'category', label: 'Category', type: 'select', options: SERVICE_CATEGORIES },
  { name: 'queue', label: 'Delivery queue', type: 'select', options: SERVICE_QUEUES },
  { name: 'is_active', label: 'Active', type: 'checkbox' },
  { name: 'sort_order', label: 'Sort order', type: 'number' },
];

export const TEMPLATE_FIELDS = [
  { name: 'template_name', label: 'Template name', type: 'text', required: true },
  { name: 'summary', label: 'Summary', type: 'textarea' },
  { name: 'category', label: 'Category key', type: 'text' },
  { name: 'entry_type', label: 'Entry type', type: 'select', options: TEMPLATE_ENTRY_TYPES },
  { name: 'accepted_entry_types', label: 'Accepted entry types (one per line)', type: 'lines' },
  { name: 'recommended_duration_weeks', label: 'Recommended duration (weeks)', type: 'number' },
  { name: 'image_url', label: 'Image URL', type: 'text' },
  { name: 'status', label: 'Status', type: 'select', options: TEMPLATE_STATUSES },
  { name: 'sort_order', label: 'Sort order', type: 'number' },
];

export function pickFields(record, fields) {
  const out = {};
  for (const f of fields) {
    const v = record?.[f.name];
    if (f.type === 'checkbox') out[f.name] = v !== false;
    else if (f.type === 'lines') out[f.name] = Array.isArray(v) ? v.join('\n') : (v || '');
    else if (f.type === 'number') out[f.name] = v ?? '';
    else out[f.name] = v ?? '';
  }
  return out;
}

export function toPayload(values, fields) {
  const out = {};
  for (const f of fields) {
    const v = values[f.name];
    if (f.type === 'checkbox') out[f.name] = !!v;
    else if (f.type === 'lines') out[f.name] = String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);
    else if (f.type === 'number') { if (v !== '' && v !== null) out[f.name] = Number(v); }
    else out[f.name] = v;
  }
  return out;
}