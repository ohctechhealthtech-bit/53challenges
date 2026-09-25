# Four fixes to the Plesk provisioning code

Two files change: `base44/shared/pleskApi.ts` and
`base44/functions/provisionDomain/entry.ts`.
Do not change any other file. These are targeted edits, not rewrites — keep
everything not mentioned here exactly as it is.

---

## Fix 1 — SSL private keys are left on disk, world-readable (do this one first)

`installSslCertificate` writes the certificate and the **private key** to
`/tmp/` and never removes them:

```ts
const certPath = `/tmp/${certName}.crt`;
const keyPath  = `/tmp/${certName}.key`;
// ...written via exec...
// finally { ...only restores the shell... }
```

Two problems. The command sets no `umask`, so the files land at the default
mode (typically `0644` — readable by every user on the server), and nothing
ever deletes them. This is a shared Plesk server with other tenants on it, so
every certificate ever installed leaves its private key readable in `/tmp`
indefinitely.

**Change the two write commands** to set a restrictive umask:

Before:
```ts
    const certExec = await restRequest(cfg, 'POST', `/domains/${id}/exec`, {
      command: ['bash', '-c', `echo '${certB64}' | base64 -d > ${certPath}`],
    });
```
After:
```ts
    // umask 077 so the private key is never world-readable while it exists;
    // both files are deleted in the finally block below.
    const certExec = await restRequest(cfg, 'POST', `/domains/${id}/exec`, {
      command: ['bash', '-c', `umask 077 && echo '${certB64}' | base64 -d > ${certPath}`],
    });
```

Before:
```ts
    const keyExec = await restRequest(cfg, 'POST', `/domains/${id}/exec`, {
      command: ['bash', '-c', `echo '${keyB64}' | base64 -d > ${keyPath}`],
    });
```
After:
```ts
    const keyExec = await restRequest(cfg, 'POST', `/domains/${id}/exec`, {
      command: ['bash', '-c', `umask 077 && echo '${keyB64}' | base64 -d > ${keyPath}`],
    });
```

**And delete the files in the `finally` block**, before the shell is dropped —
once shell access is gone the cleanup can no longer run:

Before:
```ts
  } finally {
    if (shellEnabled) {
      await callCli(cfg, ['--update', subscriptionDomain, '-shell', '/bin/false'], 'subscription').catch(() => {});
    }
  }
```
After:
```ts
  } finally {
    if (shellEnabled) {
      // Shred the temporary certificate and private key while shell access
      // still exists — after the shell is dropped this can no longer run.
      await restRequest(cfg, 'POST', `/domains/${id}/exec`, {
        command: ['bash', '-c', `rm -f ${certPath} ${keyPath}`],
      }).catch(() => {});
      await callCli(cfg, ['--update', subscriptionDomain, '-shell', originalShell], 'subscription').catch(() => {});
    }
  }
```

(`originalShell` comes from Fix 3 below. If you apply this fix on its own,
leave `'/bin/false'` there for now.)

---

## Fix 2 — the shell is hardcoded on restore, not restored

Three functions (`cloneGitIntoSubdomain`, `installSslCertificate`,
`setupSubdomainReverseProxy`) enable `/bin/bash` on the subscription and then
set it to `/bin/false` — a hardcoded value, never the value that was there
before. If that subscription legitimately had shell access, provisioning a
single domain **silently revokes it** for the real user.

**Add this helper** to `pleskApi.ts`, next to `callCli`:

```ts
/**
 * Reads the subscription's current login shell so it can be put back exactly
 * as it was. Hardcoding /bin/false on restore silently revoked shell access
 * from subscriptions that legitimately had it.
 */
async function readSubscriptionShell(cfg: PleskConfig, domain: string): Promise<string> {
  const res = await callCli(cfg, ['--info', domain], 'subscription');
  const match = res.ok
    ? String(res.stdout || '').match(/shell[^\S\n]*[:=][^\S\n]*(\S+)/i)
    : null;
  return match?.[1] || getSecret('PLESK_DEFAULT_SHELL', '/bin/false');
}
```

