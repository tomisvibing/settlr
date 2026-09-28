/* The sign-in screen: Google, or an emailed one-time code */
import { sb } from './supabase.js';
import { $ } from './lib/format.js';
import { normalizeEmail, looksLikeEmail, cleanCode, friendlyAuthError } from './lib/signin.js';
import { reportError } from './monitoring.js';

const PENDING_EMAIL_KEY = 'settlr:signinEmail';
const redirectTo = () => location.origin + location.pathname + location.search;

function showStep(email){
  $('#emailForm').hidden = !!email;
  $('#codeForm').hidden = !email;
  $('#signinErr').textContent = '';
  if(email){ $('#codeEmail').textContent = email; $('#codeForm').code.value = ''; $('#codeForm').code.focus(); }
  else $('#emailForm').email.focus();
}
const err = msg => { $('#signinErr').textContent = msg; };
async function busy(form, fn){
  const btns = form.querySelectorAll('button');
  btns.forEach(b => b.disabled = true);
  try{ await fn(); } finally { btns.forEach(b => b.disabled = false); }
}
async function sendCode(email){
  /* The same call sends a magic link too; tapping that also signs you in */
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
  if(error){ if(error.status !== 429) reportError(error, 'signin'); err(friendlyAuthError(error)); return false; }
  try{ localStorage.setItem(PENDING_EMAIL_KEY, JSON.stringify({ email, at: Date.now() })); }catch(e){}
  return true;
}

export function initSignIn(){
  $('#signInBtn').addEventListener('click', () => {
    sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } });
  });
  $('#emailForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const email = normalizeEmail(ev.target.email.value);
    if(!looksLikeEmail(email)) return err('Enter your email address.');
    busy(ev.target, async () => { if(await sendCode(email)) showStep(email); });
  });
  $('#codeForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const email = $('#codeEmail').textContent, token = cleanCode(ev.target.code.value);
    if(token.length < 6) return err('Enter the code from the email.');
    busy(ev.target, async () => {
      const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
      if(error){ err(friendlyAuthError(error)); return; }
      try{ localStorage.removeItem(PENDING_EMAIL_KEY); }catch(e){}
    });
  });
  $('#codeForm').code.addEventListener('input', ev => { ev.target.value = cleanCode(ev.target.value); });
  $('#resendCode').addEventListener('click', () => busy($('#codeForm'), async () => {
    if(await sendCode($('#codeEmail').textContent)) err('New code sent.');
  }));
  $('#changeEmail').addEventListener('click', () => {
    try{ localStorage.removeItem(PENDING_EMAIL_KEY); }catch(e){}
    showStep(null);
  });
}

/* Coming back to the sign-in screen within the hour (codes last an hour): pick up at the code step */
export function resumeSignIn(){
  let pending = null;
  try{ pending = JSON.parse(localStorage.getItem(PENDING_EMAIL_KEY) || 'null'); }catch(e){}
  if(pending && Date.now() - pending.at < 3600e3){ $('#codeEmail').textContent = pending.email; $('#emailForm').hidden = true; $('#codeForm').hidden = false; }
}
