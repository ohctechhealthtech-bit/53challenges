import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// The SDK builds auth redirects as `${appBaseUrl}/login` and
// `${appBaseUrl}/api/apps/auth/{login,logout}`. Base44's logout endpoint answers
// `302 Location: /` and ignores its own from_url parameter, so appBaseUrl alone
// decides where the user lands after signing out.
//
// In the hosted build appBaseUrl is empty, which makes those URLs same-origin
// and `Location: /` resolve back to the app — correct. Locally and on our own
// nginx, VITE_BASE44_APP_BASE_URL may be a platform host, and feeding that in
// here sends the user to the Base44 dashboard on logout instead of back here.
//
// So only honour appBaseUrl when it is this page's own origin. Anything
// cross-origin falls back to same-origin, where the /api proxy forwards the
// request upstream (cookies still get cleared) and `Location: /` resolves to
// this site. `src/lib/authReturnTo.js` already treats an externally supplied
// app_base_url as untrusted for the same reason.
function sameOriginAuthBaseUrl(configured) {
  if (!configured || typeof window === 'undefined') return '';
  try {
    return new URL(configured, window.location.href).origin === window.location.origin
      ? configured
      : '';
  } catch {
    return '';
  }
}

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl: sameOriginAuthBaseUrl(appBaseUrl)
});
