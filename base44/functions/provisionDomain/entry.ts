import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getSecret } from '../../shared/secretsEnv.ts';
import { isAdminCaller } from '../../shared/adminAuth.ts';
import { normalizeSlug, validateSlug, validateFullDomain, validateGitUrl } from '../../shared/subdomainValidation.ts';
import {
  getPleskConfig,
  createPleskSubdomain,
  createPleskFullDomain,
  cloneGitIntoSubdomain,
  installSslCertificate,
  lookupDomain,
  setupSubdomainReverseProxy,
  checkSubdomainProxyHealth,
} from '../../shared/pleskApi.ts';
import { fetchChallengeApi } from '../../shared/challengeApiHelper.ts';

// Unified domain provisioning for both challenge subdomains and independent
// full domains. Admin only. Never trusts client-provided Plesk IDs, document
// roots, or credentials. All sensitive errors are mapped to safe codes.
//
// Safe error codes:
//   CHALLENGE_REQUIRED, CHALLENGE_NOT_FOUND, VALIDATION_ERROR, DUPLICATE_DOMAIN,
//   PLESK_NOT_CONFIGURED, CONFIG_MISSING_DEFAULT_IP, CONFIG_MISSING_PLAN,
//   CONFIG_MISSING_WEBSPACE, PLESK_DOMAIN_CREATE_FAILED, PLESK_SUBSCRIPTION_REQUIRED,
//   GIT_DEPLOY_FAILED, SSL_INSTALL_FAILED, DNS_PENDING, INTERNAL_ERROR
//
// Failure steps (returned as `step`):
//   validation, challenge_lookup, plesk_create, dns, git_deploy, ssl_install, persistence

const RETRYABLE_CODES = new Set([
  'DUPLICATE_DOMAIN', 'PLESK_DOMAIN_CREATE_FAILED', 'GIT_DEPLOY_FAILED', 'SSL_INSTALL_FAILED', 'INTERNAL_ERROR',
]);

function safeError(code: string, message: string, step: string, status = 400) {
  return Response.json({
    success: false,
    code,
    step,
    message,
    retryable: RETRYABLE_CODES.has(code),
  }, { status });
}

/** Server-side validation of certificate PEM content. */
function validateCertContent(content: string): { valid: boolean; error?: string } {
  if (!content || !content.includes('-----BEGIN CERTIFICATE-----')) {
    return { valid: false, error: 'Certificate file must contain a PEM certificate (-----BEGIN CERTIFICATE-----).' };
  }
  return { valid: true };
}

/** Server-side validation of private key PEM content. */
function validateKeyContent(content: string): { valid: boolean; error?: string } {
  if (!content) return { valid: false, error: 'Private key is empty.' };
  if (
    !content.includes('-----BEGIN PRIVATE KEY-----') &&
    !content.includes('-----BEGIN RSA PRIVATE KEY-----')
  ) {
    return { valid: false, error: 'Private key file must contain a PEM private key (-----BEGIN PRIVATE KEY----- or -----BEGIN RSA PRIVATE KEY-----).' };
  }
  return { valid: true };
}

