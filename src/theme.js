/* Local UI preference only, not app data */
const THEME_KEY = 'settlr:theme';

export function getThemeOverride(){ try{ return localStorage.getItem(THEME_KEY); }catch(e){ return null; } }
export function applyTheme(){
  const t = getThemeOverride();
  if(t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}
export function setTheme(t){
  try{ if(t === 'light' || t === 'dark') localStorage.setItem(THEME_KEY, t); else localStorage.removeItem(THEME_KEY); }catch(e){}
  applyTheme();
}
