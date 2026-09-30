import { $ } from '../lib/format.js';
import { isNight } from '../theme.js';

/* Day/night switch, outline only: the moon offers night, the sun offers day */
const MOON = '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>';
const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>';
export function syncThemeToggle(){
  const b = $('.theme-toggle'); if(!b) return;
  const night = isNight();
  b.setAttribute('aria-pressed', String(night));
  b.querySelector('svg').innerHTML = night ? SUN : MOON;
}

/* Where everyone lands: one job, one button. The overview is a step away, bottom right.
   While the first load runs the button shows but waits, so a tap can't start a flow with no groups loaded */
export function renderStart({ loading = false } = {}){
  $('#app').innerHTML = `<section class="start" aria-labelledby="startTitle"${loading ? ' aria-busy="true"' : ''}>
    <a class="start-brand" href="#/overview">settlr</a>
    <h1 class="sr" id="startTitle">Record an expense</h1>
    <button type="button" class="start-add" data-action="quick-add"${loading ? ' disabled' : ''}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
      <span>Add expense</span>
    </button>
    <button type="button" class="theme-toggle" data-action="toggle-theme" aria-label="Night mode" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"></svg></button>
    <a class="to-overview" href="#/overview">
      <span>Overview</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>
    </a>
  </section>`;
  syncThemeToggle();
}
