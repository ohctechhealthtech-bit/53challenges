import { useState } from 'react';
import { ExternalLink, Trash2, AlertCircle, RotateCw, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/customSession';

const STATUS_STYLES = {
  pending: 'bg-muted text-muted-foreground',
  provisioning: 'bg-blue-500/15 text-blue-400',
  dns_pending: 'bg-amber-500/15 text-amber-400',
  deployed: 'bg-blue-500/15 text-blue-400',
  ssl_pending: 'bg-blue-500/15 text-blue-400',
  active: 'bg-green-500/15 text-green-400',
  failed: 'bg-destructive/15 text-destructive',
  deleted: 'bg-muted text-muted-foreground line-through',
};

const GIT_STATUS_STYLES = {
  pending: 'bg-muted text-muted-foreground',
  cloning: 'bg-blue-500/15 text-blue-400',
  deployed: 'bg-green-500/15 text-green-400',
  failed: 'bg-destructive/15 text-destructive',
  skipped: 'bg-muted/50 text-muted-foreground/70',
};

const SSL_STATUS_STYLES = {
  pending: 'bg-muted text-muted-foreground',
  installing: 'bg-blue-500/15 text-blue-400',
  installed: 'bg-green-500/15 text-green-400',
  active: 'bg-green-500/15 text-green-400',
  failed: 'bg-destructive/15 text-destructive',
  not_configured: 'bg-destructive/15 text-destructive',
  skipped: 'bg-muted/50 text-muted-foreground/70',
};

const NGINX_STATUS_STYLES = {
  pending: 'bg-muted text-muted-foreground',
  configured: 'bg-green-500/15 text-green-400',
  failed: 'bg-destructive/15 text-destructive',
};

export default function DomainTable({ domains, loading, onChanged }) {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [reapplyingId, setReapplyingId] = useState(null);

  const handleReapplyNginx = async (d) => {
    setReapplyingId(d.id);
    try {
      const res = await base44.functions.invoke('applyNginxDirectives', { domain_id: d.id, session_token: getSessionToken() });
      const data = res?.data;
      if (data?.success === false) {
        throw new Error(data?.error || 'Re-apply failed');
      }
      if (data?.nginx_status === 'configured') {
        toast.success(`API proxy verified for ${d.full_domain}`);
      } else {
        toast.message(`API proxy pending for ${d.full_domain} — awaiting server-side nginx sync`);
      }
      onChanged?.();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Re-apply failed';
      toast.error(msg);
    } finally {
      setReapplyingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await base44.functions.invoke('deleteChallengeSubdomain', { domain_id: deleteTarget.id, session_token: getSessionToken() });
      if (res?.data?.error) throw new Error(res.data.error);
      toast.success(`${deleteTarget.full_domain} deleted`);
      setDeleteTarget(null);
      onChanged?.();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Failed to delete domain';
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleRetry = async (d) => {
    setRetryingId(d.id);
    try {
      const res = await base44.functions.invoke('provisionDomain', {
        challenge_id: d.challenge_id || '',
        domain_type: d.domain_type || (d.hosting_mode === 'full_domain' ? 'full_domain' : 'subdomain'),
        slug: d.slug || '',
        full_domain: d.full_domain || '',
        git_location: d.git_location || '',
        ssl_source: d.ssl_source || 'admin_default',
        manual_ssl_cert_file_id: d.ssl_cert_url || '',
        manual_ssl_key_file_id: d.ssl_key_url || '',
        session_token: getSessionToken(),
      });
      const errData = res?.data;
      if (errData?.success === false || errData?.error) {
        throw new Error(errData?.message || errData?.error || 'Retry failed');
      }
      toast.success(`${d.full_domain} retry submitted`);
      onChanged?.();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Retry failed';
      toast.error(msg);
    } finally {
      setRetryingId(null);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading domains…</p>;
  }

  const visibleDomains = (domains || []).filter((d) => d.status !== 'deleted');

  if (!visibleDomains || visibleDomains.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-xl">
        <p className="text-sm text-muted-foreground">No domains configured yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Click "Create Domain" to add one.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Challenge</th>
              <th className="text-left px-4 py-3 font-semibold">Type</th>
              <th className="text-left px-4 py-3 font-semibold">Domain</th>
              <th className="text-left px-4 py-3 font-semibold">Full URL</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-left px-4 py-3 font-semibold">Git Deploy</th>
              <th className="text-left px-4 py-3 font-semibold">SSL</th>
              <th className="text-left px-4 py-3 font-semibold">SSL Source</th>
              <th className="text-left px-4 py-3 font-semibold">Nginx</th>
              <th className="text-left px-4 py-3 font-semibold">Hosting Mode</th>
              <th className="text-left px-4 py-3 font-semibold">Created</th>
              <th className="text-right px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleDomains.map((d) => {
              const isTypeFullDomain = d.domain_type === 'full_domain' || d.hosting_mode === 'full_domain';
              const isLinkActive = d.status === 'active' && (d.ssl_status === 'active' || d.ssl_status === 'installed');
              return (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{d.challenge_name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{d.challenge_id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={isTypeFullDomain ? 'text-blue-400 border-blue-500/30' : 'text-primary border-primary/30'}>
                      {isTypeFullDomain ? 'Full domain' : 'Subdomain'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground">
                    {isTypeFullDomain ? (d.full_domain || '—') : (d.slug || '—')}
                  </td>
                  <td className="px-4 py-3">
                    {isLinkActive ? (
                      <a
                        href={`https://${d.full_domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {d.full_domain} <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">{d.full_domain}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_STYLES[d.status] || STATUS_STYLES.pending}>
                      {d.status}
                    </Badge>
                    {d.status === 'failed' && d.error_message && (
                      <p className="text-xs text-destructive mt-1 flex items-start gap-1" title={d.error_message}>
                        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="truncate max-w-[200px]">{d.error_message}</span>
                      </p>
                    )}
                    {d.status === 'dns_pending' && (
                      <p className="text-xs text-amber-400 mt-1">Point DNS A record to Plesk server</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={GIT_STATUS_STYLES[d.git_deployment_status] || 'bg-muted text-muted-foreground'}>
                      {d.git_deployment_status || '—'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={SSL_STATUS_STYLES[d.ssl_status] || 'bg-muted text-muted-foreground'}>
                      {d.ssl_status || '—'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={d.ssl_source === 'manual' ? 'text-amber-400 border-amber-500/30' : 'text-green-400 border-green-500/30'}>
                      {d.ssl_source === 'manual' ? 'Manual' : 'Admin default'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={NGINX_STATUS_STYLES[d.nginx_status] || 'bg-muted text-muted-foreground'}>
                      {d.nginx_status || 'pending'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {d.hosting_mode === 'wildcard' ? 'Wildcard' : d.hosting_mode === 'full_domain' ? 'Full domain' : 'Separate'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {d.created_date ? new Date(d.created_date).toLocaleDateString('en-AU') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {d.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRetry(d)}
                          disabled={retryingId === d.id}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          title="Retry provisioning (reuses existing Plesk domain)"
                        >
                          {retryingId === d.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCw className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      {d.domain_type === 'subdomain' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReapplyNginx(d)}
                          disabled={reapplyingId === d.id}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          title="Re-apply nginx /api/ directives"
                        >
                          {reapplyingId === d.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ShieldCheck className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      {d.status !== 'deleted' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(d)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete domain?</DialogTitle>
            <DialogDescription>
              This will remove <span className="font-semibold text-foreground">{deleteTarget?.full_domain}</span>.
              {(deleteTarget?.hosting_mode === 'separate_subdomain' || deleteTarget?.hosting_mode === 'full_domain') && deleteTarget?.status === 'active' &&
                ' The domain will also be removed from Plesk. '}
              The record is kept for audit history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}