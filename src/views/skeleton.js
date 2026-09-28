import { $ } from '../lib/format.js';

/* Shown while the first load runs: the shape of Home, softly pulsing */
export function renderSkeleton(){
  const row = `<li class="row"><span class="sk sk-av"></span><span class="r-main"><span class="sk sk-line" style="width:55%"></span><span class="sk sk-line sm" style="width:35%"></span></span><span class="sk sk-pill"></span></li>`;
  $('#app').innerHTML = `<div class="stack" aria-busy="true" aria-label="Loading your groups">
    <div class="greet"><span class="sk sk-av lg"></span><div class="who"><span class="sk sk-line sm" style="width:70px"></span><span class="sk sk-line" style="width:110px;margin-top:6px"></span></div></div>
    <div class="sk sk-hero"></div>
    <div class="card"><ul class="rows">${row}${row}${row}</ul></div>
  </div>`;
}
