import { useState } from 'react';
import { Button } from '@/components/ui/button';
import TemplateStatusBadge from './TemplateStatusBadge';
import TemplatePackTabs from './TemplatePackTabs';
import { SERVICE_TIERS, labelFor } from '@/lib/templateLibrary';

function Meta({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

export default function TemplateDetail({ template, versions, onEditDraft, onNewVersion, onArchive, busy }) {
  const [archiving, setArchiving] = useState(false);
  const [reason, setReason] = useState('');
  const status = template.template_status;

  const startNewVersion = () => {
    if (!window.confirm('Published templates are immutable. Continuing will create a new draft version.')) return;
    onNewVersion(template);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-xl font-extrabold">{template.template_name || 'Untitled template'}</h2>
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-bold text-muted-foreground">v{template.template_version}</span>
          <TemplateStatusBadge status={status} />
        </div>

        <dl className="mt-4 divide-y divide-border/60">
          <Meta label="Template family" value={template.template_family_id} />
          <Meta label="Category" value={template.primary_category_id} />
          <Meta label="Subcategory" value={template.subcategory_id} />
          <Meta label="Service tier" value={labelFor(SERVICE_TIERS, template.service_tier)} />
          <Meta label="Created" value={template.created_date ? new Date(template.created_date).toLocaleString() : ''} />
          <Meta label="Last modified" value={template.updated_date ? new Date(template.updated_date).toLocaleString() : ''} />
          <Meta label="Published" value={template.published_at ? `${new Date(template.published_at).toLocaleString()} by ${template.published_by}` : ''} />
          <Meta label="Superseded" value={template.superseded_at ? `${new Date(template.superseded_at).toLocaleString()} by ${template.superseded_by_user}` : ''} />
          <Meta label="Archived" value={template.archived_at ? `${new Date(template.archived_at).toLocaleString()} by ${template.archived_by}` : ''} />
          <Meta label="Archive reason" value={template.archive_reason} />
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {status === 'draft' && <Button onClick={() => onEditDraft(template)}>Edit draft</Button>}
          {status !== 'draft' && <Button onClick={startNewVersion} disabled={busy}>Create new version</Button>}
          {(status === 'draft' || status === 'active') && (
            <Button variant="outline" onClick={() => setArchiving((v) => !v)}>Archive</Button>
          )}
        </div>

        {archiving && (
          <div className="mt-4 rounded-xl border border-border bg-white/5 p-4">
            <p className="text-sm text-muted-foreground">
              Archiving removes this template from future host selection. Historical proposals keep their frozen snapshots.
            </p>
            <input className="c53-input mt-3" placeholder="Reason for archiving (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="mt-3 flex gap-2">
              <Button disabled={!reason.trim() || busy} onClick={() => onArchive(template, reason.trim())}>Confirm archive</Button>
              <Button variant="outline" onClick={() => setArchiving(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      <TemplatePackTabs template={template} />

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-muted-foreground">Version history</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center gap-2">
              <span className="font-bold">v{v.template_version}</span>
              <TemplateStatusBadge status={v.template_status} />
              <span className="text-muted-foreground">{new Date(v.updated_date || v.created_date).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-muted-foreground">Audit history</h3>
        <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
          {(template.template_audit_log || []).slice().reverse().map((a, i) => (
            <li key={i}>
              <span className="font-semibold text-foreground">{a.action}</span> · v{a.template_version} · {a.actor} · {new Date(a.at).toLocaleString()}
              {a.old_status ? ` · ${a.old_status} → ${a.new_status}` : ''}
            </li>
          ))}
          {(template.template_audit_log || []).length === 0 && <li>No recorded actions yet.</li>}
        </ul>
      </div>
    </div>
  );
}