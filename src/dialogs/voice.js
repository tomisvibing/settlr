import { $ } from '../lib/format.js';
import { parseVoiceExpense } from '../lib/voice.js';
import { group, personName } from '../selectors.js';
import { dlg, form, setDraft, openDialog } from './dialog.js';
import { openExpense } from './expense.js';

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
let activeRecognition = null;
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
  rec.continuous = false;
  openDialog(`
    <h2><span class="mic-dot" aria-hidden="true"></span>Listening…</h2>
    <p class="hint">Try "dinner at Nando's yesterday split equally".</p>
    <p id="voiceText" class="hint voice-text" aria-live="polite"></p>
    <p class="err" role="alert"></p>
    <div class="dlg-actions"><span class="sp"></span><button type="button" class="btn" data-action="close">Cancel</button></div>`, () => false);
  const textEl = $('#voiceText');
  rec.onresult = ev => {
    let interim = '';
    for(let i = ev.resultIndex; i < ev.results.length; i++){
      const r = ev.results[i];
      if(r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
    }
    if(textEl) textEl.textContent = (finalText + interim).trim() || 'Listening…';
  };
  rec.onerror = ev => {
    const err = form.querySelector('.err');
    if(err) err.textContent = ev.error === 'not-allowed'
      ? 'Microphone access was blocked. If you opened this from inside the Claude app, tap the share icon and choose "Open in Safari" — mic permission has to be granted there, not inside another app.'
      : "Didn't catch that — try again.";
  };
  rec.onend = () => {
    activeRecognition = null;
    if(!dlg.open) return;
    const text = finalText.trim();
    if(!text){ const err = form.querySelector('.err'); if(err) err.textContent = "Didn't catch that — try again, or add the expense the usual way."; return; }
    openExpense(null, parseVoiceExpense(text, g.members.map(id => ({ id, name: personName(id) }))));
  };
  try{ rec.start(); }catch(err){ const e = form.querySelector('.err'); if(e) e.textContent = "Couldn't start the microphone."; }
}
export function abortVoice(){ if(activeRecognition){ activeRecognition.abort(); activeRecognition = null; } }
