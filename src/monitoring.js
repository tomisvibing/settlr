/* Crash reporting via Sentry. Switched on at build time by VITE_SENTRY_DSN (the SENTRY_DSN
   repository variable in CI); without it this is a no-op and the SDK is never downloaded. */
const dsn = import.meta.env.VITE_SENTRY_DSN;
let sentry = null;
const pending = [];

function call(fn, ...args){
  if(!dsn) return;
  if(sentry) sentry[fn](...args); else pending.push([fn, args]);
}

export function initMonitoring(){
  if(!dsn) return;
  import('./sentry.js').then(S => {
    S.init({
      dsn,
      release: import.meta.env.VITE_RELEASE || undefined,
      environment: import.meta.env.MODE,
      sendDefaultPii: false,
    });
    sentry = S;
    pending.splice(0).forEach(([fn, args]) => S[fn](...args));
  }).catch(err => console.warn('Crash reporting failed to load', err));
}

/* Errors the app catches and shows to the user (uncaught ones are reported automatically) */
export function reportError(err, where){
  console.error(where ? `[${where}]` : '', err);
  // Supabase errors are plain objects; wrap them so Sentry groups them with a readable title
  const e = err instanceof Error ? err : new Error([err?.message, err?.code].filter(Boolean).join(' ') || String(err));
  call('captureException', e, { tags: where ? { where } : undefined, extra: err instanceof Error ? undefined : { details: err } });
}

/* Only the account ID, never the name or email */
export function setMonitoringUser(id){ call('setUser', id ? { id } : null); }
