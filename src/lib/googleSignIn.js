// Minimal Google Identity Services (GIS) helper: loads the GIS script once
// and requests an OAuth access token for the given client id. The Challenge
// API's google_login action expects this access_token.

let gisPromise = null;

export function ensureGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = null;
      reject(new Error("Failed to load Google sign-in"));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

export function requestGoogleAccessToken(clientId, scope = "openid email profile") {
  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope,
        callback: (resp) => {
          if (resp?.access_token) resolve(resp.access_token);
          else reject(new Error("No Google access token returned"));
        },
        error_callback: (err) => reject(new Error(err?.message || "Google sign-in failed")),
      });
      client.requestAccessToken();
    } catch (e) {
      reject(e);
    }
  });
}