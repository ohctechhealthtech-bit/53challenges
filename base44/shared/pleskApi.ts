// Plesk provisioning via REST API v2 + CLI gateway fallback.
//
// REST API v2 (Plesk RESTful API, OAS 3.0, server: /api/v2):
//   GET  /server              — server info / connectivity check
//   GET  /domains             — list all domains (find by name, get IDs + www_root)
//   POST /domains             — create a domain (subdomain-as-domain)
//   GET  /domains/{id}        — get domain details (document root, hosting info)
//   DELETE /domains/{id}      — delete a domain
//   POST /domains/{id}/exec   — execute a shell command on a domain (requires shell access)
//   PUT  /domains/{id}/fs/content — upload file contents
//   POST /domains/{id}/fs/mkdir   — create a directory
//
// CLI gateway (for operations with no REST equivalent):
//   POST /cli/{tool}/call  — subdomain --create/--remove, certificate, site --update
//
// Auth: HTTP Basic Auth (admin:password or admin:apiKey).
import { getSecret } from './secretsEnv.ts';

export type PleskConfig = {
  baseUrl: string;
  baseDomain: string;
  apiKey: string;
  documentRoot: string;
};

/** Returns null when Plesk is not configured. */
export function getPleskConfig(): PleskConfig | null {
  const baseUrl = getSecret('PLESK_BASE_URL').replace(/\/+$/, '');
  const baseDomain = getSecret('PLESK_BASE_DOMAIN');
  const apiKey = getSecret('PLESK_API_KEY');
  const adminPassword = getSecret('PLESK_ADMIN_PASSWORD');
  if (!baseUrl || !baseDomain || (!apiKey && !adminPassword)) return null;
  return { baseUrl, baseDomain, apiKey, documentRoot: getSecret('PLESK_DOCUMENT_ROOT') };
}

