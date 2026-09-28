/* Hash-based routing so the back button and the home-screen app both work */
import { $ } from './lib/format.js';
import { renderHome } from './views/home.js';
import { renderGroupView } from './views/group.js';
import { renderPeopleView } from './views/people.js';
import { renderSettings } from './views/settings.js';
import { renderActivity } from './views/activity.js';
import { openJoinGroup } from './dialogs/join.js';

export function parseRoute(){
  const h = location.hash;
  if(!h.startsWith('#/')) return { name:'home' };
  const [name, arg] = h.slice(2).split('/');
  if(name === 'g' && arg) return { name:'group', id: decodeURIComponent(arg) };
  if(name === 'people' || name === 'settings' || name === 'activity') return { name };
  if(name === 'join' && arg) return { name:'join', code: decodeURIComponent(arg) };
  return { name:'home' };
}
export function navigate(hash){ if(location.hash === hash) render(); else location.hash = hash; }
export const groupHref = g => '#/g/' + encodeURIComponent(g.id);
export const inviteLink = g => location.origin + location.pathname + '#/join/' + encodeURIComponent(g.inviteCode);

export function render(){
  let r = parseRoute();
  if(r.name === 'join'){
    history.replaceState(null, '', location.pathname + location.search + '#/');
    renderRoute({ name:'home' });
    openJoinGroup(r.code);
    return;
  }
  renderRoute(r);
}
function renderRoute(r){
  const tab = r.name === 'group' ? 'home' : r.name;
  [['home','#navHome'],['people','#navPeople'],['activity','#navActivity'],['settings','#navSettings']].forEach(([n,sel]) => {
    const el = $(sel); if(n === tab) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
  });
  if(r.name === 'group') renderGroupView(r.id);
  else if(r.name === 'people') renderPeopleView();
  else if(r.name === 'settings') renderSettings();
  else if(r.name === 'activity') renderActivity();
  else renderHome();
}
