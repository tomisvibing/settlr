/* What to tell people when a request fails (tested in test/errors.test.js).
   Database and network errors are written for developers; the raw error still goes to Sentry,
   but the screen says what happened and what to do next */
const withStop = m => /[.!?]$/.test(m) ? m : m + '.';

export function friendlyError(err, action = 'save'){
  const m = String(err?.message || '');
  if(/failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(m))
    return `Couldn’t ${action}: settlr can’t be reached. Check your connection and try again.`;
  if(/invalid invite code/i.test(m)) return 'That invite code didn’t work. Check it and try again.';
  if(/not signed in|jwt expired|invalid jwt/i.test(m)) return 'You’ve been signed out. Sign in again, then try again.';
  /* Our own database rules raise sentences meant for people (e.g. "Settle up before leaving: …") */
  if(err?.code === 'P0001' && m) return withStop(m);
  if(err?.code === '42501' || /row-level security|permission denied/i.test(m))
    return `Couldn’t ${action}: you can’t change this any more. Reload to see the latest.`;
  return `Couldn’t ${action}. Check your connection and try again.`;
}
