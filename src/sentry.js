/* Only what monitoring.js uses, so the lazily loaded chunk leaves out replay, feedback and tracing */
export { init, captureException, setUser } from '@sentry/browser';
