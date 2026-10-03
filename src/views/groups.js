import { state } from '../store.js';
import { $ } from '../lib/format.js';
import { groupList, bindArchived } from './home.js';

/* Every group in one place: the tickets from the overview, without the story above them */
export function renderGroups(){
  const app = $('#app');
  if(!state.groups.length){
    app.innerHTML = `<div class="stack">
      <section class="empty">
        <h1 class="display">No groups yet. Start one to split your first bill.</h1>
        <button class="btn primary" data-action="new-group">Start a group</button>
        <button class="btn" data-action="join-group">Join with an invite code</button>
      </section>
    </div>`;
    return;
  }
  app.innerHTML = `<div class="stack">
    <header class="page-head"><h1 class="display">Groups</h1></header>
    ${groupList()}
  </div>`;
  bindArchived(app);
}
