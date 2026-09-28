/* Swipe a row left to reveal Edit and Delete (rows marked li.swipe, buttons from swipeActs).
   Touch only: with a mouse, a click opens the edit sheet, which has Delete too. */

let openLi = null;
let drag = null;
let swallowClick = false;

const actsWidth = li => li.querySelector('.swipe-acts')?.offsetWidth || 0;
const setX = (li, x) => li.style.setProperty('--dx', `${x}px`);

function openRow(li){
  if(openLi && openLi !== li) closeRow(openLi);
  li.classList.add('open'); setX(li, -actsWidth(li)); openLi = li;
}
function closeRow(li){
  li.classList.remove('open'); setX(li, 0);
  if(openLi === li) openLi = null;
}

export function initSwipe(){
  document.addEventListener('pointerdown', ev => {
    const li = ev.target.closest('li.swipe');
    if(openLi && (!openLi.isConnected || openLi !== li)){ if(openLi.isConnected) closeRow(openLi); else openLi = null; }
    if(ev.pointerType !== 'touch' || !li || ev.target.closest('.swipe-acts')) return;
    drag = { li, id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, base: li === openLi ? -actsWidth(li) : 0, x: 0, active: false };
  }, { passive: true });

  document.addEventListener('pointermove', ev => {
    if(!drag || ev.pointerId !== drag.id) return;
    const dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
    if(!drag.active){
      /* Mostly vertical: it's a scroll, let it be */
      if(Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)){ drag = null; return; }
      if(Math.abs(dx) < 10) return;
      drag.active = true; drag.li.classList.add('swiping');
    }
    const w = actsWidth(drag.li);
    drag.x = Math.max(-w - 20, Math.min(0, drag.base + dx));
    setX(drag.li, drag.x);
  }, { passive: true });

  const end = ev => {
    if(!drag || ev.pointerId !== drag.id) return;
    const { li, active, x, base } = drag; drag = null;
    if(!active) return;
    li.classList.remove('swiping');
    /* Past a third of the way open → snap open; from open, a nudge right closes */
    const w = actsWidth(li), threshold = base ? -w * 2 / 3 : -w / 3;
    if(ev.type !== 'pointercancel' && x < threshold) openRow(li); else closeRow(li);
    swallowClick = true; setTimeout(() => { swallowClick = false; }, 350);
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);

  /* Capture phase, so these run before the page's data-action handler */
  document.addEventListener('click', ev => {
    if(swallowClick && ev.target.closest('li.swipe > .row')){ ev.preventDefault(); ev.stopPropagation(); swallowClick = false; return; }
    if(!openLi) return;
    if(ev.target.closest('.swipe-acts') && openLi.contains(ev.target)){ const li = openLi; setTimeout(() => li.isConnected && closeRow(li), 0); return; }
    /* A tap on an open row (or anywhere else) just closes it */
    if(openLi.contains(ev.target)){ ev.preventDefault(); ev.stopPropagation(); }
    closeRow(openLi);
  }, true);
}
