const STYLES = {
  draft: 'border-border bg-muted text-muted-foreground',
  active: 'border-success/40 bg-success/15 text-success',
  superseded: 'border-gold/40 bg-gold/15 text-gold',
  archived: 'border-border bg-white/5 text-muted-foreground',
};

const LABELS = { draft: 'Draft', active: 'Active', superseded: 'Superseded', archived: 'Archived' };

export default function TemplateStatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${STYLES[status] || STYLES.draft}`}>
      {LABELS[status] || status}
    </span>
  );
}