/**
 * D8 — Host Experience Principles.
 * Rules applied: D8.4 (status simplification), D8.3 (calm tone), D8.6 (invisible routing).
 *
 * Single presentation layer mapping every internal review status to a
 * host-facing label. Host-facing components must import from here — raw
 * internal status values are never rendered to hosts.
 */

const STATUS_MAP = {
  intake_received: {
    label: 'Submitted',
    detail: "We're reviewing your proposal",
    tone: 'progress',
    step: 2,
  },
  in_review: {
    label: 'In review',
    detail: 'Our team is checking your challenge',
    tone: 'progress',
    step: 2,
  },
  submitted_for_review: {
    label: 'In review',
    detail: 'Our team is checking your challenge',
    tone: 'progress',
    step: 2,
  },
  builder_started: {
    label: 'Action needed',
    detail: 'Finish setting up your challenge — pick up where you left off',
    tone: 'action',
    step: 2,
  },
  changes_requested: {
    label: 'Changes requested',
    detail: 'Our team has suggested a few changes before your challenge can go ahead',
    tone: 'action',
    contextKey: 'note',
    step: 2,
  },
  terms_pending: {
    label: 'Agreement ready',
    detail: 'Please review and sign',
    tone: 'action',
    step: 3,
  },
  approved: {
    label: 'Approved',
    detail: 'Your challenge is ready to go live',
    tone: 'complete',
    step: 4,
  },
  approved_and_signed: {
    label: 'Approved',
    detail: 'Your challenge is ready to go live',
    tone: 'complete',
    step: 4,
  },
  rejected: {
    label: 'Declined',
    detail: "Unfortunately we can't run this challenge",
    tone: 'declined',
    contextKey: 'reason',
    step: 2,
  },
  live: {
    label: 'Live',
    detail: 'Your challenge is live — good luck!',
    tone: 'complete',
    step: 5,
  },
};

/**
 * Map an internal status to its host-facing display.
 * context: { note, reason } — plain-English admin feedback where relevant.
 * Returns { label, detail, display, tone, step }.
 */
export function getHostStatusLabel(internalStatus, context = {}) {
  const entry = STATUS_MAP[internalStatus] || STATUS_MAP.intake_received;
  const detail = (entry.contextKey && context[entry.contextKey]) || entry.detail;
  return {
    label: entry.label,
    detail,
    display: `${entry.label} — ${detail}`,
    tone: entry.tone,
    step: entry.step,
  };
}

// Calm colour system: blue = in progress, amber = action needed,
// green = complete. Red is reserved for Declined only (D8 design rule 3).
export const HOST_TONE_STYLES = {
  progress: {
    panel: 'border-blue-500/30 bg-blue-500/10',
    text: 'text-blue-300',
    badge: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  },
  action: {
    panel: 'border-amber-500/30 bg-amber-500/10',
    text: 'text-amber-300',
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  complete: {
    panel: 'border-emerald-500/30 bg-emerald-500/10',
    text: 'text-emerald-300',
    badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  declined: {
    panel: 'border-red-500/30 bg-red-500/10',
    text: 'text-red-300',
    badge: 'border-red-500/30 bg-red-500/10 text-red-300',
  },
};