import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { getSecret } from '../../shared/secretsEnv.ts';
import { isAdminCaller } from '../../shared/adminAuth.ts';

// Manage the admin default SSL configuration used for all challenge subdomains.
// Admin only. File references are stored in private storage and never returned
// to the client — only metadata (name, status, expiry, updated date) is exposed.
//
// Actions:
//   get    — returns metadata for the active config (or null)
//   save   — uploads new cert/key to private storage, creates a new active
//            config, deactivates all others. Requires cert+key file content
//            in the request body (base64-encoded by the client SDK upload).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const isAdmin = await isAdminCaller(base44, body.session_token || '', getSecret('CHALLENGE_API_KEY'));
    if (!isAdmin) return Response.json({ error: 'Only admins can manage default SSL' }, { status: 403 });

    const action = body.action || 'get';
    const sr = base44.asServiceRole;

    if (action === 'get') {
      const configs = await sr.entities.AdminSslConfiguration.filter({ is_active: true });
      const active = (configs || [])[0];
      if (!active) return Response.json({ ok: true, configuration: null });

      // Return metadata only — never file references or file content.
      return Response.json({
        ok: true,
        configuration: {
          id: active.id,
          name: active.name,
          certificate_status: active.certificate_status,
          expires_at: active.expires_at || '',
          is_active: true,
          updated_at: active.updated_date || '',
          updated_by: active.updated_by || '',
        },
      });
    }

    if (action === 'save') {
      const { name, cert_content_b64, key_content_b64, expires_at } = body;
      if (!name) return Response.json({ error: 'Certificate display name is required' }, { status: 400 });
      if (!cert_content_b64) return Response.json({ error: 'SSL certificate file is required' }, { status: 400 });
      if (!key_content_b64) return Response.json({ error: 'SSL private key file is required' }, { status: 400 });

      // Decode and validate PEM markers before storing.
      let certText = '';
      let keyText = '';
      try {
        certText = atob(cert_content_b64);
      } catch {
        return Response.json({ error: 'Could not decode certificate file' }, { status: 400 });
      }
      try {
        keyText = atob(key_content_b64);
      } catch {
        return Response.json({ error: 'Could not decode private key file' }, { status: 400 });
      }

      if (!certText.includes('-----BEGIN CERTIFICATE-----')) {
        return Response.json({ error: 'Certificate file must contain -----BEGIN CERTIFICATE-----' }, { status: 400 });
      }
      const hasKey = keyText.includes('-----BEGIN PRIVATE KEY-----') || keyText.includes('-----BEGIN RSA PRIVATE KEY-----');
      if (!hasKey) {
        // Maybe the key is embedded in the cert PEM — try to extract it.
        const keyMatch = certText.match(/-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA )?PRIVATE KEY-----/);
        if (keyMatch) {
          keyText = keyMatch[0];
        } else {
          return Response.json({ error: 'Private key must contain -----BEGIN PRIVATE KEY----- or -----BEGIN RSA PRIVATE KEY-----' }, { status: 400 });
        }
      }

      // Upload cert and key to private storage (server-side only).
      // The file URIs are stored in the entity but never returned to clients.
      const certBlob = new Blob([certText], { type: 'application/x-pem-file' });
      const keyBlob = new Blob([keyText], { type: 'application/x-pem-file' });
      const certFile = new File([certBlob], 'default-cert.pem', { type: 'application/x-pem-file' });
      const keyFile = new File([keyBlob], 'default-key.pem', { type: 'application/x-pem-file' });

      const certUpload = await sr.integrations.Core.UploadPrivateFile({ file: certFile });
      const keyUpload = await sr.integrations.Core.UploadPrivateFile({ file: keyFile });

      if (!certUpload?.file_uri) return Response.json({ error: 'Could not store certificate file' }, { status: 500 });
      if (!keyUpload?.file_uri) return Response.json({ error: 'Could not store private key file' }, { status: 500 });

      // Deactivate all existing configs.
      const existing = await sr.entities.AdminSslConfiguration.list();
      for (const c of existing || []) {
        if (c.is_active) {
          await sr.entities.AdminSslConfiguration.update(c.id, { is_active: false });
        }
      }

      // Create the new active config.
      const user = await base44.auth.me().catch(() => null);
      const newConfig = await sr.entities.AdminSslConfiguration.create({
        name,
        certificate_file_reference: certUpload.file_uri,
        private_key_file_reference: keyUpload.file_uri,
        certificate_status: 'configured',
        expires_at: expires_at || '',
        is_active: true,
        updated_by: user?.email || '',
      });

      return Response.json({
        ok: true,
        configuration: {
          id: newConfig.id,
          name: newConfig.name,
          certificate_status: newConfig.certificate_status,
          expires_at: newConfig.expires_at || '',
          is_active: true,
          updated_at: newConfig.updated_date || '',
        },
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: 'Could not manage SSL configuration' }, { status: 500 });
  }
}