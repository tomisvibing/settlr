/* A date field with a calendar of settlr's own, in place of the phone's date wheel. The value lives in
   a hidden input called `name`, so forms and 'change' listeners treat it like any other field. The
   calendar opens under the button and closes on a pick, Escape or a tap elsewhere. Maths: lib/calendar.js */
import { esc, today } from '../lib/format.js';
import { parseYmd, addDays, shiftMonth, monthGrid, dateLabel, monthTitle, longDate, ymd } from '../lib/calendar.js';

export const dateField = (name, value, label = 'Date') => `<div class="datefield" data-datefield>
  <input type="hidden" name="${name}" value="${esc(value)}">
  <button type="button" class="datebtn" data-cal="toggle" aria-haspopup="dialog" aria-expanded="false" aria-label="${esc(label)}: ${esc(longDate(value))}">${esc(dateLabel(value))}</button>
  <div class="cal" role="dialog" aria-label="Choose a date" hidden></div>
</div>`;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const valueOf = f => f.querySelector('input[type=hidden]').value;

/* Draw the month in view; `focus` moves keyboard focus onto the chosen day (arrow keys) */
function draw(f, view, focus = ''){
  const cal = f.querySelector('.cal'), value = valueOf(f), now = today();
  const tabbable = focus || (monthGrid(view.y, view.m).flat().some(c => c.date === value && c.inMonth) ? value : ymd(view.y, view.m, 1));
  f.dataset.view = `${view.y}-${view.m}`;
  cal.innerHTML = `
    <div class="cal-head">
      <button type="button" class="cal-nav" data-cal="prev" aria-label="Previous month">‹</button>
      <span class="cal-title" aria-live="polite">${esc(monthTitle(view.y, view.m))}</span>
      <button type="button" class="cal-nav" data-cal="next" aria-label="Next month">›</button>
    </div>
    <div class="cal-grid" role="grid" aria-label="${esc(monthTitle(view.y, view.m))}">
      <div class="cal-row" role="row">${WEEKDAYS.map(w => `<span class="cal-dow" role="columnheader">${w}</span>`).join('')}</div>
      ${monthGrid(view.y, view.m).map(week => `<div class="cal-row" role="row">${week.map(c => `<button type="button" role="gridcell" class="cal-day${c.inMonth ? '' : ' out'}${c.date === now ? ' now' : ''}" data-cal-day="${c.date}" tabindex="${c.date === tabbable ? 0 : -1}" aria-label="${esc(longDate(c.date))}" ${c.date === value ? 'aria-selected="true"' : 'aria-selected="false"'}>${c.day}</button>`).join('')}</div>`).join('')}
    </div>
    <div class="cal-quick"><button type="button" class="btn small" data-cal-day="${now}">Today</button><button type="button" class="btn small" data-cal-day="${addDays(now, -1)}">Yesterday</button></div>`;
  if(focus) cal.querySelector(`[data-cal-day="${focus}"]`)?.focus();
}
const viewOf = f => { const [y, m] = (f.dataset.view || '').split('-').map(Number); return Number.isFinite(y) ? { y, m } : null; };

function close(f, refocus = true){
  const cal = f.querySelector('.cal'), btn = f.querySelector('.datebtn');
  cal.hidden = true; btn.setAttribute('aria-expanded', 'false');
  if(refocus) btn.focus();
}
function open(f){
  document.querySelectorAll('[data-datefield]').forEach(o => { if(o !== f) close(o, false); });
  const p = parseYmd(valueOf(f)) || parseYmd(today());
  draw(f, { y: p.y, m: p.m });
  f.querySelector('.cal').hidden = false;
  f.querySelector('.datebtn').setAttribute('aria-expanded', 'true');
  (f.querySelector('.cal-day[tabindex="0"]') || f.querySelector('.cal-day')).focus();
}
function pick(f, date){
  const input = f.querySelector('input[type=hidden]');
  const changed = input.value !== date;
  input.value = date;
  const btn = f.querySelector('.datebtn');
  btn.textContent = dateLabel(date);
  btn.setAttribute('aria-label', `Date: ${longDate(date)}`);
  close(f);
  if(changed) input.dispatchEvent(new Event('change', { bubbles: true }));
}

export function initDatePicker(){
  document.addEventListener('click', ev => {
    const f = ev.target.closest('[data-datefield]');
    /* A tap anywhere else puts every open calendar away */
    if(!f){ document.querySelectorAll('[data-datefield]').forEach(o => { if(!o.querySelector('.cal').hidden) close(o, false); }); return; }
    const b = ev.target.closest('[data-cal],[data-cal-day]'); if(!b) return;
    ev.stopPropagation();
    if(b.dataset.calDay) return pick(f, b.dataset.calDay);
    const what = b.dataset.cal;
    if(what === 'toggle') return f.querySelector('.cal').hidden ? open(f) : close(f);
    const v = viewOf(f);
    if(v && (what === 'prev' || what === 'next')){
      draw(f, shiftMonth(v, what === 'prev' ? -1 : 1));
      f.querySelector(`[data-cal="${what}"]`).focus();
    }
  });
  document.addEventListener('keydown', ev => {
    const f = ev.target.closest?.('[data-datefield]'); if(!f || f.querySelector('.cal').hidden) return;
    if(ev.key === 'Escape'){ ev.preventDefault(); ev.stopPropagation(); close(f); return; }
    const day = ev.target.dataset?.calDay; if(!day) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key];
    const month = { PageUp: -1, PageDown: 1 }[ev.key];
    let to = null;
    if(step) to = addDays(day, step);
    else if(month){ const p = parseYmd(day), t = shiftMonth({ y: p.y, m: p.m }, month); to = ymd(t.y, t.m, Math.min(p.d, new Date(Date.UTC(t.y, t.m + 1, 0)).getUTCDate())); }
    else if(ev.key === 'Home') to = addDays(day, -((new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7));
    else if(ev.key === 'End') to = addDays(day, 6 - ((new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7));
    if(!to) return;
    ev.preventDefault();
    const p = parseYmd(to);
    draw(f, { y: p.y, m: p.m }, to);
  });
}
