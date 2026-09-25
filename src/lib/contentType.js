/**
 * Content type — who creates and manages a challenge's content.
 * Two options only. Admin-managed is the default everywhere.
 */
import { UserCog, ShieldCheck } from 'lucide-react';

export const DEFAULT_CONTENT_TYPE = 'admin_managed';

export const CONTENT_TYPE_VALUES = ['host_managed', 'admin_managed'];

export const CONTENT_TYPE_OPTIONS = [
  {
    value: 'admin_managed',
    label: 'Admin-managed',
    description: 'The 53 team creates and manages the challenge content.',
    icon: ShieldCheck,
  },
  {
    value: 'host_managed',
    label: 'Host-managed',
    description: 'You create and manage the challenge content yourself.',
    icon: UserCog,
  },
];

export const CONTENT_TYPE_LABELS = {
  host_managed: 'Host-managed',
  admin_managed: 'Admin-managed',
};

export function normalizeContentType(value) {
  return CONTENT_TYPE_VALUES.includes(value) ? value : DEFAULT_CONTENT_TYPE;
}

export function contentTypeLabel(value) {
  return CONTENT_TYPE_LABELS[normalizeContentType(value)];
}