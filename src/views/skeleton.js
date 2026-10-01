import { $ } from '../lib/format.js';
import { parseRoute } from '../router.js';
import { renderStart } from './start.js';

/* Shown while the first load runs: the shape of the overview, softly pulsing */
export function renderSkeleton(){
  /* The landing page is already just a button: show it, waiting */
  if(parseRoute().name === 'start'){ document.body.dataset.route = 'start'; renderStart({ loading: true }); return; }
  const ticket = `<li class="sk sk-ticket"></li>`;
  $('#app').innerHTML = `<div class="stack" aria-busy="true" aria-label="Loading your groups">
    <span class="sk sk-line" style="width:120px;height:18px;margin-top:12px"></span>
    <div class="sk-story"><span class="sk sk-line"></span><span class="sk sk-line"></span><span class="sk sk-line" style="width:60%"></span></div>
    <ul class="tickets">${ticket}${ticket}${ticket}</ul>
  </div>`;
}
