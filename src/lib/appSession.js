// App session helper — the signed session token for the logged-in user.
// Thin alias over the custom-session storage so host portal code has a
// stable import path.
export { getSessionToken, setSessionToken, clearSessionToken } from '@/lib/customSession';