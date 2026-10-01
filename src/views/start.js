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

/* The reel under "Split": the things people split. It spins fast, eases to a stop on one, and lands
   somewhere different each visit */
const PHRASES = ['dinner at Hawksmoor', 'the train to Paris', 'coffee for two', 'festival tickets', 'the Airbnb in Lisbon',
  'Friday’s big shop', 'a cab home', 'the electricity bill', 'pizza for six', 'birthday drinks', 'the ski chalet', 'brunch, again'];
const SPIN_MS = 2200, LAPS = 2;
let landed = Math.floor(Math.random() * PHRASES.length), frame = 0, wasLoading = false;

function drawReel(drum, pos, speed){
  const items = drum.children, n = items.length;
  for(let i = 0; i < n; i++){
    const el = items[i];
    let d = ((i - pos) % n + n) % n; if(d > n / 2) d -= n;
    const a = Math.abs(d);
    el.style.visibility = a > 1.6 ? 'hidden' : '';
    el.style.transform = `translateZ(-1.6em) rotateX(${-d * 36}deg) translateZ(1.6em)`;
    el.style.opacity = Math.max(0, 1 - a * (speed > .05 ? .75 : 1.25)).toFixed(3);
  }
  /* A little blur while it's really moving */
  drum.style.filter = speed > .4 ? `blur(${Math.min(2.5, (speed - .4) * 1.2).toFixed(2)}px)` : '';
}
function spin(drum){
  cancelAnimationFrame(frame);
  const from = landed;
  let next = Math.floor(Math.random() * (PHRASES.length - 1)); if(next >= from) next++;
  landed = next;
  const n = PHRASES.length, to = from + LAPS * n + ((next - from + n) % n);
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){ drawReel(drum, next, 0); return; }
  let t0 = null, last = from;
  const step = now => {
    if(!drum.isConnected) return;
    t0 ??= now + 250;
    const t = Math.max(0, Math.min(1, (now - t0) / SPIN_MS)), pos = from + (to - from) * (1 - Math.pow(1 - t, 4));
    drawReel(drum, pos, Math.abs(pos - last)); last = pos;
    if(t < 1) frame = requestAnimationFrame(step);
  };
  drawReel(drum, from, 0);
  frame = requestAnimationFrame(step);
}

/* Where everyone lands: one job, one button. The overview is a step away, bottom right.
   While the first load runs the button shows but waits, so a tap can't start a flow with no groups loaded.
   The reel spins when you arrive, not when a live update redraws the page */
export function renderStart({ loading = false, entering = false } = {}){
  const doSpin = !loading && (entering || wasLoading);
  wasLoading = loading;
  $('#app').innerHTML = `<section class="start" aria-labelledby="startTitle"${loading ? ' aria-busy="true"' : ''}>
    <a class="start-brand" href="#/overview">settlr</a>
    <div class="start-stack">
      <h1 class="start-head display" id="startTitle">Split<span class="sr"> the bill for anything you share</span></h1>
      <div class="reel" aria-hidden="true"><div class="drum">${PHRASES.map(p => `<span>${p}</span>`).join('')}</div></div>
      <button type="button" class="start-add" data-action="quick-add"${loading ? ' disabled' : ''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
        <span>Add an expense</span>
      </button>
    </div>
    <button type="button" class="theme-toggle" data-action="toggle-theme" aria-label="Night mode" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"></svg></button>
    <a class="to-overview" href="#/overview">
      <span>Overview</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>
    </a>
  </section>`;
  syncThemeToggle();
  const drum = $('.start .drum');
  if(doSpin) spin(drum); else drawReel(drum, landed, 0);
}
