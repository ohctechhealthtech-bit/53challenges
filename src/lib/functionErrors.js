// Backend-function invoke errors: the SDK throws before we can read our own
// response body, so pull the server's message out and flag expired sessions.

export function functionErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  return (
    err?.response?.data?.error ||
    err?.data?.error ||
    (err?.message && !/status code/i.test(err.message) ? err.message : '') ||
    fallback
  );
}

export function isSessionExpired(err) {
  const status = err?.status || err?.response?.status || err?.data?.status;
  return status === 401 || /status code 401/i.test(String(err?.message || ''));
}