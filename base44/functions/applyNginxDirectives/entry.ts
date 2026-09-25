import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getSecret } from '../../shared/secretsEnv.ts';
import { isAdminCaller } from '../../shared/adminAuth.ts';
import { getPleskConfig, setupSubdomainReverseProxy, checkSubdomainProxyHealth } from '../../shared/pleskApi.ts';

// Re-applies the nginx /api/ reverse proxy directives for an existing
// subdomain. Admin only. Uses the Plesk CLI gateway (site, then subdomain
// fallback) with --update-web-server-settings -nginx-additional-directives.
//
// Returns the exact CLI response (code, stdout, stderr) for both attempts
// so the caller can see what Plesk reported. No secrets are included.
export default async function (req: Request): Promise<Response> {
  const logSafe = (operation: string, details: Record<string, any>) => {
    console.log(`[applyNginxDirectives] ${operation}`, JSON.stringify(details));
  };

  let body: any = {};
  try {
    const base44 = createClientFromRequest(req);
    body = await req.json().catch(() => ({}));

    const isAdmin = await isAdminCaller(base44, body.session_token || '', getSecret('CHALLENGE_API_KEY'));
    if (!isAdmin) {
      return Response.json({ success: false, error: 'Only admins can apply nginx directives' }, { status: 403 });
    }

    const { domain_id } = body;
    if (!domain_id) {
      return Response.json({ success: false, error: 'domain_id is required' }, { status: 400 });
    }

    const sr = base44.asServiceRole;
    let domain: any;
    try {
      domain = await sr.entities.ChallengeDomain.get(domain_id);
    } catch {
      return Response.json({ success: false, error: 'Domain record not found' }, { status: 404 });
    }

    if (domain.domain_type !== 'subdomain') {
      return Response.json({ success: false, error: 'nginx directives only apply to subdomains' }, { status: 400 });
    }

    const pleskConfig = getPleskConfig();
    if (!pleskConfig) {
      return Response.json({ success: false, error: 'Plesk is not configured' }, { status: 500 });
    }

    logSafe('starting', { domain_id, full_domain: domain.full_domain });

    // Attempt to write vhost_nginx.conf (may fail — system user lacks
    // write access). The health check below is the source of truth.
    const writeResult = await setupSubdomainReverseProxy(pleskConfig, domain.full_domain, domain.slug);
    logSafe('write_result', { success: writeResult.success, method: writeResult.method });

    // Health check — verify /api/ proxy is actually serving.
    const health = await checkSubdomainProxyHealth(domain.full_domain);
    const nginxStatus = health.healthy ? 'configured' : 'pending';
    const errorMessage = health.healthy ? '' : 'Awaiting server-side nginx sync';

    await sr.entities.ChallengeDomain.update(domain_id, {
      nginx_status: nginxStatus,
      error_message: errorMessage,
    });

    logSafe('completed', {
      domain_id,
      full_domain: domain.full_domain,
      write_success: writeResult.success,
      healthy: health.healthy,
      status_code: health.statusCode,
      nginx_status: nginxStatus,
    });

    return Response.json({
      success: true,
      nginx_status: nginxStatus,
      healthy: health.healthy,
      status_code: health.statusCode,
      error: health.healthy ? undefined : errorMessage,
    });
  } catch (error: any) {
    logSafe('internal_error', {
      domain_id: body?.domain_id,
      error_category: 'INTERNAL_ERROR',
    });
    return Response.json({
      success: false,
      error: 'An unexpected error occurred while applying nginx directives.',
    }, { status: 500 });
  }
}