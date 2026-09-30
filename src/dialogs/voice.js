import { $, esc, currencySymbol } from '../lib/format.js';
import { parseVoiceExpense } from '../lib/voice.js';
import { group, personName, meIn, isMe } from '../selectors.js';
import { dlg, form, setDraft, openDialog } from './dialog.js';
import { openExpense } from './expense.js';

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let activeRecognition = null;
/* People pause between the parts ("Dinner… £37… I paid…"): keep listening until they've been quiet this long */
const QUIET_MS = 2500;
/* The example on the voice screen, with this group's own people and currency */
function example(g){
  const others = g.members.filter(id => !isMe(id)).slice(0, 2).map(personName);
  const who = others.length ? `, split with ${others.join(' and ')}` : '';
  return `Dinner at Nando’s, ${currencySymbol(g.currency)}37, I paid${who}`;
}
export function openVoiceExpense(){
  const g = group(); if(!g) return;
  if(!SpeechRecognitionCtor){
    openDialog(`
      <h2>Voice isn't available here</h2>
      <p class="hint">This browser doesn't support voice input. Try Chrome, Edge or Safari, or add the expense the usual way.</p>
      <div class="dlg-actions"><span class="sp"></span><button type="button" class="btn primary" data-action="close">OK</button></div>`, () => false);
    return;
  }
  setDraft(null);
  let finalText = '';
  const rec = new SpeechRecognitionCtor();
  activeRecognition = rec;
  rec.lang = navigator.language || 'en-GB';
  rec.interimResults = true;
  rec.continuous = true;
  let quiet = null;
  const listenAgain = (ms = QUIET_MS) => { clearTimeout(quiet); quiet = setTimeout(() => rec.stop(), ms); };
  /* More time before the first word (and for the microphone permission prompt) */
  rec.onstart = () => listenAgain(8000);
  openDialog(`
    <h2><span class="mic-dot" aria-hidden="true"></span>Listening…</h2>
    <ol class="voice-steps" aria-label="What to say, in this order">
      <li><b>What it was</b><span>becomes the description</span></li>
      <li><b>How much</b></li>
      <li><b>Who paid</b><span>“I paid” or “Sam paid”</span></li>
      <li><b>Who it’s for</b><span>“split with …”, or leave it out for everyone</span></li>
    </ol>
    <p class="voice-eg">“${esc(example(g))}”</p>
    <p class="hint">Start with the thing itself. No need for “yesterday we went for…”.</p>
    <p id="voiceText" class="hint voice-text" aria-live="polite"></p>
    <p class="err" role="alert"></p>
    <div class="dlg-actions"><span class="sp"></span><button type="button" class="btn" data-action="close">Cancel</button><button type="button" class="btn primary" data-action="voice-done">Done</button></div>`, () => false);
  const textEl = $('#voiceText');
  rec.onresult = ev => {
    let interim = '';
    for(let i = ev.resultIndex; i < ev.results.length; i++){
      const r = ev.results[i];
      if(r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
    }
    if(textEl) textEl.textContent = (finalText + interim).trim() || 'Listening…';
    listenAgain();
  };
  rec.onerror = ev => {
    const err = form.querySelector('.err');
    if(err) err.textContent = ev.error === 'not-allowed'
      ? 'Microphone access was blocked. If you opened this from inside the Claude app, tap the share icon and choose "Open in Safari" — mic permission has to be granted there, not inside another app.'
      : "Didn't catch that — try again.";
  };
  rec.onend = () => {
    clearTimeout(quiet);
    activeRecognition = null;
    if(!dlg.open) return;
    const text = finalText.trim();
    if(!text){ const err = form.querySelector('.err'); if(err) err.textContent = "Didn't catch that — try again, or add the expense the usual way."; return; }
    openExpense(null, { ...parseVoiceExpense(text, g.members.map(id => ({ id, name: personName(id) })), new Date(), meIn(g)), heard: text });
  };
  try{ rec.start(); }catch(err){ const e = form.querySelector('.err'); if(e) e.textContent = "Couldn't start the microphone."; }
}
/* "Done": stop listening and use what was said so far */
export function finishVoice(){ activeRecognition?.stop(); }
export function abortVoice(){ if(activeRecognition){ activeRecognition.abort(); activeRecognition = null; } }