**In each of the three functions**, capture the original before enabling:

Before:
```ts
  let shellEnabled = false;
  try {
    const enableShell = await callCli(cfg, ['--update', subscriptionDomain, '-shell', '/bin/bash'], 'subscription');
```
After:
```ts
  let shellEnabled = false;
  const originalShell = await readSubscriptionShell(cfg, subscriptionDomain);
  try {
    const enableShell = await callCli(cfg, ['--update', subscriptionDomain, '-shell', '/bin/bash'], 'subscription');
```

and in every `finally` block replace the literal `'/bin/false'` with
`originalShell`:

```ts
await callCli(cfg, ['--update', subscriptionDomain, '-shell', originalShell], 'subscription').catch(() => {});
```

In `setupSubdomainReverseProxy` the subscription variable is `cfg.baseDomain`
rather than `subscriptionDomain` — use that same value in both calls there.

---

## Fix 3 — `rm -rf` rests on a single guard

`cloneGitIntoSubdomain` builds:

```ts
const shellCmd = `rm -rf ${docRoot}/* ${docRoot}/.[!.]* 2>/dev/null; cd ${docRoot} && git clone --depth 1 ${gitUrl} .`;
```

If `docRoot` were ever empty this is `rm -rf /*`. The existing
`if (!docRoot) return {...}` check is correct today, but it is the only thing
standing between a lookup returning `''` and wiping the server. Make the
requirement explicit rather than incidental.

Before:
```ts
  if (!docRoot) return { success: false, error: 'Could not determine the document root for this domain' };
  if (!id) return { success: false, error: 'Could not find the Plesk domain ID for this domain' };
```
After:
```ts
  if (!docRoot) return { success: false, error: 'Could not determine the document root for this domain' };
  if (!id) return { success: false, error: 'Could not find the Plesk domain ID for this domain' };

  // The document root is interpolated into `rm -rf` below. Refuse anything
  // that is not a deep path inside the vhosts tree, so a malformed or empty
  // lookup can never widen the delete.
  if (!/^\/var\/www\/vhosts\/[^/]+\/[^/]+/.test(docRoot) || docRoot.includes('..')) {
    return { success: false, error: 'Refusing to deploy: unexpected document root path.' };
  }
```

---

## Fix 4 — remove the reverse-proxy step

`createPleskSubdomain` already points each subdomain at the **parent's
`www_root`**, so subdomains serve the app directly from the same folder. On top
of that, the server has a `*.53challenges.com` wildcard vhost that already
answers for every subdomain with the correct document root, certificate and
`/api` proxy — verified working in production.

`setupSubdomainReverseProxy` therefore proxies the site back to itself through
an extra TLS hop. Its fallback path is also unlikely to work: it writes
`vhost_nginx.conf` and then runs `site --update`, which does not reliably
regenerate the vhost (Plesk needs `httpdmng --reconfigure-domain`), so it can
report success having changed nothing.

**In `provisionDomain/entry.ts`, delete the whole section 10b:**

```ts
    // ─── 10b. Reverse proxy for subdomains ───────────────────────────
    if (domain_type === 'subdomain') {
      const proxyResult = await setupSubdomainReverseProxy(pleskConfig, resolvedFullDomain, resolvedSlug);
      ...
    }
```

and remove `setupSubdomainReverseProxy` from the import list at the top of that
file. Leave the function itself in `pleskApi.ts` — unused but available if a
future domain type genuinely needs proxying.

---

## Verify

- Provision a subdomain, then on the server: `ls -la /tmp/ssl-*` → **no files
  left behind** (Fix 1).
- `plesk bin subscription --info 53challenges.com | grep -i shell` → the same
  value before and after a provisioning run (Fix 2).
- Provisioning still succeeds end to end, and the subdomain still serves the
  app over HTTPS (Fix 4 removed nothing that was doing real work).
