/* Phones: swipe left or right to move between the tabs, in the tab bar's order. A group's page sits
   under Home, so swiping right there goes back to Home. The page follows the finger a little, then
   slides across (styles.css, the view transitions).
   Touch events rather than pointer events: the browser never cancels them to scroll, so a sideways
   swipe on a page that only scrolls up and down still reaches us. On a row, left stays the row's
   (swipe.js opens its actions) and only right turns the page; an open row is the row's both ways.
   Swipes that start on a sideways-scrolling strip, a control, a sheet or the screen's edge (the
   phone's own back gesture) are left alone */
import { parseRoute, navigate } from './router.js';

const TABS = ['home', 'people', 'activity', 'settings'];
const IGNORE = 'li.swipe.open, dialog, input, select, textarea, button.reel, .filters, .jump, .opts, .seg, .tabbar, .topbar';
const EDGE = 20, LOCK = 12, GO = 70, FLICK = .45;

/* Where a swipe goes from here: { prev, next } as hashes, or nothing */
function neighbours(){
  const r = parseRoute();
  if(r.name === 'group') return { prev: '#/home', next: null };
  const i = TABS.indexOf(r.name);
  if(i < 0) return null;
  return { prev: i > 0 ? '#/' + TABS[i - 1] : null, next: i < TABS.length - 1 ? '#/' + TABS[i + 1] : null };
}

let g = null;
const app = () => document.getElementById('app');
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const follow = dx => { app().style.translate = dx ? `${dx}px 0` : ''; };

function springBack(){
  const el = app();
  if(!el.style.translate) return;
  el.classList.add('page-settle');
  follow(0);
  setTimeout(() => el.classList.remove('page-settle'), 220);
}

export function initPageSwipe(){
  const phone = window.matchMedia('(max-width: 899px)');
  document.addEventListener('touchstart', ev => {
    g = null;
    if(!phone.matches || ev.touches.length !== 1 || document.querySelector('dialog[open]')) return;
    const t = ev.touches[0];
    if(t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
    if(!ev.target.closest('main') || ev.target.closest(IGNORE)) return;
    const n = neighbours(); if(!n || (!n.prev && !n.next)) return;
    g = { x0: t.clientX, y0: t.clientY, t0: ev.timeStamp, dx: 0, locked: false, n, onRow: !!ev.target.closest('li.swipe') };
  }, { passive: true });

  document.addEventListener('touchmove', ev => {
    if(!g) return;
    if(ev.touches.length !== 1){ g = null; springBack(); return; }
    const t = ev.touches[0], dx = t.clientX - g.x0, dy = t.clientY - g.y0;
    if(!g.locked){
      /* Mostly up and down: a scroll, leave it be */
      if(Math.abs(dy) > LOCK && Math.abs(dy) > Math.abs(dx)){ g = null; return; }
      if(Math.abs(dx) < LOCK || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      /* Leftwards on a row reveals its actions instead */
      if(g.onRow && dx < 0){ g = null; return; }
      g.locked = true;
    }
    g.dx = dx;
    /* Towards a page: follows at a third of the finger; towards nothing (first or last tab): barely */
    const to = dx < 0 ? g.n.next : g.n.prev;
    if(!reduced()) follow(Math.round(dx * (to ? .3 : .08)));
  }, { passive: true });

  const end = ev => {
    if(!g) return;
    const { dx, locked, t0, n } = g; g = null;
    if(!locked) return;
    const speed = Math.abs(dx) / Math.max(1, ev.timeStamp - t0);
    const to = dx < 0 ? n.next : n.prev;
    if(ev.type === 'touchend' && to && (Math.abs(dx) > GO || (Math.abs(dx) > 30 && speed > FLICK))){
      /* The slide's direction for the view transition; the router clears the finger's offset */
      document.documentElement.dataset.nav = dx < 0 ? 'next' : 'prev';
      setTimeout(() => { delete document.documentElement.dataset.nav; }, 600);
      navigate(to);
    } else springBack();
  };
  document.addEventListener('touchend', end, { passive: true });
  document.addEventListener('touchcancel', end, { passive: true });
}
