import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getSecret } from '../../shared/secretsEnv.ts';
import { isAdminCaller } from '../../shared/adminAuth.ts';
import { normalizeSlug, validateSlug } from '../../shared/subdomainValidation.ts';
import { getPleskConfig, createPleskSubdomain, cloneGitIntoSubdomain, installSslCertificate, lookupDomain } from '../../shared/pleskApi.ts';

// Creates a challenge-specific subdomain record, provisioning it in Plesk only
// when hosting_mode is 'separate_subdomain'. Admin only.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Admins sign in either through the Base44 platform session or through
    // this app's own Challenge-API login, whose role lives on the local User
    // record. isAdminCaller resolves both — the same check adminChallenge and
    // hostRequestQuote use. Checking base44.auth.me() alone locks out every
    // admin who logged in the normal way.
    const isAdmin = await isAdminCaller(base44, body.session_token || '', getSecret('CHALLENGE_API_KEY'));
    if (!isAdmin) return Response.json({ error: 'Only admins can create subdomains' }, { status: 403 });

    const { challenge_id, slug, hosting_mode, git_location, ssl_cert_url, ssl_key_url } = body;

    if (!challenge_id) return Response.json({ error: 'challenge_id is required' }, { status: 400 });
    if (!slug) return Response.json({ error: 'slug is required' }, { status: 400 });
    if (!hosting_mode || !['wildcard', 'separate_subdomain'].includes(hosting_mode)) {
      return Response.json({ error: 'hosting_mode must be wildcard or separate_subdomain' }, { status: 400 });
    }

    const normalizedSlug = normalizeSlug(slug);
    const validation = validateSlug(normalizedSlug);
    if (!validation.valid) return Response.json({ error: validation.error }, { status: 400 });

    const baseDomain = getSecret('PLESK_BASE_DOMAIN');
    if (!baseDomain) return Response.json({ error: 'PLESK_BASE_DOMAIN secret not set' }, { status: 500 });

    const fullDomain = `${normalizedSlug}.${baseDomain}`;
    const sr = base44.asServiceRole;

    const existing = await sr.entities.ChallengeDomain.filter({
      slug: normalizedSlug,
      base_domain: baseDomain,
    });
    const blockingExisting = (existing || []).filter(
      (d: any) => d.status === 'active' || d.status === 'provisioning' || d.status === 'pending'
    );
    if (blockingExisting.length > 0) {
      return Response.json({ error: 'A subdomain with this slug already exists' }, { status: 409 });
    }

    // Earlier failed attempts on the same slug are retired so the table shows
    // one live row per slug while keeping the audit trail.
    const failedExisting = (existing || []).filter((d: any) => d.status === 'failed');
    for (const f of failedExisting) {
      await sr.entities.ChallengeDomain.update(f.id, { status: 'deleted' });
    }

    let challengeName = '';
    try {
      const challenge = await sr.entities.Challenge.get(challenge_id);
      challengeName = challenge?.title || '';
    } catch {
      return Response.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Pre-check: if the domain already exists in Plesk, fail before creating
    // anything — no DB record or Plesk domain is left orphaned.
    const pleskConfig = getPleskConfig();
    if (hosting_mode === 'separate_subdomain' && pleskConfig) {
      const existingPlesk = await lookupDomain(pleskConfig, fullDomain);
      if (existingPlesk) {
        return Response.json({ error: 'This subdomain already exists in Plesk. Choose a different slug or delete it from Plesk first.' }, { status: 409 });
      }
    }

    const record = await sr.entities.ChallengeDomain.create({
      challenge_id,
      challenge_name: challengeName,
      slug: normalizedSlug,
      base_domain: baseDomain,
      full_domain: fullDomain,
      status: 'provisioning',
      hosting_mode,
      git_location: git_location || '',
      git_deployment_status: git_location ? 'pending' : 'skipped',
      ssl_cert_url: ssl_cert_url || '',
      ssl_key_url: ssl_key_url || '',
      ssl_status: ssl_cert_url ? 'pending' : 'skipped',
    });

    // Wildcard DNS already resolves *.baseDomain, so there is nothing to provision.
    if (hosting_mode === 'wildcard') {
      await sr.entities.ChallengeDomain.update(record.id, { status: 'active' });
      return Response.json({ ok: true, domain: { ...record, status: 'active' } });
    }

    if (!pleskConfig) {
      await sr.entities.ChallengeDomain.update(record.id, {
        status: 'failed',
        error_message: 'Plesk secrets not configured',
      });
      return Response.json({ error: 'Plesk secrets not configured' }, { status: 500 });
    }

    const result = await createPleskSubdomain(pleskConfig, normalizedSlug);
    if (result.success) {
      // Use the real www_root from Plesk's GET /domains lookup — this is
      // where files must go. Without it, git clone has no target path.
      const docRoot = result.documentRoot || '';
      let gitStatus = 'skipped';
      let gitError = '';

      // Best-effort git clone into the document root.
      if (git_location) {
        gitStatus = 'cloning';
        await sr.entities.ChallengeDomain.update(record.id, {
          status: 'active',
          plesk_site_id: result.siteId || '',
          document_root: docRoot,
          git_deployment_status: gitStatus,
        });

        const gitResult = await cloneGitIntoSubdomain(pleskConfig, normalizedSlug, git_location, docRoot, result.siteId || undefined);
        if (gitResult.success) {
          gitStatus = 'deployed';
        } else {
          gitStatus = 'failed';
          gitError = gitResult.error || 'Git clone failed';
        }
      }

      // Best-effort SSL certificate installation.
      // Works with either: (a) separate cert + key files, or (b) a single
      // PEM file that contains both the certificate and the private key.
      let sslStatus = 'skipped';
      let sslError = gitError;
      if (ssl_cert_url) {
        sslStatus = 'installing';
        await sr.entities.ChallengeDomain.update(record.id, {
          status: 'active',
          plesk_site_id: result.siteId || '',
          document_root: docRoot,
          git_deployment_status: gitStatus,
          ssl_status: sslStatus,
        });

        try {
          const certContent = await fetch(ssl_cert_url).then((r) => r.text());
          const keyContent = ssl_key_url ? await fetch(ssl_key_url).then((r) => r.text()) : '';
          const sslResult = await installSslCertificate(pleskConfig, fullDomain, certContent, keyContent, result.siteId || undefined);
          if (sslResult.success) {
            sslStatus = 'installed';
            sslError = '';
          } else {
            sslStatus = 'failed';
            sslError = sslResult.error || 'SSL installation failed';
          }
        } catch (e) {
          sslStatus = 'failed';
          sslError = e?.message || 'Could not download or install SSL certificate';
        }
      }

      await sr.entities.ChallengeDomain.update(record.id, {
        status: 'active',
        plesk_site_id: result.siteId || '',
        document_root: docRoot,
        git_deployment_status: gitStatus,
        ssl_status: sslStatus,
        error_message: sslError,
      });
      return Response.json({
        ok: true,
        domain: { ...record, status: 'active', plesk_site_id: result.siteId, document_root: docRoot, git_deployment_status: gitStatus, ssl_status: sslStatus, error_message: sslError },
      });
    }

    await sr.entities.ChallengeDomain.update(record.id, {
      status: 'failed',
      error_message: result.error || 'Plesk API failed',
    });
    return Response.json({ error: result.error || 'Failed to create subdomain in Plesk' }, { status: 502 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}