export default async function (req: Request): Promise<Response> {
  const logSafe = (operation: string, details: Record<string, any>) => {
    console.log(`[provisionDomain] ${operation}`, JSON.stringify(details));
  };

  let body: any = {};
  try {
    const base44 = createClientFromRequest(req);
    body = await req.json().catch(() => ({}));

    const isAdmin = await isAdminCaller(base44, body.session_token || '', getSecret('CHALLENGE_API_KEY'));
    if (!isAdmin) return safeError('VALIDATION_ERROR', 'Only admins can provision domains', 'validation', 403);

    const { challenge_id, domain_type, slug, full_domain, git_location } = body;

    // ─── 1. Challenge is mandatory for subdomains only ────────────────
    // Full domains are independent — no challenge association required.
    if (domain_type === 'subdomain' && (!challenge_id || typeof challenge_id !== 'string' || !challenge_id.trim())) {
      logSafe('rejected', { reason: 'missing_challenge', domain_type });
      return safeError('CHALLENGE_REQUIRED', 'Select a challenge before creating a domain.', 'validation');
    }

    if (!domain_type || !['subdomain', 'full_domain'].includes(domain_type)) {
      return safeError('VALIDATION_ERROR', 'Domain type must be subdomain or full_domain', 'validation');
    }

    // Git is required for full domains; optional for subdomains (they serve from the shared folder).
    if (domain_type === 'full_domain') {
      if (!git_location) return safeError('VALIDATION_ERROR', 'Git repository URL is required', 'validation');
      const gitValidation = validateGitUrl(git_location);
      if (!gitValidation.valid) return safeError('VALIDATION_ERROR', gitValidation.error!, 'validation');
    } else if (git_location) {
      const gitValidation = validateGitUrl(git_location);
      if (!gitValidation.valid) return safeError('VALIDATION_ERROR', gitValidation.error!, 'validation');
    }

    const baseDomain = getSecret('PLESK_BASE_DOMAIN');
    if (!baseDomain) return safeError('PLESK_NOT_CONFIGURED', 'Plesk base domain is not configured', 'validation');

    const pleskConfig = getPleskConfig();
    if (!pleskConfig) return safeError('PLESK_NOT_CONFIGURED', 'Plesk is not configured', 'validation');

    // ─── 2. Type-specific validation ──────────────────────────────────
    let resolvedFullDomain = '';
    let resolvedSlug = '';
    let sslSource: 'admin_default' | 'manual' = 'admin_default';
    let manualCertUrl = '';
    let manualKeyUrl = '';

    if (domain_type === 'subdomain') {
      if (!slug) return safeError('VALIDATION_ERROR', 'Subdomain slug is required', 'validation');
      const norm = normalizeSlug(slug);
      const v = validateSlug(norm);
      if (!v.valid) return safeError('VALIDATION_ERROR', v.error!, 'validation');
      resolvedSlug = norm;
      resolvedFullDomain = `${norm}.${baseDomain}`;
      sslSource = 'admin_default';
    } else {
      if (!full_domain) return safeError('VALIDATION_ERROR', 'Full domain name is required', 'validation');
      const fv = validateFullDomain(full_domain);
      if (!fv.valid) return safeError('VALIDATION_ERROR', fv.error!, 'validation');
      resolvedFullDomain = fv.normalized!;
      sslSource = 'manual';

      manualCertUrl = body.manual_ssl_cert_file_id || body.ssl_cert_url || '';
      manualKeyUrl = body.manual_ssl_key_file_id || body.ssl_key_url || '';
      if (!manualCertUrl) return safeError('VALIDATION_ERROR', 'SSL certificate file is required for full domains', 'validation');
      if (!manualKeyUrl) return safeError('VALIDATION_ERROR', 'SSL private key file is required for full domains', 'validation');
    }

    const sr = base44.asServiceRole;

    // ─── 3. Verify challenge exists (subdomain only) ───────────────────
    let challengeName = '';
    if (domain_type === 'subdomain') {
      // Try the local Challenge entity first, then fall back to the external
      // Challenge API (source of truth). Real challenges like "Photo of the
      // Day" only exist in the external API, not the local entity.
      let challenge: any = null;
      try {
        challenge = await sr.entities.Challenge.get(challenge_id.trim());
      } catch {
        // Not in local DB — try external API below.
      }
      if (!challenge) {
        try {
          const apiKey = getSecret('CHALLENGE_API_KEY');
          const apiBase = getSecret('CHALLENGE_API_BASE_URL');
          const result = await fetchChallengeApi('challenges', { id: challenge_id.trim(), include_inactive: true }, apiKey, apiBase);
          const list = result?.data || result?.challenges || [];
          challenge = (list || []).find((c: any) => c.id === challenge_id.trim()) || null;
        } catch {
          // External API unreachable — fall through to not-found below.
        }
      }
      challengeName = challenge?.title || '';
      if (!challengeName) {
        logSafe('challenge_lookup_failed', { challenge_id_present: true, domain_type, domain_name: resolvedFullDomain, error: 'not_found' });
        return safeError('CHALLENGE_NOT_FOUND', 'The selected challenge could not be found. Please refresh and try again.', 'challenge_lookup', 404);
      }
    }

    // ─── 3b. Pre-provisioning diagnostics (safe, no secrets) ─────────
    const defaultIp = getSecret('PLESK_DEFAULT_IP');
    const servicePlan = getSecret('PLESK_SERVICE_PLAN');
    const parentWebspace = getSecret('PLESK_PARENT_WEBSPACE');
    const strategy = domain_type === 'subdomain' ? 'cli-subdomain-create' : 'rest-domain-create';
    logSafe('pre_provisioning_diagnostics', {
      challenge_id_present: true,
      challenge_name: challengeName,
      domain_type,
      target_domain: resolvedFullDomain,
      strategy,
      server_config: {
        plesk_configured: !!pleskConfig,
        base_domain: !!baseDomain,
        default_ip: !!defaultIp,
        service_plan: !!servicePlan,
        parent_webspace: !!parentWebspace,
      },
    });

    // For full domains, verify required server config before attempting creation.
    if (domain_type === 'full_domain') {
      if (!defaultIp && !parentWebspace) {
        return safeError('CONFIG_MISSING_DEFAULT_IP', 'Server config missing: PLESK_DEFAULT_IP (or PLESK_PARENT_WEBSPACE) is required to create independent domains. Please add it in app secrets.', 'validation');
      }
    }

    // ─── 4. Check for existing application record (idempotent) ────────
    const existingFilter = domain_type === 'subdomain'
      ? { slug: resolvedSlug, base_domain: baseDomain }
      : { full_domain: resolvedFullDomain };

    const existing = await sr.entities.ChallengeDomain.filter(existingFilter);
    const blockingExisting = (existing || []).filter(
      (d: any) => d.status === 'active' || d.status === 'provisioning' || d.status === 'pending' || d.status === 'dns_pending' || d.status === 'deployed' || d.status === 'ssl_pending'
    );
    if (blockingExisting.length > 0) {
      return safeError('DUPLICATE_DOMAIN', 'A domain with this name already exists', 'validation', 409);
    }

    // Retire earlier failed attempts so the table shows one live row.
    const failedExisting = (existing || []).filter((d: any) => d.status === 'failed');
    for (const f of failedExisting) {
      await sr.entities.ChallengeDomain.update(f.id, { status: 'deleted' });
    }

    // ─── 5. For subdomains: verify admin default SSL exists ───────────
    let adminSslConfig: any = null;
    if (domain_type === 'subdomain') {
      const configs = await sr.entities.AdminSslConfiguration.filter({ is_active: true });
      adminSslConfig = (configs || [])[0];
      if (!adminSslConfig) {
        return safeError('SSL_NOT_CONFIGURED', 'No active admin default SSL configuration. Please configure one before creating subdomains.', 'validation');
      }
    }

    // ─── 6. Pre-check Plesk for existing domain ────────────────────────
    // If the domain exists in Plesk from a previous failed attempt, reuse
    // it instead of blocking. The ChallengeDomain record check above already
    // retired failed application records, so reaching here with an existing
    // Plesk domain means a previous attempt got far enough to create it.
    const existingPlesk = await lookupDomain(pleskConfig, resolvedFullDomain);

    // ─── 7. Create the ChallengeDomain record ─────────────────────────
    let record: any;
    try {
      record = await sr.entities.ChallengeDomain.create({
        challenge_id: (challenge_id || '').trim(),
        challenge_name: challengeName,
        domain_type,
        slug: resolvedSlug,
        base_domain: domain_type === 'subdomain' ? baseDomain : resolvedFullDomain,
        full_domain: resolvedFullDomain,
        full_url: `https://${resolvedFullDomain}`,
        parent_domain: baseDomain,
        status: 'provisioning',
        hosting_mode: domain_type === 'subdomain' ? 'separate_subdomain' : 'full_domain',
        git_location: git_location || '',
        git_deployment_status: git_location ? 'pending' : 'skipped',
        ssl_cert_url: manualCertUrl,
        ssl_key_url: manualKeyUrl,
        ssl_status: 'pending',
        ssl_source: sslSource,
      });
    } catch (e: any) {
      logSafe('persistence_failed', { domain_type, domain_name: resolvedFullDomain, challenge_id_present: true });
      return safeError('INTERNAL_ERROR', 'Could not save the domain record. Please try again.', 'persistence', 500);
    }

    // ─── 8. Provision in Plesk (or reuse existing) ────────────────────
    let docRoot = '';
    let siteId = '';

    if (existingPlesk) {
      // Domain already exists in Plesk from a previous failed attempt — reuse it.
      docRoot = existingPlesk.wwwRoot || '';
      siteId = existingPlesk.id || '';
      logSafe('plesk_reuse_existing', { domain_type, domain_name: resolvedFullDomain, site_id: siteId, document_root: docRoot });
    } else {
      const pleskResult = domain_type === 'subdomain'
        ? await createPleskSubdomain(pleskConfig, resolvedSlug)
        : await createPleskFullDomain(pleskConfig, resolvedFullDomain, { defaultIp, servicePlan, parentWebspace });

      if (!pleskResult.success) {
        const pleskError = pleskResult.error || 'Domain creation failed';
        const pleskMessage = pleskResult.message || pleskError;
        logSafe('plesk_create_failed', { domain_type, domain_name: resolvedFullDomain, challenge_id_present: true, error_code: pleskError });

        // Map config-missing errors to safe codes (not retryable).
        if (pleskError === 'CONFIG_MISSING_DEFAULT_IP' || pleskError === 'CONFIG_MISSING_PLAN' || pleskError === 'CONFIG_MISSING_WEBSPACE' || pleskError === 'PLESK_SUBSCRIPTION_REQUIRED') {
          await sr.entities.ChallengeDomain.update(record.id, {
            status: 'failed',
            error_message: pleskMessage,
          });
          return safeError(pleskError, pleskMessage, 'plesk_create');
        }

        await sr.entities.ChallengeDomain.update(record.id, {
          status: 'failed',
          error_message: pleskMessage,
        });
        return safeError('PLESK_DOMAIN_CREATE_FAILED', pleskMessage, 'plesk_create', 502);
      }

      docRoot = pleskResult.documentRoot || '';
      siteId = pleskResult.siteId || '';
    }

    // ─── 9. Git deployment (skipped for subdomains without a git URL) ──
    let gitStatus = 'skipped';
    if (git_location) {
      await sr.entities.ChallengeDomain.update(record.id, {
        status: 'provisioning',
        plesk_site_id: siteId,
        document_root: docRoot,
        git_deployment_status: 'cloning',
      });

      const gitParentDomain = domain_type === 'subdomain' ? undefined : resolvedFullDomain;
      const gitResult = await cloneGitIntoSubdomain(pleskConfig, resolvedSlug || resolvedFullDomain, git_location, docRoot, siteId || undefined, gitParentDomain);
      if (!gitResult.success) {
        const gitError = gitResult.error || 'Git deployment failed.';
        logSafe('git_deploy_failed', { domain_type, domain_name: resolvedFullDomain, challenge_id_present: true, git_error: gitError });
        gitStatus = 'failed';
        await sr.entities.ChallengeDomain.update(record.id, {
          status: 'failed',
          git_deployment_status: gitStatus,
          error_message: gitError,
        });
        return safeError('GIT_DEPLOY_FAILED', gitError, 'git_deploy', 502);
      }
      gitStatus = 'deployed';
    }

    // ─── 10. SSL installation ──────────────────────────────────────────
    await sr.entities.ChallengeDomain.update(record.id, {
      status: 'ssl_pending',
      plesk_site_id: siteId,
      document_root: docRoot,
      git_deployment_status: gitStatus,
      ssl_status: 'installing',
    });

    let certContent = '';
    let keyContent = '';

    if (sslSource === 'admin_default' && adminSslConfig) {
      // Download cert and key from private storage via signed URLs (server-side only).
      try {
        const certSigned = await sr.integrations.Core.CreateFileSignedUrl({ file_uri: adminSslConfig.certificate_file_reference });
        certContent = await fetch(certSigned.signed_url).then((r) => r.text());
        const keySigned = await sr.integrations.Core.CreateFileSignedUrl({ file_uri: adminSslConfig.private_key_file_reference });
        keyContent = await fetch(keySigned.signed_url).then((r) => r.text());
      } catch {
        logSafe('ssl_admin_download_failed', { domain_type, domain_name: resolvedFullDomain });
        await sr.entities.ChallengeDomain.update(record.id, {
          status: 'failed',
          ssl_status: 'failed',
          error_message: 'Could not load the admin default SSL certificate.',
        });
        return safeError('SSL_INSTALL_FAILED', 'Could not load the admin default SSL certificate.', 'ssl_install', 502);
      }
    } else {
      // Manual cert/key — download from the uploaded file URLs (server-side only).
      try {
        certContent = await fetch(manualCertUrl).then((r) => r.text());
        keyContent = await fetch(manualKeyUrl).then((r) => r.text());
      } catch {
        logSafe('ssl_manual_download_failed', { domain_type, domain_name: resolvedFullDomain });
        await sr.entities.ChallengeDomain.update(record.id, {
          status: 'failed',
          ssl_status: 'failed',
          error_message: 'Could not download the uploaded SSL certificate or key.',
        });
        return safeError('SSL_INSTALL_FAILED', 'Could not download the uploaded SSL certificate or key.', 'ssl_install', 502);
      }
    }

    // Server-side PEM content validation — never trust client-side checks alone.
    const certV = validateCertContent(certContent);
    if (!certV.valid) {
      await sr.entities.ChallengeDomain.update(record.id, {
        status: 'failed',
        ssl_status: 'failed',
        error_message: certV.error!,
      });
      return safeError('SSL_INSTALL_FAILED', certV.error!, 'ssl_install', 400);
    }

    // If no separate key, try extracting from the cert PEM.
    let effectiveKeyContent = keyContent;
    if (!effectiveKeyContent && certContent) {
      const keyMatch = certContent.match(/-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA )?PRIVATE KEY-----/);
      if (keyMatch) effectiveKeyContent = keyMatch[0];
    }

    const keyV = validateKeyContent(effectiveKeyContent);
    if (!keyV.valid) {
      await sr.entities.ChallengeDomain.update(record.id, {
        status: 'failed',
        ssl_status: 'failed',
        error_message: keyV.error!,
      });
      return safeError('SSL_INSTALL_FAILED', keyV.error!, 'ssl_install', 400);
    }

    const sslParentDomain = domain_type === 'subdomain' ? undefined : resolvedFullDomain;
    const sslResult = await installSslCertificate(pleskConfig, resolvedFullDomain, certContent, effectiveKeyContent, siteId || undefined, sslParentDomain);
    if (!sslResult.success) {
      const sslError = sslResult.error || 'SSL installation failed. Please verify the certificate and key files and try again.';
      logSafe('ssl_install_failed', { domain_type, domain_name: resolvedFullDomain, ssl_error: sslError });
      await sr.entities.ChallengeDomain.update(record.id, {
        status: 'failed',
        ssl_status: 'failed',
        error_message: sslError,
      });
      return safeError('SSL_INSTALL_FAILED', sslError, 'ssl_install', 502);
    }

    // ─── 10b. Additional nginx directives for subdomains ──────────────
    // Set the /api/ proxy directives so the subdomain forwards API calls
    // to the Base44 platform (base44.app). The rest of the subdomain serves
    // from its shared document root.
    let nginxStatus: 'configured' | 'pending' = 'pending';
    let nginxError = '';
    if (domain_type === 'subdomain') {
      const proxyResult = await setupSubdomainReverseProxy(pleskConfig, resolvedFullDomain, resolvedSlug);
      logSafe('proxy_setup_result', { domain_name: resolvedFullDomain, success: proxyResult.success, method: proxyResult.method });

      // Health check — verify /api/ proxy is actually serving.
      const health = await checkSubdomainProxyHealth(resolvedFullDomain);
      if (health.healthy) {
        nginxStatus = 'configured';
        nginxError = '';
      } else {
        nginxStatus = 'pending';
        nginxError = 'Awaiting server-side nginx sync';
      }
      logSafe('proxy_health_check', { domain_name: resolvedFullDomain, healthy: health.healthy, status_code: health.statusCode });
    }

    // ─── 11. Final status ─────────────────────────────────────────────
    // Subdomains: DNS is already managed via the base domain, so mark active.
    // Full domains: DNS must be configured externally, so return dns_pending.
    const finalStatus = domain_type === 'subdomain' ? 'active' : 'dns_pending';
    await sr.entities.ChallengeDomain.update(record.id, {
      status: finalStatus,
      plesk_site_id: siteId,
      document_root: docRoot,
      git_deployment_status: gitStatus,
      ssl_status: 'active',
      nginx_status: domain_type === 'subdomain' ? nginxStatus : 'pending',
      error_message: nginxError,
    });

    const safeDomain = {
      id: record.id,
      domain_type,
      full_domain: resolvedFullDomain,
      full_url: `https://${resolvedFullDomain}`,
      status: finalStatus,
      git_deployment_status: gitStatus,
      ssl_status: 'active',
      ssl_source: sslSource,
    };

    if (domain_type === 'full_domain') {
      return Response.json({
        success: true,
        ok: true,
        domain: safeDomain,
        dns_pending: true,
        dns_instructions: `Point the DNS A/AAAA record for ${resolvedFullDomain} to the configured Plesk server IP address. HTTPS will become active once DNS propagates and the certificate is verified.`,
      });
    }

    return Response.json({ success: true, ok: true, domain: safeDomain });
  } catch (error: any) {
    logSafe('internal_error', {
      operation: 'provisionDomain',
      domain_type: typeof body !== 'undefined' ? body?.domain_type : undefined,
      challenge_id_present: typeof body !== 'undefined' ? !!body?.challenge_id : false,
      domain_name: typeof body !== 'undefined' ? (body?.full_domain || body?.slug) : undefined,
      error_category: 'INTERNAL_ERROR',
    });
    return safeError('INTERNAL_ERROR', 'An unexpected error occurred during domain provisioning.', 'persistence', 500);
  }
}