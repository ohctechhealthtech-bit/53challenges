import { base44 } from '@/api/base44Client';

// Live add-on services shown in the host application wizard.
// Returns [{ key, name, description, price, price_note, category, queue, sort_order }]
export async function listHostServices() {
  const res = await base44.functions.invoke('hostServices', { action: 'list' });
  const data = res?.data || {};
  if (data.error) throw new Error(data.error);
  return (data.services || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}