function authHeaders(cfg: PleskConfig): Record<string, string> {
  const adminUser = getSecret('PLESK_ADMIN_USER', 'admin');
  const adminPassword = getSecret('PLESK_ADMIN_PASSWORD');
  const password = adminPassword || cfg.apiKey;
  const credentials = btoa(`${adminUser}:${password}`);
  return {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

/** Generates a strong random password for system/FTP users (server-side only). */
function generateStrongPassword(length = 20): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

// ─── REST API v2 helpers ──────────────────────────────────────────────

async function restRequest(
  cfg: PleskConfig,
  method: string,
  path: string,
  body?: any,
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const url = `${cfg.baseUrl}/api/v2${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: authHeaders(cfg),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
  } catch (e: any) {
    return { ok: false, status: 0, data: null, error: `Could not reach Plesk: ${e?.message || e}` };
  }

  if (res.status === 401) {
    return { ok: false, status: 401, data: null, error: 'Plesk rejected credentials (HTTP 401).' };
  }
  if (res.status === 403) {
    let text = '';
    try { text = await res.text(); } catch { /* ignore */ }
    let code = '';
    try { const j = JSON.parse(text); code = j?.code || j?.error?.code || ''; } catch { /* ignore */ }
    if (code === 1003 || text.includes('1003')) {
      return { ok: false, status: 403, data: null, error: 'Plesk API key IP restriction (error 1003). Set "Allow from all IPs" in Plesk API Keys.' };
    }
    return { ok: false, status: 403, data: null, error: `Plesk HTTP 403${code ? ` (code ${code})` : ''}` };
  }

  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }

  if (!res.ok) {
    const msg = json?.message || json?.error?.message || text.slice(0, 200);
    return { ok: false, status: res.status, data: json, error: `Plesk HTTP ${res.status}: ${msg}` };
  }

  return { ok: true, status: res.status, data: json };
}

/** GET /server — server info for connectivity diagnostics. */
export async function getServerInfo(cfg: PleskConfig) {
  const res = await restRequest(cfg, 'GET', '/server');
  if (!res.ok) return { success: false, error: res.error };
  return { success: true, server: res.data };
}

/** GET /ips — list all IP addresses available on the server. */
export async function listIps(cfg: PleskConfig) {
  const res = await restRequest(cfg, 'GET', '/ips');
  if (!res.ok) return { success: false, error: res.error, ips: [] };
  const ips = Array.isArray(res.data) ? res.data : (res.data?.ips || []);
  return { success: true, ips };
}

/** GET /domains — list all domains. */
export async function listDomains(cfg: PleskConfig) {
  const res = await restRequest(cfg, 'GET', '/domains');
  if (!res.ok) return { success: false, error: res.error, domains: [] };
  const domains = Array.isArray(res.data) ? res.data : (res.data?.domains || []);
  return { success: true, domains };
}

/** Finds a domain by its full name via GET /domains. Returns { id, www_root } or null. */
export async function lookupDomain(cfg: PleskConfig, fullDomain: string): Promise<{ id: string; wwwRoot: string } | null> {
  const res = await listDomains(cfg);
  if (!res.success) return null;
  const match = res.domains.find((d: any) => d.name === fullDomain || d.fqdn === fullDomain);
  if (!match) return null;
  return {
    id: String(match.id || match._id || ''),
    wwwRoot: match.www_root || match.document_root || '',
  };
}

/**
 * Creates a subdomain under the existing base domain using CLI
 * subdomain --create. POST /domains is NOT used because it creates a
 * top-level domain and requires full hosting settings (IP, plan, ftp_login,
 * etc.) that we don't have. CLI subdomain --create is simpler and creates
 * a subdomain under the existing subscription.
 *
 * After creation, looks up the PARENT domain via GET /domains to get its
 * www_root, then constructs the subdomain's document root as
 * {parent_www_root}/{slug}. The parent domain's ID is returned as siteId
 * for use with POST /domains/{id}/exec (subdomains share the parent's
 * system user).
 */
export async function createPleskSubdomain(cfg: PleskConfig, slug: string) {
  const fullDomain = `${slug}.${cfg.baseDomain}`;

  // Look up the PARENT domain first. We need its www_root to compute the
  // correct relative path for -www-root (Plesk treats it as relative to the
  // subscription home, NOT the document root — passing '/' or an absolute
  // path causes a doubled path error).
  const parentLookup = await lookupDomain(cfg, cfg.baseDomain);
  const parentWwwRoot = parentLookup?.wwwRoot || '';

  // PLESK_SUBDOMAIN_WWW_ROOT secret overrides the document root. If set to
  // an absolute path, the last path component is extracted (e.g. 'httpdocs'
  // from '/var/www/vhosts/domain.com/httpdocs'). If set to a relative path
  // (e.g. 'challenge'), it's used as-is. Default: the parent's www_root
  // folder name, so the subdomain serves from the SAME folder as the main
  // domain.
  const configuredWwwRoot = getSecret('PLESK_SUBDOMAIN_WWW_ROOT', '');

  let relativeWwwRoot: string;
  if (configuredWwwRoot && configuredWwwRoot !== '/') {
    if (configuredWwwRoot.startsWith('/')) {
      // Absolute path — Plesk expects relative, so take the last component.
      relativeWwwRoot = configuredWwwRoot.split('/').filter(Boolean).pop() || 'httpdocs';
    } else {
      relativeWwwRoot = configuredWwwRoot;
    }
  } else {
    // Default: use the parent's www_root folder name (e.g. 'httpdocs').
    relativeWwwRoot = parentWwwRoot
      ? (parentWwwRoot.split('/').filter(Boolean).pop() || 'httpdocs')
      : 'httpdocs';
  }

  // CLI subdomain --create — creates a subdomain under the existing base domain.
  const cliParams = ['--create', slug, '-domain', cfg.baseDomain, '-www-root', relativeWwwRoot];
  const cliRes = await callCli(cfg, cliParams, 'subdomain');

  let alreadyExists = false;
  if (!cliRes.ok) {
    if (/already exists/i.test(cliRes.error || '')) {
      alreadyExists = true;
      // Best-effort: update the existing subdomain's www-root to match.
      await callCli(cfg, ['--update', slug, '-domain', cfg.baseDomain, '-www-root', relativeWwwRoot], 'subdomain').catch(() => {});
    } else {
      return { success: false, error: cliRes.error };
    }
  }

  // The subdomain serves from the same document root as the parent domain.
  if (parentWwwRoot) {
    return { success: true, siteId: parentLookup.id, documentRoot: parentWwwRoot, fullDomain, alreadyExists };
  }

  // Fallback if parent lookup fails — use the configured document root.
  const docRoot = cfg.documentRoot || '';
  return { success: true, siteId: '', documentRoot: docRoot, fullDomain, alreadyExists };
}

/**
 * Creates a full independent domain via REST POST /api/v2/domains with complete
 * hosting configuration. Unlike subdomains (which live under the base domain's
 * subscription), a full domain gets its own subscription with a generated system
 * user, assigned IP, and optional service plan.
 *
 * Required server-side config (read from secrets, never from the client):
 * - PLESK_DEFAULT_IP — the IP address to assign (required for standalone)
 * - PLESK_SERVICE_PLAN — optional service plan name
 * - PLESK_PARENT_WEBSPACE — optional: attach to an existing webspace
 *
 * Returns { success, siteId, documentRoot, fullDomain, alreadyExists }.
 * On failure, error is a safe code (e.g. CONFIG_MISSING_DEFAULT_IP).
 */
export async function createPleskFullDomain(
  cfg: PleskConfig,
  fullDomain: string,
  options?: { defaultIp?: string; servicePlan?: string; parentWebspace?: string },
) {
  const defaultIp = options?.defaultIp || getSecret('PLESK_DEFAULT_IP');
  const servicePlan = options?.servicePlan || getSecret('PLESK_SERVICE_PLAN');
  const parentWebspace = options?.parentWebspace || getSecret('PLESK_PARENT_WEBSPACE') || cfg.baseDomain;

  if (!defaultIp && !parentWebspace) {
    return {
      success: false,
      error: 'CONFIG_MISSING_DEFAULT_IP',
      message: 'Server config missing: PLESK_DEFAULT_IP (or PLESK_PARENT_WEBSPACE) is required to create independent domains.',
    };
  }

  // ─── Strategy B (primary): CLI domain/site --create -webspace-name ──
  // Tries `domain --create` first (lower permission requirements), then
  // falls back to `site --create` (includes hosting). Both attach the
  // new domain to the existing subscription's webspace, sharing its IP
  // and system user.
  let cliRes = await callCli(cfg, ['--create', fullDomain, '-webspace-name', parentWebspace], 'domain');
  if (!cliRes.ok && !/already exists/i.test(cliRes.error || '')) {
    // Try `site --create` as a fallback (creates domain + hosting).
    cliRes = await callCli(cfg, ['--create', fullDomain, '-webspace-name', parentWebspace], 'site');
  }
  let alreadyExists = false;
  if (!cliRes.ok) {
    if (/already exists/i.test(cliRes.error || '')) {
      alreadyExists = true;
    } else {
      // ─── Strategy A (fallback): REST POST /api/v2/domains ─────────
      // Try REST with full hosting configuration if CLI fails.
      const baseLogin = fullDomain.replace(/[^a-z0-9]/g, '').slice(0, 12) || 'domain';
      const suffix = Math.random().toString(36).slice(2, 6);
      const ftpLogin = `${baseLogin}${suffix}`;
      const ftpPassword = generateStrongPassword();

      let resolvedIp = defaultIp;
      if (defaultIp) {
        const ipList = await listIps(cfg);
        if (ipList.success && ipList.ips.length > 0) {
          const configuredAvailable = ipList.ips.find((ip: any) => ip.ipAddress === defaultIp);
          if (!configuredAvailable) {
            const firstIp = ipList.ips[0];
            resolvedIp = firstIp?.ipAddress || firstIp?.ip || '';
          }
        }
      }

      const body: any = {
        name: fullDomain,
        hosting_type: 'virtual',
        hosting_settings: {
          ftp_login: ftpLogin,
          ftp_password: ftpPassword,
        },
      };
      if (resolvedIp) body.ipv4 = [resolvedIp];
      if (servicePlan) body.plan = { name: servicePlan };

      let res = await restRequest(cfg, 'POST', '/domains', body);
      if (!res.ok && resolvedIp && /ip address.*not available/i.test(res.error || '')) {
        const bodyNoIp = { ...body };
        delete bodyNoIp.ipv4;
        res = await restRequest(cfg, 'POST', '/domains', bodyNoIp);
      }

      if (!res.ok) {
        const err = res.error || '';
        if (/already exists/i.test(err)) {
          const lookup = await lookupDomain(cfg, fullDomain);
          if (lookup) return { success: true, siteId: lookup.id, documentRoot: lookup.wwwRoot, fullDomain, alreadyExists: true };
        }
        if (/ip.*required|ip_address.*required/i.test(err)) {
          return { success: false, error: 'CONFIG_MISSING_DEFAULT_IP', message: 'Plesk requires a default IP address.' };
        }
        if (/plan.*not found|service plan/i.test(err)) {
          return { success: false, error: 'CONFIG_MISSING_PLAN', message: 'The configured service plan was not found in Plesk.' };
        }
        if (/webspace.*not found|subscription.*not found/i.test(err)) {
          return { success: false, error: 'CONFIG_MISSING_WEBSPACE', message: 'The configured parent webspace was not found in Plesk.' };
        }
        // Plesk error 1024 = operation not available for current license.
        if (/code 1024|1024|not available|permission/i.test(err)) {
          return { success: false, error: 'PLESK_SUBSCRIPTION_REQUIRED', message: 'The Plesk license does not allow creating new independent domains. Use a subdomain instead, or upgrade the Plesk license to support additional domains.' };
        }
        if (/subscription.*required|limit.*exceeded/i.test(err)) {
          return { success: false, error: 'PLESK_SUBSCRIPTION_REQUIRED', message: 'Plesk requires a subscription to create this domain.' };
        }
        return { success: false, error: err };
      }

      const lookup = await lookupDomain(cfg, fullDomain);
      return {
        success: true,
        siteId: lookup?.id || '',
        documentRoot: lookup?.wwwRoot || '',
        fullDomain,
        alreadyExists: false,
      };
    }
  }

  // CLI succeeded — look up the created domain.
  const domainLookup = await lookupDomain(cfg, fullDomain);
  let docRoot = '';
  if (domainLookup?.wwwRoot) {
    docRoot = domainLookup.wwwRoot;
  } else {
    // Fallback: Plesk convention is {parent_www_root}/{domain}
    const parentLookup = await lookupDomain(cfg, parentWebspace);
    if (parentLookup?.wwwRoot) {
      docRoot = `${parentLookup.wwwRoot.replace(/\/+$/, '')}/${fullDomain}`;
    }
  }

  return {
    success: true,
    siteId: domainLookup?.id || '',
    documentRoot: docRoot,
    fullDomain,
    alreadyExists,
  };
}

/**
 * Deletes a subdomain via CLI subdomain --remove. Always uses CLI because
 * the subdomain was created via CLI (not POST /domains), so DELETE
 * /domains/{id} would target the parent subscription, not the subdomain.
 */
export async function deletePleskSubdomain(cfg: PleskConfig, slug: string, domainId?: string) {
  const cliRes = await callCli(cfg, ['--remove', slug, '-domain', cfg.baseDomain], 'subdomain');
  if (!cliRes.ok) return { success: false, error: cliRes.error };
  return { success: true };
}

/**
 * Deletes a full independent domain via CLI site --remove.
 */
export async function deletePleskFullDomain(cfg: PleskConfig, fullDomain: string) {
  const cliRes = await callCli(cfg, ['--remove', fullDomain], 'site');
  if (!cliRes.ok) return { success: false, error: cliRes.error };
  return { success: true };
}

/**
 * Clones a git repository into the subdomain's document root.
 *
 * Since POST /domains/{id}/exec requires shell access (which is /bin/false
 * by default), we temporarily enable /bin/bash via the site CLI, run
 * git clone via exec, then restore the original shell.
 *
 * If enabling shell or exec fails, uploads a placeholder index.html
 * so the subdomain serves something while the user deploys manually.
 */
export async function cloneGitIntoSubdomain(
  cfg: PleskConfig,
  slug: string,
  gitUrl: string,
  documentRoot: string,
  domainId?: string,
  parentDomain?: string,
) {
  // Shell access is controlled at the SUBSCRIPTION level. Always enable/disable
  // shell on the base domain (the subscription owner), never on individual
  // addon domains — `subscription --update <addon-domain>` fails because
  // addon domains are not subscriptions.
  const subscriptionDomain = cfg.baseDomain;

  // For domain ID lookup: full domains look up themselves; subdomains look
  // up the parent (subdomains don't appear in GET /domains).
  const lookupName = parentDomain || cfg.baseDomain;

  let id = domainId || '';
  let docRoot = documentRoot || '';
  if (!id || !docRoot) {
    const parentLookup = await lookupDomain(cfg, lookupName);
    if (parentLookup) {
      id = id || parentLookup.id;
      docRoot = docRoot || `${parentLookup.wwwRoot.replace(/\/+$/, '')}/${slug}`;
    }
  }

  if (!docRoot) return { success: false, error: 'Could not determine the document root for this domain' };
  if (!id) return { success: false, error: 'Could not find the Plesk domain ID for this domain' };

  // Enable shell on the parent subscription, then run git clone via exec.
  // The shell is ALWAYS reverted to /bin/false in the finally block below,
  // even if git clone, placeholder upload, or any step throws.
  let shellEnabled = false;
  try {
    // Step 1: Enable shell access on the parent subscription so exec can run.
    const enableShell = await callCli(cfg, ['--update', subscriptionDomain, '-shell', '/bin/bash'], 'subscription');
    if (!enableShell.ok) {
      await uploadPlaceholder(cfg, id, docRoot, gitUrl);
      return { success: false, error: `Could not enable shell access on ${subscriptionDomain}: ${enableShell.error}. Please deploy the repository manually via SFTP or Plesk File Manager.` };
    }
    shellEnabled = true;

    // Step 2: Run git clone via exec.
    const shellCmd = `rm -rf ${docRoot}/* ${docRoot}/.[!.]* 2>/dev/null; cd ${docRoot} && git clone --depth 1 ${gitUrl} .`;
    const execRes = await restRequest(cfg, 'POST', `/domains/${id}/exec`, {
      command: ['bash', '-c', shellCmd],
    });

    if (execRes.ok) {
      return { success: true, method: 'exec' };
    }

    // exec failed — upload placeholder and return error.
    await uploadPlaceholder(cfg, id, docRoot, gitUrl);
    return { success: false, error: `Git clone command failed: ${execRes.error}. Please deploy the repository manually via SFTP or Plesk File Manager.` };
  } finally {
    // Step 3: Always restore /bin/false shell.
    if (shellEnabled) {
      await callCli(cfg, ['--update', subscriptionDomain, '-shell', '/bin/false'], 'subscription').catch(() => {});
    }
  }
}

/** Uploads a placeholder index.html so the subdomain serves something. */
async function uploadPlaceholder(cfg: PleskConfig, domainId: string, docRoot: string, gitUrl: string) {
  const placeholderHtml = `<!DOCTYPE html>
<html><head><title>Deployment Pending</title></head><body>
<h1>Repository deployment pending</h1>
<p>Git repository: ${gitUrl}</p>
<p>The repository could not be automatically deployed. Please deploy manually via SFTP or the Plesk File Manager.</p>
</body></html>`;
  try {
    await restRequest(cfg, 'PUT', `/domains/${domainId}/fs/content`, {
      path: `${docRoot}/index.html`,
      content: placeholderHtml,
    });
  } catch {
    // Best-effort — don't fail the whole operation if placeholder upload fails.
  }
}

/**
 * Installs an SSL certificate via CLI certificate tool.
 * Handles PEM files that contain both the certificate and private key.
 *
 * The CLI certificate tool expects FILE PATHS on the Plesk server (not
 * content), and uses -key-file/-cert-file options. We write the cert/key
 * files to /tmp/ on the server via the exec endpoint (shell access is
 * temporarily enabled on the parent subscription, same as git clone),
 * then run the CLI with file paths.
 */
export async function installSslCertificate(
  cfg: PleskConfig,
  domain: string,
  certContent: string,
  keyContent: string,
  parentDomainId?: string,
  parentDomain?: string,
) {
  // Shell access is at the subscription level — always use the base domain.
  const subscriptionDomain = cfg.baseDomain;
  // Certificate is installed on the specific domain (full domain or parent).
  const certDomain = parentDomain || cfg.baseDomain;

  // If no separate key was provided, try to extract it from the cert PEM.
  let cert = certContent;
  let key = keyContent;

  if (!key && cert) {
    const keyMatch = cert.match(/-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA )?PRIVATE KEY-----/);
    if (keyMatch) {
      key = keyMatch[0];
      cert = cert.replace(keyMatch[0], '').trim();
    }
  }

  if (!cert || !key) {
    return { success: false, error: 'SSL certificate or private key not found. Please provide both the certificate (.pem/.crt) and the private key (.key), or a single PEM file containing both.' };
  }

  // Resolve the domain ID (for exec).
  let id = parentDomainId || '';
  if (!id) {
    const parentLookup = await lookupDomain(cfg, certDomain);
    if (parentLookup) id = parentLookup.id;
  }
  if (!id) return { success: false, error: 'Could not find the parent domain for SSL installation' };

  const certName = `ssl-${domain.replace(/\./g, '-')}`;
  const certPath = `/tmp/${certName}.crt`;
  const keyPath = `/tmp/${certName}.key`;

  // Base64-encode the cert and key so they survive shell quoting safely.
  const certB64 = btoa(cert);
  const keyB64 = btoa(key);

  // Enable shell on the parent subscription, write files via exec, install
  // the certificate, then always restore /bin/false in the finally block.
  let shellEnabled = false;
  try {
    const enableShell = await callCli(cfg, ['--update', subscriptionDomain, '-shell', '/bin/bash'], 'subscription');
    if (!enableShell.ok) {
      return { success: false, error: `Could not enable shell access for SSL: ${enableShell.error}` };
    }
    shellEnabled = true;

    // Write cert file via exec (base64 decode to avoid quoting issues).
    const certExec = await restRequest(cfg, 'POST', `/domains/${id}/exec`, {
      command: ['bash', '-c', `echo '${certB64}' | base64 -d > ${certPath}`],
    });
    if (!certExec.ok) return { success: false, error: `Could not write certificate file: ${certExec.error}` };

    // Write key file via exec.
    const keyExec = await restRequest(cfg, 'POST', `/domains/${id}/exec`, {
      command: ['bash', '-c', `echo '${keyB64}' | base64 -d > ${keyPath}`],
    });
    if (!keyExec.ok) return { success: false, error: `Could not write private key file: ${keyExec.error}` };

    // Create the certificate using the uploaded file paths.
    const createRes = await callCli(cfg, ['--create', certName, '-domain', certDomain, '-key-file', keyPath, '-cert-file', certPath], 'certificate');
    if (!createRes.ok) return { success: false, error: createRes.error };

    // Assign the certificate to the domain and enable SSL.
    // Uses subscription --update with -certificate-name and -ssl true
    // (site --update does not recognize -ssl-cert/-ssl-on options).
    const assignRes = await callCli(cfg, ['--update', domain, '-certificate-name', certName, '-ssl', 'true'], 'subscription');
    if (!assignRes.ok) return { success: false, error: assignRes.error };

    return { success: true };
  } finally {
    if (shellEnabled) {
      await callCli(cfg, ['--update', subscriptionDomain, '-shell', '/bin/false'], 'subscription').catch(() => {});
    }
  }
}

/**
 * Sets the Additional nginx directives for a subdomain so that /api/
 * requests are proxied to the Base44 platform (base44.app). The rest of
 * the subdomain serves from its own document root (shared with the main
 * domain), so the Base44 app's static files load directly while API calls
 * are forwarded to the platform.
 *
 * Approach 1 (primary): Plesk CLI `site --update <full_domain>` with the
 * `-additional-nginx-directives` flag. This runs as the Plesk admin user
 * (via the CLI gateway), so it has permission to write to the system
 * config directory. It also stores the directives in the Plesk database,
 * so they appear in the "Apache & nginx Settings → Additional nginx
 * directives" UI field.
 *
 * Approach 2 (fallback): Write the directives directly to the
 * vhost_nginx.conf file via exec. This runs as the domain's system user,
 * which may lack write access to /var/www/vhosts/system/. Used only if
 * the CLI approach fails.
 */
export async function setupSubdomainReverseProxy(
  cfg: PleskConfig,
  fullDomain: string,
  slug: string,
) {
  // Attempt to write nginx /api/ proxy directives to the subdomain's
  // vhost_nginx.conf file. This requires write access to
  // /var/www/vhosts/system/<full_domain>/conf/, which the subscription
  // system user typically lacks. If the write fails, provisioning is NOT
  // failed — the directives will be applied by a root-level Plesk scheduled
  // task on the server (outside this app). The health check
  // (checkSubdomainProxyHealth) is the source of truth for nginx_status.

  const nginxConfPath = `/var/www/vhosts/system/${fullDomain}/conf/vhost_nginx.conf`;

  const nginxDirectives = `location /api/ {
    proxy_pass https://base44.app;
    proxy_set_header Host base44.app;
    proxy_ssl_server_name on;
    proxy_ssl_name base44.app;
    proxy_ssl_protocols TLSv1.2 TLSv1.3;
    proxy_http_version 1.1;
    proxy_redirect off;
    proxy_read_timeout 60s;
}
`;

  const parentLookup = await lookupDomain(cfg, cfg.baseDomain);
  if (!parentLookup?.id) {
    return { success: false, error: 'Awaiting server-side nginx sync', method: 'failed' };
  }

  const directivesB64 = btoa(nginxDirectives);

  let shellEnabled = false;
  try {
    const enableShell = await callCli(cfg, ['--update', cfg.baseDomain, '-shell', '/bin/bash'], 'subscription');
    if (!enableShell.ok) {
      return { success: false, error: 'Awaiting server-side nginx sync', method: 'failed' };
    }
    shellEnabled = true;

    // Attempt to write vhost_nginx.conf and reconfigure nginx.
    const writeCmd = `echo '${directivesB64}' | base64 -d > ${nginxConfPath} 2>&1 && /usr/local/psa/admin/bin/httpdmng --reconfigure-domain ${fullDomain} 2>&1 && echo WRITTEN`;
    const writeRes = await restRequest(cfg, 'POST', `/domains/${parentLookup.id}/exec`, {
      command: ['bash', '-c', writeCmd],
    });

    if (writeRes.ok) {
      const output = String(writeRes.data?.stdout || '').trim();
      if (output.includes('WRITTEN')) {
        return { success: true, method: 'vhost-nginx' };
      }
    }

    return { success: false, error: 'Awaiting server-side nginx sync', method: 'failed' };
  } finally {
    if (shellEnabled) {
      await callCli(cfg, ['--update', cfg.baseDomain, '-shell', '/bin/false'], 'subscription').catch(() => {});
    }
  }
}

const PROXY_HEALTH_APP_ID = '6a683318ec3c2cc96e77b420';

/**
 * Health check: fetches the public settings endpoint through the
 * subdomain's /api/ proxy. Returns healthy=true only if the response
 * is HTTP 200 with JSON content-type.
 */
export async function checkSubdomainProxyHealth(
  fullDomain: string,
): Promise<{ healthy: boolean; statusCode: number }> {
  const url = `https://${fullDomain}/api/apps/public/prod/public-settings/by-id/${PROXY_HEALTH_APP_ID}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json' },
    });
    if (res.status === 200) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return { healthy: true, statusCode: 200 };
      }
    }
    return { healthy: false, statusCode: res.status };
  } catch {
    return { healthy: false, statusCode: 0 };
  }
}

/**
 * Removes the /api/ directory (PHP proxy + .htaccess) that was previously
 * written to the shared document root by the deprecated PHP-proxy
 * approach. Called once during cleanup.
 */
export async function cleanupProxyFilesFromDocRoot(
  cfg: PleskConfig,
): Promise<{ success: boolean; error?: string }> {
  const parentLookup = await lookupDomain(cfg, cfg.baseDomain);
  if (!parentLookup?.id || !parentLookup.wwwRoot) {
    return { success: false, error: 'Could not find parent domain' };
  }

  const docRoot = parentLookup.wwwRoot.replace(/\/+$/, '');
  const apiDir = `${docRoot}/api`;

  let shellEnabled = false;
  try {
    const enableShell = await callCli(cfg, ['--update', cfg.baseDomain, '-shell', '/bin/bash'], 'subscription');
    if (!enableShell.ok) {
      return { success: false, error: enableShell.error };
    }
    shellEnabled = true;

    const rmCmd = `rm -rf ${apiDir} 2>&1 && echo REMOVED`;
    const rmRes = await restRequest(cfg, 'POST', `/domains/${parentLookup.id}/exec`, {
      command: ['bash', '-c', rmCmd],
    });

    if (!rmRes.ok) {
      return { success: false, error: rmRes.error };
    }

    const output = String(rmRes.data?.stdout || '').trim();
    if (output.includes('REMOVED')) {
      return { success: true };
    }
    return { success: false, error: output || 'Could not remove /api/ directory' };
  } finally {
    if (shellEnabled) {
      await callCli(cfg, ['--update', cfg.baseDomain, '-shell', '/bin/false'], 'subscription').catch(() => {});
    }
  }
}

// ─── CLI gateway helper ───────────────────────────────────────────────

async function callCli(cfg: PleskConfig, params: string[], tool = 'subdomain') {
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/api/v2/cli/${tool}/call`, {
      method: 'POST',
      headers: authHeaders(cfg),
      body: JSON.stringify({ params }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e: any) {
    return { ok: false, error: `Could not reach Plesk CLI: ${e?.message || e}` };
  }

  if (res.status === 401) return { ok: false, error: 'Plesk rejected credentials (HTTP 401).' };
  if (res.status === 403) {
    let body = '';
    try { body = await res.text(); } catch { /* ignore */ }
    let code = '';
    try { const j = JSON.parse(body); code = j?.error?.code || j?.code || ''; } catch { /* ignore */ }
    if (code === '1003' || body.includes('1003')) {
      return { ok: false, error: 'Plesk API key IP restriction (error 1003).' };
    }
    return { ok: false, error: `Plesk HTTP 403${code ? ` (code ${code})` : ''}` };
  }
  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch { /* ignore */ }
    return { ok: false, error: `Plesk CLI HTTP ${res.status}: ${body.slice(0, 200)}` };
  }

  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }

  const cliCode = typeof json?.code === 'number' ? json.code : 0;
  const cliStdout = String(json?.stdout || '');
  const cliStderr = String(json?.stderr || '');
  if (cliCode !== 0) {
    const detail = (cliStderr || cliStdout).trim();
    return { ok: false, error: detail || `Plesk CLI exited with code ${cliCode}`, code: cliCode, stdout: cliStdout, stderr: cliStderr };
  }
  return { ok: true, stdout: cliStdout, stderr: cliStderr, code: cliCode };
}