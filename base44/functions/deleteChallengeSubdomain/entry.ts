import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getPleskConfig, deletePleskSubdomain, deletePleskFullDomain } from '../../shared/pleskApi.ts';
import { getSecret } from '../../shared/secretsEnv.ts';
import { isAdminCaller } from '../../shared/adminAuth.ts';

// Retires a challenge subdomain. The record is soft-deleted so the audit
// history survives; Plesk teardown only applies to separate_subdomain mode.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Accepts both the Base44 platform session and the app's Challenge-API
    // login — see the note in createChallengeSubdomain.
    const isAdmin = await isAdminCaller(base44, body.session_token || '', getSecret('CHALLENGE_API_KEY'));
    if (!isAdmin) return Response.json({ error: 'Only admins can delete subdomains' }, { status: 403 });

    const { domain_id } = body;
    if (!domain_id) return Response.json({ error: 'domain_id is required' }, { status: 400 });

    const sr = base44.asServiceRole;
    const record = await sr.entities.ChallengeDomain.get(domain_id).catch(() => null);
    if (!record) return Response.json({ error: 'Domain record not found' }, { status: 404 });
    if (record.status === 'deleted') return Response.json({ error: 'Domain already deleted' }, { status: 400 });

    // Delete from Plesk for active separate_subdomain or full_domain records.
    const needsPleskTeardown =
      (record.hosting_mode === 'separate_subdomain' || record.hosting_mode === 'full_domain') &&
      (record.status === 'active' || record.status === 'dns_pending' || record.status === 'deployed' || record.status === 'ssl_pending');

    if (needsPleskTeardown) {
      const pleskConfig = getPleskConfig();
      if (pleskConfig) {
        const result = record.hosting_mode === 'full_domain'
          ? await deletePleskFullDomain(pleskConfig, record.full_domain)
          : await deletePleskSubdomain(pleskConfig, record.slug, record.plesk_site_id || undefined);
        // A Plesk failure still retires the record — leaving it active would
        // strand the row — but the reason is kept and reported to the caller.
        if (!result.success) {
          await sr.entities.ChallengeDomain.update(domain_id, {
            status: 'deleted',
            error_message: `Plesk delete warning: ${result.error || 'unknown error'}`,
          });
          return Response.json({ ok: true, warning: result.error });
        }
      }
    }

    await sr.entities.ChallengeDomain.update(domain_id, { status: 'deleted' });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}