import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sentry = { init: vi.fn(), captureException: vi.fn(), setUser: vi.fn() };
vi.mock('../src/sentry.js', () => sentry);

async function load(dsn){
  vi.resetModules();
  vi.stubEnv('VITE_SENTRY_DSN', dsn);
  return import('../src/monitoring.js');
}
const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => { Object.values(sentry).forEach(f => f.mockClear()); vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('monitoring', () => {
  it('does nothing without a DSN', async () => {
    const m = await load('');
    m.initMonitoring(); m.reportError(new Error('x'), 'save'); m.setMonitoringUser('u1');
    await flush();
    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it('reports errors raised before the SDK finished loading', async () => {
    const m = await load('https://key@o1.ingest.sentry.io/1');
    m.reportError(new Error('early'), 'load');
    m.initMonitoring();
    await flush();
    expect(sentry.init).toHaveBeenCalledWith(expect.objectContaining({ dsn: 'https://key@o1.ingest.sentry.io/1', sendDefaultPii: false }));
    expect(sentry.captureException).toHaveBeenCalledWith(expect.objectContaining({ message: 'early' }), expect.objectContaining({ tags: { where: 'load' } }));
  });

  it('turns Supabase error objects into readable errors', async () => {
    const m = await load('https://key@o1.ingest.sentry.io/1');
    m.initMonitoring(); await flush();
    const supabaseError = { message: 'new row violates row-level security policy', code: '42501', details: null };
    m.reportError(supabaseError, 'save');
    const [err, ctx] = sentry.captureException.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('new row violates row-level security policy 42501');
    expect(ctx.extra.details).toBe(supabaseError);
  });

  it('identifies users by account ID only', async () => {
    const m = await load('https://key@o1.ingest.sentry.io/1');
    m.initMonitoring(); await flush();
    m.setMonitoringUser('user-uuid');
    m.setMonitoringUser(null);
    expect(sentry.setUser.mock.calls).toEqual([[{ id: 'user-uuid' }], [null]]);
  });
});
