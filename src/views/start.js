import { $ } from '../lib/format.js';

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
    <a class="to-overview" href="#/overview">
      <span>Overview</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>
    </a>
  </section>`;
}
