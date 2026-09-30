/* Local UI preference only, not app data */
const THEME_KEY = 'settlr:theme';

export function getThemeOverride(){ try{ return localStorage.getItem(THEME_KEY); }catch(e){ return null; } }
/* The phone's status bar and app switcher take their colour from theme-color: follow the chosen theme,
   or the device's when it's set to match */
const BAR = { light: '#F8F6F1', dark: '#17213A' };
function syncBarColour(t){
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    m.dataset.media ??= m.media;
    const own = m.dataset.media.includes('dark') ? 'dark' : 'light';
    m.content = BAR[t || own];
    m.media = t ? '' : m.dataset.media;
  });
}
export function applyTheme(){
  const t = getThemeOverride();
  if(t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  syncBarColour(t === 'light' || t === 'dark' ? t : null);
}
export function setTheme(t){
  try{ if(t === 'light' || t === 'dark') localStorage.setItem(THEME_KEY, t); else localStorage.removeItem(THEME_KEY); }catch(e){}
  applyTheme();
}
