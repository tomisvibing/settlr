/* Hash-based routing so the back button and the home-screen app both work */
import { $ } from './lib/format.js';
import { renderHome } from './views/home.js';
import { renderStart } from './views/start.js';
import { renderGroupView } from './views/group.js';
import { renderPeopleView } from './views/people.js';
import { renderSettings } from './views/settings.js';
import { renderActivity } from './views/activity.js';
import { openJoinGroup } from './dialogs/join.js';
import { restoreFocus } from './ui.js';

export function parseRoute(){
  const h = location.hash;
  if(!h.startsWith('#/') || h === '#/') return { name:'start' };
  const [name, arg] = h.slice(2).split('/');
  if(name === 'g' && arg) return { name:'group', id: decodeURIComponent(arg) };
  if(name === 'overview' || name === 'people' || name === 'settings' || name === 'activity') return { name };
  if(name === 'join' && arg) return { name:'join', code: decodeURIComponent(arg) };
  return { name:'start' };
}
export function navigate(hash){ if(location.hash === hash) render(); else location.hash = hash; }
export const groupHref = g => '#/g/' + encodeURIComponent(g.id);
export const inviteLink = g => location.origin + location.pathname + '#/join/' + encodeURIComponent(g.inviteCode);

export function render(){
  let r = parseRoute();
  if(r.name === 'join'){
    history.replaceState(null, '', location.pathname + location.search + '#/');
    renderRoute({ name:'start' });
    openJoinGroup(r.code);
    return;
  }
  renderRoute(r);
}
function renderRoute(r){
  /* The landing page has no navigation: just the button and the way to the overview */
  const entering = document.body.dataset.route !== r.name;
  document.body.dataset.route = r.name;
  const tab = r.name === 'group' ? 'overview' : r.name;
  [['overview','#navHome'],['people','#navPeople'],['activity','#navActivity'],['settings','#navSettings']].forEach(([n,sel]) => {
    const el = $(sel); if(n === tab) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
  });
  if(r.name === 'group') renderGroupView(r.id);
  else if(r.name === 'people') renderPeopleView();
  else if(r.name === 'settings') renderSettings();
  else if(r.name === 'activity') renderActivity();
  else if(r.name === 'overview') renderHome();
  else renderStart({ entering });
  restoreFocus();
}
