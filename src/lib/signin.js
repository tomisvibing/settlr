/* Pure helpers for email sign-in (tested in test/signin.test.js) */

export const normalizeEmail = s => String(s || '').trim().toLowerCase();
export const looksLikeEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(s));
/* Supabase codes are 6 digits by default (up to 10 if configured); people paste them with spaces */
export const cleanCode = s => String(s || '').replace(/\D/g, '').slice(0, 10);

/* "tom.smith+x@example.com" → "Tom Smith": a starting name for people who sign in by email */
export function nameFromEmail(email){
  const local = normalizeEmail(email).split('@')[0].split('+')[0];
  const words = local.split(/[._-]+/).filter(w => /[a-z]/.test(w));
  if(!words.length) return 'Me';
  return words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/* Supabase's auth errors are terse and technical; say what to do instead */
export function friendlyAuthError(err){
  const m = String(err?.message || '').toLowerCase();
  const status = err?.status;
  if(status === 429 || m.includes('rate limit') || m.includes('security purposes')) return 'Too many codes asked for. Wait a minute, then try again.';
  if(m.includes('signups not allowed') || m.includes('not allowed')) return 'Email sign-in isn’t switched on yet.';
  if(m.includes('expired') || m.includes('invalid') || m.includes('otp')) return 'That code didn’t work. Check it, or send a new one.';
  if(m.includes('fetch') || m.includes('network')) return 'Couldn’t reach settlr. Check your connection.';
  return 'Couldn’t sign in. Check your connection and try again.';
}
