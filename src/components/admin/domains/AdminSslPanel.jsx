import { useState, useEffect } from 'react';
import { ShieldCheck, UploadCloud, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/customSession';
import { validatePemCert, validatePemKey } from '@/lib/subdomainValidation';

export default function AdminSslPanel({ open, onOpenChange, currentConfig, onSaved }) {
  const [name, setName] = useState('');
  const [certFile, setCertFile] = useState(null);
  const [keyFile, setKeyFile] = useState(null);
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (open && currentConfig) {
      setName(currentConfig.name || '');
      setExpiresAt(currentConfig.expires_at || '');
    }
    if (open && !currentConfig) {
      setName('');
      setExpiresAt('');
    }
    if (!open) {
      setCertFile(null);
      setKeyFile(null);
    }
  }, [open, currentConfig]);

  const statusBadge = (status) => {
    const styles = {
      configured: 'bg-green-500/15 text-green-400',
      missing: 'bg-destructive/15 text-destructive',
      invalid: 'bg-destructive/15 text-destructive',
      expired: 'bg-amber-500/15 text-amber-400',
    };
    return styles[status] || 'bg-muted text-muted-foreground';
  };

  const handleSave = async () => {
    if (!name) { toast.error('Certificate display name is required'); return; }
    if (!certFile) { toast.error('SSL certificate file is required'); return; }
    if (!keyFile) { toast.error('SSL private key file is required'); return; }

    setSaving(true);
    try {
      // Read and validate PEM markers.
      const certText = await certFile.text();
      const certV = validatePemCert(certText);
      if (!certV.valid) { toast.error(`Certificate: ${certV.error}`); setSaving(false); return; }

      let keyText = await keyFile.text();
      const keyV = validatePemKey(keyText);
      if (!keyV.valid) {
        // Maybe the key is in the cert PEM.
        const keyMatch = certText.match(/-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA )?PRIVATE KEY-----/);
        if (keyMatch) {
          keyText = keyMatch[0];
        } else {
          toast.error(`Private key: ${keyV.error}`);
          setSaving(false);
          return;
        }
      }

      // Encode as base64 for the backend.
      const certB64 = btoa(certText);
      const keyB64 = btoa(keyText);

      const res = await base44.functions.invoke('manageAdminSsl', {
        action: 'save',
        name,
        cert_content_b64: certB64,
        key_content_b64: keyB64,
        expires_at: expiresAt || '',
        session_token: getSessionToken(),
      });

      if (res?.data?.error) throw new Error(res.data.error);

      toast.success('Default SSL configuration saved');
      setConfirmOpen(false);
      setCertFile(null);
      setKeyFile(null);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to save SSL configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setCertFile(null); setKeyFile(null); } onOpenChange(v); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Default Subdomain SSL
            </DialogTitle>
            <DialogDescription>
              This certificate is automatically applied to every Challenge Subdomain. File contents are stored securely and never exposed.
            </DialogDescription>
          </DialogHeader>

          {/* Current status */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Current Status</span>
              {currentConfig ? (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(currentConfig.certificate_status)}`}>
                  {currentConfig.certificate_status}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-medium text-destructive">
                  Missing
                </span>
              )}
            </div>
            {currentConfig ? (
              <div className="space-y-1 text-sm">
                <p className="text-foreground font-medium">{currentConfig.name}</p>
                {currentConfig.expires_at && (
                  <p className="text-xs text-muted-foreground">Expires: {currentConfig.expires_at}</p>
                )}
                {currentConfig.updated_at && (
                  <p className="text-xs text-muted-foreground">
                    Updated: {new Date(currentConfig.updated_at).toLocaleDateString('en-AU')}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No default SSL configuration has been set up yet.</p>
            )}
          </div>

          {/* Save form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ssl-name">Certificate Display Name</Label>
              <Input
                id="ssl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="53 Challenges Default SSL"
                className="c53-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ssl-cert-upload">SSL Certificate (.pem, .crt, .cer)</Label>
              <label
                htmlFor="ssl-cert-upload"
                className="flex items-center gap-2 rounded-xl border border-dashed border-input px-4 py-3 cursor-pointer hover:border-primary transition-colors"
              >
                <UploadCloud className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {certFile ? certFile.name : 'Choose certificate file…'}
                </span>
              </label>
              <input
                id="ssl-cert-upload"
                type="file"
                accept=".pem,.crt,.cer,.txt"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0] || null;
                  setCertFile(file);
                  if (file) {
                    try {
                      const text = await file.text();
                      const v = validatePemCert(text);
                      if (!v.valid) toast.error(`Certificate: ${v.error}`);
                    } catch { /* ignore */ }
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ssl-key-upload">SSL Private Key (.key, .pem)</Label>
              <label
                htmlFor="ssl-key-upload"
                className="flex items-center gap-2 rounded-xl border border-dashed border-input px-4 py-3 cursor-pointer hover:border-primary transition-colors"
              >
                <UploadCloud className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {keyFile ? keyFile.name : 'Choose private key file…'}
                </span>
              </label>
              <input
                id="ssl-key-upload"
                type="file"
                accept=".key,.pem,.txt"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0] || null;
                  setKeyFile(file);
                  if (file) {
                    try {
                      const text = await file.text();
                      const v = validatePemKey(text);
                      if (!v.valid) toast.error(`Private key: ${v.error}`);
                    } catch { /* ignore */ }
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ssl-expires">Expiry Date (optional)</Label>
              <Input
                id="ssl-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="c53-input"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button
              onClick={() => {
                if (currentConfig) {
                  setConfirmOpen(true);
                } else {
                  handleSave();
                }
              }}
              disabled={saving || !name || !certFile || !keyFile}
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : currentConfig ? (
                'Replace Default SSL'
              ) : (
                'Save Default SSL'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace confirmation */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Replace default SSL certificate?</DialogTitle>
            <DialogDescription>
              This will replace the current default SSL configuration. All new Challenge Subdomains will use the new certificate. Existing subdomains will keep their current certificates.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="destructive" onClick={handleSave} disabled={saving}>
              {saving ? 'Replacing…' : 'Replace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}