import { useState } from 'react';
import { Globe, UploadCloud, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { getSessionToken } from '@/lib/customSession';
import {
  normalizeSlug, validateSlug, validateFullDomain, validateGitUrl,
  validatePemCert, validatePemKey,
} from '@/lib/subdomainValidation';

const PROVISIONING_STEPS = [
  { key: 'validation', label: 'Validation' },
  { key: 'domain', label: 'Domain' },
  { key: 'dns', label: 'DNS' },
  { key: 'git', label: 'Git deploy' },
  { key: 'ssl', label: 'SSL' },
  { key: 'complete', label: 'Complete' },
];

const STEP_LABELS = {
  validation: 'Validation',
  challenge_lookup: 'Challenge lookup',
  plesk_create: 'Domain creation',
  dns: 'DNS',
  git_deploy: 'Git deployment',
  ssl_install: 'SSL installation',
  persistence: 'Saving',
};

export default function CreateDomainDialog({ open, onOpenChange, challenges, baseDomain, defaultSsl, onCreated }) {
  const [domainType, setDomainType] = useState('subdomain');
  const [challengeId, setChallengeId] = useState('');
  const [slug, setSlug] = useState('');
  const [fullDomain, setFullDomain] = useState('');
  const [gitLocation, setGitLocation] = useState('');
  const [sslCertFile, setSslCertFile] = useState(null);
  const [sslKeyFile, setSslKeyFile] = useState(null);
  const [certContainsKey, setCertContainsKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progressStep, setProgressStep] = useState(-1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [errorRetryable, setErrorRetryable] = useState(true);
  const [errorStep, setErrorStep] = useState('');

  const reset = () => {
    setDomainType('subdomain');
    setChallengeId('');
    setSlug('');
    setFullDomain('');
    setGitLocation('');
    setSslCertFile(null);
    setSslKeyFile(null);
    setCertContainsKey(false);
    setProgressStep(-1);
    setResult(null);
    setError('');
    setErrorStep('');
    setErrorRetryable(true);
  };

  const handleClose = (v) => {
    if (!v) reset();
    onOpenChange(v);
  };

  // ─── Validation ──────────────────────────────────────────────────────
  const slugValidation = domainType === 'subdomain' ? validateSlug(slug) : { valid: true };
  const fullDomainValidation = domainType === 'full_domain' ? validateFullDomain(fullDomain) : { valid: true };
  const gitValidation = domainType === 'full_domain' ? validateGitUrl(gitLocation) : { valid: true };

  let sslCertError = '';
  let sslKeyError = '';
  if (domainType === 'full_domain') {
    if (sslCertFile) {
      // Validation happens on file read; show error only after read
    }
  }

  const resolvedDomain = domainType === 'subdomain'
    ? `${normalizeSlug(slug)}.${baseDomain}`
    : (fullDomainValidation.valid ? fullDomainValidation.normalized : '');

  const subdomainSslBlocked = domainType === 'subdomain' && !defaultSsl;

  const canSubmit =
    (domainType === 'full_domain' || !!challengeId) &&
    slugValidation.valid &&
    fullDomainValidation.valid &&
    gitValidation.valid &&
    !subdomainSslBlocked &&
    (domainType === 'subdomain' || (sslCertFile && (certContainsKey || sslKeyFile))) &&
    !saving;

  // ─── Submit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (domainType === 'subdomain' && !challengeId) { toast.error('Select a challenge before creating a domain.'); return; }
    if (domainType === 'subdomain' && !slugValidation.valid) { toast.error(slugValidation.error); return; }
    if (domainType === 'full_domain' && !fullDomainValidation.valid) { toast.error(fullDomainValidation.error); return; }
    if (domainType === 'full_domain' && !gitValidation.valid) { toast.error(gitValidation.error); return; }
    if (subdomainSslBlocked) { toast.error('No active admin default SSL configuration. Configure one first.'); return; }

    setSaving(true);
    setError('');
    setResult(null);
    setProgressStep(0);

    try {
      // Upload manual SSL files for full domains.
      let sslCertUrl = '';
      let sslKeyUrl = '';
      if (domainType === 'full_domain') {
        if (!sslCertFile) { toast.error('SSL certificate file is required'); setSaving(false); return; }
        if (!sslKeyFile && !certContainsKey) { toast.error('SSL private key file is required (or upload a PEM containing both certificate and key)'); setSaving(false); return; }

        // Validate PEM markers before upload.
        const certText = await sslCertFile.text();
        const certV = validatePemCert(certText);
        if (!certV.valid) { toast.error(`Certificate: ${certV.error}`); setSaving(false); return; }

        if (sslKeyFile) {
          const keyText = await sslKeyFile.text();
          const keyV = validatePemKey(keyText);
          if (!keyV.valid) { toast.error(`Private key: ${keyV.error}`); setSaving(false); return; }
        }

        setProgressStep(1);
        const certUp = await base44.integrations.Core.UploadFile({ file: sslCertFile });
        sslCertUrl = certUp?.file_url || '';
        if (sslKeyFile) {
          const keyUp = await base44.integrations.Core.UploadFile({ file: sslKeyFile });
          sslKeyUrl = keyUp?.file_url || '';
        }
      }

      setProgressStep(1);

      const res = await base44.functions.invoke('provisionDomain', {
        challenge_id: challengeId,
        domain_type: domainType,
        slug: domainType === 'subdomain' ? slug : '',
        full_domain: domainType === 'full_domain' ? fullDomain : '',
        git_location: gitLocation.trim(),
        ssl_source: domainType === 'subdomain' ? 'admin_default' : 'manual',
        manual_ssl_cert_file_id: sslCertUrl,
        manual_ssl_key_file_id: sslKeyUrl,
        session_token: getSessionToken(),
      });

      const errData = res?.data;
      if (errData?.success === false || errData?.error) {
        const err = new Error(errData?.message || errData?.error || 'Provisioning failed');
        err.retryable = errData?.retryable ?? true;
        err.step = errData?.step || '';
        throw err;
      }

      setProgressStep(PROVISIONING_STEPS.length - 1);
      setResult(res?.data || res);
      toast.success(`Domain ${resolvedDomain} provisioned`);
      onCreated?.();

      // Close dialog after a short delay so the user sees the success state.
      setTimeout(() => {
        reset();
        onOpenChange(false);
      }, 1500);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Failed to provision domain';
      const retryable = e?.retryable ?? true;
      const step = e?.step || e?.response?.data?.step || '';
      setError(msg);
      setErrorRetryable(retryable);
      setErrorStep(step);
      setProgressStep(-1);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = () => {
    setError('');
    setErrorRetryable(true);
    setErrorStep('');
    setProgressStep(-1);
    setResult(null);
  };

  // ─── Progress display ────────────────────────────────────────────────
  const renderProgress = () => {
    if (progressStep < 0 && !error) return null;
    if (error) {
      return (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Provisioning failed</p>
              {errorStep && (
                <p className="text-xs text-destructive/70 mt-0.5">Failed at: {STEP_LABELS[errorStep] || errorStep}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
          {errorRetryable && (
            <Button variant="outline" size="sm" onClick={handleRetry} className="gap-2">
              Retry
            </Button>
          )}
        </div>
      );
    }

    if (result) {
      const isActive = result.domain?.status === 'active' && result.domain?.ssl_status === 'active';
      const isDnsPending = result.dns_pending;
      return (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 space-y-2">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {isDnsPending ? 'Domain created — DNS action required' : 'Domain provisioned successfully'}
              </p>
              {isDnsPending && result.dns_instructions && (
                <p className="text-xs text-muted-foreground mt-1">{result.dns_instructions}</p>
              )}
              {isActive && (
                <a
                  href={result.domain?.full_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
                >
                  {result.domain?.full_domain} <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {isDnsPending && (
                <p className="text-xs text-muted-foreground mt-2">
                  The domain link will become active once DNS is confirmed and SSL is verified.
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-2 flex-wrap">
          {PROVISIONING_STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center gap-2">
              {i > 0 && <div className={`h-px w-6 ${i <= progressStep ? 'bg-primary' : 'bg-border'}`} />}
              <div className={`flex items-center gap-1.5 ${i <= progressStep ? 'text-primary' : 'text-muted-foreground'}`}>
                {i < progressStep ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : i === progressStep ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-current" />
                )}
                <span className="text-xs font-medium">{step.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" /> Create Domain
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Domain Type Selector */}
          <div className="space-y-2">
            <Label>Domain Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setDomainType('subdomain'); setFullDomain(''); }}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  domainType === 'subdomain'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-input hover:border-primary/50'
                }`}
              >
                <p className="text-sm font-medium text-foreground">Challenge Subdomain</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Creates <span className="font-mono">{'<slug>'}.{baseDomain}</span> and uses the active admin default SSL certificate.
                </p>
              </button>
              <button
                type="button"
                onClick={() => { setDomainType('full_domain'); setSlug(''); }}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  domainType === 'full_domain'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-input hover:border-primary/50'
                }`}
              >
                <p className="text-sm font-medium text-foreground">New Full Domain</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Creates an independent domain. You must provide an SSL certificate and private key.
                </p>
              </button>
            </div>
          </div>

          {/* Challenge selector (subdomain only — full domains are independent) */}
          {domainType === 'subdomain' && (
            <div className="space-y-2">
              <Label htmlFor="challenge-select">Challenge</Label>
              <select
                id="challenge-select"
                value={challengeId}
                onChange={(e) => setChallengeId(e.target.value)}
                className="c53-input"
              >
                <option value="">Select a challenge…</option>
                {(challenges || []).map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              {!challengeId && (
                <p className="text-xs text-destructive">Select a challenge before creating a domain.</p>
              )}
            </div>
          )}

          {/* Subdomain slug (subdomain only) */}
          {domainType === 'subdomain' && (
            <div className="space-y-2">
              <Label htmlFor="slug-input">Subdomain Slug</Label>
              <div className="flex items-center gap-2">
                <input
                  id="slug-input"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="dance"
                  className="c53-input flex-1"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">.{baseDomain}</span>
              </div>
              {slugValidation.error && (
                <p className="text-xs text-destructive">{slugValidation.error}</p>
              )}
              {resolvedDomain && !slugValidation.error && (
                <p className="text-xs text-muted-foreground">
                  Resulting domain: <span className="text-primary font-medium">https://{resolvedDomain}</span>
                </p>
              )}
              {/* Default SSL status (read-only) */}
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">Default SSL Certificate</p>
                {defaultSsl ? (
                  <p className="text-sm text-foreground mt-0.5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    {defaultSsl.name} — {defaultSsl.certificate_status}
                  </p>
                ) : (
                  <p className="text-sm text-destructive mt-0.5 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    No active default SSL configuration. Configure one before creating subdomains.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Full domain name (full_domain only) */}
          {domainType === 'full_domain' && (
            <div className="space-y-2">
              <Label htmlFor="full-domain-input">Full Domain Name</Label>
              <input
                id="full-domain-input"
                type="text"
                value={fullDomain}
                onChange={(e) => setFullDomain(e.target.value)}
                placeholder="example.com"
                className="c53-input"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              {fullDomainValidation.error && (
                <p className="text-xs text-destructive">{fullDomainValidation.error}</p>
              )}
              {resolvedDomain && !fullDomainValidation.error && (
                <p className="text-xs text-muted-foreground">
                  Resulting domain: <span className="text-primary font-medium">https://{resolvedDomain}</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2">
                Point the domain's DNS A/AAAA record to the configured Plesk server before HTTPS can become active.
              </p>
            </div>
          )}

          {/* Git location (full_domain only — subdomains serve from the shared folder) */}
          {domainType === 'full_domain' && (
            <div className="space-y-2">
              <Label htmlFor="git-input">Git Repository URL</Label>
              <input
                id="git-input"
                type="url"
                value={gitLocation}
                onChange={(e) => setGitLocation(e.target.value)}
                placeholder="https://github.com/your-org/your-repo.git"
                className="c53-input"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              {gitValidation.error ? (
                <p className="text-xs text-destructive">{gitValidation.error}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  The domain will pull code from this GitHub repository into its document root.
                </p>
              )}
            </div>
          )}

          {/* SSL uploads (full_domain only) */}
          {domainType === 'full_domain' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="ssl-cert-input">SSL Certificate (.pem, .crt, .cer)</Label>
                <label
                  htmlFor="ssl-cert-input"
                  className="flex items-center gap-2 rounded-xl border border-dashed border-input px-4 py-3 cursor-pointer hover:border-primary transition-colors"
                >
                  <UploadCloud className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground truncate">
                    {sslCertFile ? sslCertFile.name : 'Choose certificate file…'}
                  </span>
                </label>
                <input
                  id="ssl-cert-input"
                  type="file"
                  accept=".pem,.crt,.cer,.txt"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0] || null;
                    setSslCertFile(file);
                    setCertContainsKey(false);
                    if (file) {
                      try {
                        const text = await file.text();
                        const v = validatePemCert(text);
                        if (!v.valid) toast.error(`Certificate: ${v.error}`);
                        const hasKey = /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA )?PRIVATE KEY-----/.test(text);
                        setCertContainsKey(hasKey);
                        if (hasKey) toast.success('Private key detected in certificate file — separate key upload not needed.');
                      } catch { /* ignore */ }
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ssl-key-input">
                  SSL Private Key (.key, .pem)
                  {certContainsKey && <span className="ml-2 text-xs font-normal text-muted-foreground">(optional — key found in certificate)</span>}
                </Label>
                <label
                  htmlFor="ssl-key-input"
                  className="flex items-center gap-2 rounded-xl border border-dashed border-input px-4 py-3 cursor-pointer hover:border-primary transition-colors"
                >
                  <UploadCloud className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground truncate">
                    {sslKeyFile ? sslKeyFile.name : 'Choose private key file…'}
                  </span>
                </label>
                <input
                  id="ssl-key-input"
                  type="file"
                  accept=".key,.pem,.txt"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0] || null;
                    setSslKeyFile(file);
                    if (file) {
                      try {
                        const text = await file.text();
                        const v = validatePemKey(text);
                        if (!v.valid) toast.error(`Private key: ${v.error}`);
                      } catch { /* ignore */ }
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {certContainsKey
                    ? 'Private key detected in your certificate file. No separate key upload needed.'
                    : 'Upload a separate key file, or use a single PEM containing both the certificate and private key.'}
                </p>
              </div>
            </>
          )}

          {/* Progress / result / error */}
          {renderProgress()}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? 'Provisioning…' : 'Create Domain'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}