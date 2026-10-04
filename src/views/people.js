import { state } from '../store.js';
import { $, esc, money, byNewest, dayMonth } from '../lib/format.js';
import { personName, shortName, isMe } from '../selectors.js';
import { between } from '../lib/story.js';
import { avatar, swipeActs, folder } from './shared.js';
import { plainReceipt, lineHTML } from './receipt.js';

const nameOf = pid => isMe(pid) ? 'You' : shortName(pid);

/* Where it comes from, when there's more than one place: "You owe £48.00 in Flat 4B. Sam owes you
   £17.70 in Lisbon weekend." One place is just its name */
function breakdown(x){
  const where = p => p.where ? `in ${esc(p.where)}` : 'outside groups';
  const parts = x.parts.filter(p => p.amount);
  if(parts.length < 2) return parts.map(p => p.where ? esc(p.where) : 'Outside groups').join('');
  return parts.map(p => p.amount > 0
    ? `${esc(shortName(x.pid))} owes you <b>${money(p.amount, p.cur)}</b> ${where(p)}.`
    : `You owe <b class="down">${money(-p.amount, p.cur)}</b> ${where(p)}.`).join(' ');
}

/* One person per row: their name large, where it comes from underneath, and what's between you on
   the right, one amount per currency. Owes you first, biggest first; then who you owe */
function peopleList(rows){
  return `<ul class="plist" aria-label="What each person owes you, or you owe them">${rows.map(x => {
    const line = ([cur, v]) => `<span class="p-line"><span class="p-amt${v > 0 ? '' : ' down'}">${money(Math.abs(v), cur)}</span><span class="p-lbl">${v > 0 ? 'owes you' : 'you owe'}</span></span>`;
    return `<li class="p-row">${avatar(x.pid)}<span class="p-main"><span class="p-name">${esc(nameOf(x.pid))}</span><span class="p-groups">${breakdown(x)}</span></span><span class="p-pos">${x.owing.map(line).join('')}</span></li>`;
  }).join('')}</ul>`;
}

export function renderPeopleView(){
  const app = $('#app');
  const people = state.people.filter(p => !isMe(p.id)).sort((a, b) => a.name.localeCompare(b.name));
  const settlements = state.payments.slice().sort(byNewest);
  const all = between(state.groups, isMe, state.payments);
  const rows = [], square = [];
  for(const p of people){
    const x = all.get(p.id), owing = x ? Object.entries(x.amounts).filter(([, v]) => v !== 0) : [];
    if(owing.length) rows.push({ ...x, owing }); else square.push(p);
  }
  /* Biggest owed to you first, the biggest you owe last */
  const score = r => r.owing.reduce((m, [, v]) => Math.abs(v) > Math.abs(m) ? v : m, 0);
  rows.sort((a, c) => score(c) - score(a));

  app.innerHTML = `<div class="stack">
    <header class="page-head"><h1 class="display">People</h1></header>

    ${folder({ id: 'everyone', title: 'Between you and them',
      actions: `<div class="chipbar">${people.length ? '<button class="btn small" data-action="manage-people">Edit</button>' : ''}<button class="btn small" data-action="add-person" aria-label="Add a person">Add</button></div>`,
      body: `${rows.length ? peopleList(rows) : ''}
      ${square.length ? `<div class="square-people">
        <h3>${rows.length ? 'All square with you' : 'You’re square with everyone'}</h3>
        <ul class="opts">${square.map(p => `<li><span class="opt">${avatar(p.id, 'sm')}${esc(personName(p.id))}</span></li>`).join('')}</ul>
      </div>` : ''}
      ${!people.length ? `<p class="none">No one saved yet. Add a person to get started.</p>` : ''}` })}

    ${folder({ id: 'outside', title: 'Outside groups',
      actions: `<button class="btn small" data-action="add-settlement" ${people.length ? '' : 'disabled'}>Record a settlement</button>`,
      body: settlements.length ? plainReceipt('Outside groups', settlements.map(p => {
        const { day, mon } = dayMonth(p);
        return lineHTML({
          what: `${esc(nameOf(p.from))} <span aria-hidden="true">→</span><span class="sr"> paid </span> ${esc(isMe(p.to) ? 'you' : shortName(p.to))}`,
          amt: money(p.amount, p.currency),
          sub: `${esc(p.note || 'Settlement')} · ${day} ${mon}`,
          attrs: `data-action="edit-settlement" data-id="${p.id}"`,
          swipe: swipeActs('edit-settlement', 'del-settlement', p.id),
        });
      })) : `<p class="none">When you settle up with someone outside any group, record it here.</p>` })}
  </div>`;
}
