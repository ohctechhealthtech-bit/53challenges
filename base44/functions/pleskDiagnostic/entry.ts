import { getSecret } from '../../shared/secretsEnv.ts';
import { getPleskConfig, getServerInfo, listDomains } from '../../shared/pleskApi.ts';

// Diagnostic: tests Plesk REST API v2 connectivity and reports which
// operations are available. Uses the shared pleskApi.ts methods so the
// diagnostic exercises the same code paths as the provisioning functions.
export default async function () {
  const apiKey = getSecret('PLESK_API_KEY');
  const adminPassword = getSecret('PLESK_ADMIN_PASSWORD');
  const adminUser = getSecret('PLESK_ADMIN_USER', 'admin');
  const baseUrl = getSecret('PLESK_BASE_URL').replace(/\/+$/, '');

  const diag: any = {
    baseUrl,
    adminUser,
    apiKeyLoaded: !!apiKey,
    adminPasswordLoaded: !!adminPassword,
  };

  if (!baseUrl) return Response.json({ ...diag, error: 'PLESK_BASE_URL not set' });

  const cfg = getPleskConfig();
  if (!cfg) {
    return Response.json({ ...diag, error: 'Plesk not configured — need PLESK_BASE_URL, PLESK_BASE_DOMAIN, and either PLESK_API_KEY or PLESK_ADMIN_PASSWORD' });
  }

  // Test 1: GET /server — REST API v2 connectivity check
  const serverRes = await getServerInfo(cfg);
  diag.serverCheck = serverRes.success ? 'ok' : 'failed';
  if (serverRes.success) {
    diag.serverInfo = serverRes.server;
  } else {
    diag.serverError = serverRes.error;
  }

  // Test 2: GET /domains — verify domain listing works (read-only, safe)
  const domainsRes = await listDomains(cfg);
  diag.domainsCheck = domainsRes.success ? 'ok' : 'failed';
  if (domainsRes.success) {
    diag.domainCount = domainsRes.domains.length;
    diag.domainNames = domainsRes.domains.map((d: any) => d.name || d.fqdn).filter(Boolean).slice(0, 20);
  } else {
    diag.domainsError = domainsRes.error;
  }

  // Summary verdict
  diag.restApiV2Ready = serverRes.success && domainsRes.success;
  diag.canProvision = diag.restApiV2Ready;

  return Response.json(diag);
}