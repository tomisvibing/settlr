/* The tabs along the top of a group page: a tap scrolls to that folder, and as you scroll the tab for
   the folder you're reading is marked */
let listening = false, frame = 0;
/* The tab just tapped stays marked while the page scrolls to it, even when the page can't scroll that
   far, until you scroll again yourself: a scroll that starts after a pause */
let tapped = null, lastScroll = 0;
function onScroll(){
  const now = Date.now();
  if(now - lastScroll > 250) tapped = null;
  lastScroll = now;
  cancelAnimationFrame(frame); frame = requestAnimationFrame(syncJump);
}

/* The folder whose top has passed just under the strip is the one being read */
export function syncJump(){
  const strip = document.querySelector('.jump'); if(!strip) return;
  if(!listening){ listening = true; window.addEventListener('scroll', onScroll, { passive: true }); }
  const line = strip.getBoundingClientRect().bottom + 24;
  const tabs = [...strip.querySelectorAll('[data-to]')];
  /* At the very bottom the last folder may never reach the line: count it as read */
  const atEnd = window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  let current = tabs[0];
  for(const t of tabs){ const sec = document.getElementById(t.dataset.to); if(sec && sec.getBoundingClientRect().top <= line) current = t; }
  if(atEnd) current = tabs.at(-1);
  if(tapped) current = tabs.find(t => t.dataset.to === tapped) || current;
  tabs.forEach(t => t.setAttribute('aria-current', String(t === current)));
}

/* Scroll to a folder and move focus to its heading, so keyboard and screen reader users land there too */
export function jumpTo(id){
  const sec = document.getElementById(id); if(!sec) return;
  tapped = id; lastScroll = Date.now();
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  sec.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  const h = sec.querySelector('h2'); if(h){ h.tabIndex = -1; h.focus({ preventScroll: true }); }
  syncJump();
}
