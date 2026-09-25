/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.5 (named, human-readable role descriptions).
 * The underlying permission model is unchanged — these are display labels only.
 */
export const HOST_ROLES = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Full access — manages the workspace, billing and team.',
  },
  {
    key: 'editor',
    name: 'Editor',
    description: 'Can build the challenge, upload content and review entries.',
  },
  {
    key: 'marketing',
    name: 'Marketing Contributor',
    description: 'Can work on social campaign content and download assets — cannot change challenge settings.',
  },
  {
    key: 'finance',
    name: 'Finance Contact',
    description: 'Can view invoices and payment status only.',
  },
  {
    key: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to reports and results.',
  },
];

export function getHostRole(key) {
  return HOST_ROLES.find((r) => r.key === key) || HOST_ROLES[4];
}