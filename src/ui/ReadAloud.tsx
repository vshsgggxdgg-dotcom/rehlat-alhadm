import { useEffect, useRef, useState } from 'react';
import { Volume2, Square } from 'lucide-react';
import { chooseArabicVoice, arabicVoiceHelp } from '../audio/reading';
let stopCurrent: (()=>void) | null = null;
export function stopReading(){stopCurrent?.();}
export function ReadAloud({text='',label,getText,scopeKey}:{text?:string;label:string;getText?:()=>string;scopeKey?:string}) {
 const [status,setStatus]=useState<'idle'|'loading'|'speaking'>('idle'),[error,setError]=useState('');
 const ownStop=useRef<(()=>void)|null>(null), utteranceRef=useRef<SpeechSynthesisUtterance|null>(null);
 useEffect(()=>{if('speechSynthesis' in window)window.speechSynthesis.getVoices();},[]);
 useEffect(()=>{setError('');return()=>{ownStop.current?.();};},[text,scopeKey]);
 function toggle(){
  if(status!=='idle'){ownStop.current?.();return;}
  const content=(getText?.() ?? text).replace(/\s+/g,' ').trim();
  if(!content){setError('لا يوجد نص ظاهر للقراءة.');return;}
  if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){setError('القراءة الصوتية غير متاحة في المتصفح ده. استخدم Chrome أو Edge.');return;}
  stopCurrent?.();const synth=window.speechSynthesis;
  let live=true,watchdog:ReturnType<typeof setTimeout>|undefined,voice:SpeechSynthesisVoice|undefined;
  const voiceHelp=arabicVoiceHelp(window.navigator.userAgent);let fallbackLanguage='ar-EG';let retried=false;
  const stop=()=>{if(!live)return;live=false;clearTimeout(watchdog);synth.removeEventListener?.('voiceschanged',begin);synth.cancel();utteranceRef.current=null;ownStop.current=null;setStatus('idle');if(stopCurrent===stop)stopCurrent=null;};
  const fail=(message:string)=>{stop();setError(message);};
  ownStop.current=stop;stopCurrent=stop;setError('');setStatus('loading');synth.cancel();synth.resume?.();
  const chunks=content.match(/.{1,160}(?:\s|$)|\S+/g) ?? [];let index=0;
  function next(){
   if(!live)return;
   if(index>=chunks.length){live=false;setStatus('idle');ownStop.current=null;utteranceRef.current=null;if(stopCurrent===stop)stopCurrent=null;return;}
   const utterance=new SpeechSynthesisUtterance(chunks[index++]);utteranceRef.current=utterance;
   utterance.lang=voice?.lang ?? fallbackLanguage;if(voice)utterance.voice=voice;utterance.rate=.92;utterance.volume=1;
   watchdog=setTimeout(()=>{if(live)fail('المتصفح لم يبدأ الصوت. تأكد من مستوى الصوت. '+voiceHelp);},8000);
   utterance.onstart=()=>{if(live){clearTimeout(watchdog);setStatus('speaking');}};
   utterance.onend=()=>{clearTimeout(watchdog);utteranceRef.current=null;next();};
   utterance.onerror=e=>{if(!live)return;clearTimeout(watchdog);if((e.error==='language-unavailable'||e.error==='voice-unavailable')&&!retried){retried=true;voice=undefined;fallbackLanguage='ar-SA';index--;next();return;}fail(e.error==='language-unavailable'||e.error==='voice-unavailable'?voiceHelp:'تعذّر تشغيل الصوت. تأكد من مستوى الصوت وأعد المحاولة.');};
   try{synth.resume?.();synth.speak(utterance);}catch{fail('تعذّر بدء القراءة في المتصفح. أعد المحاولة.');}
  }
  function begin(){
   if(!live)return;const voices=synth.getVoices();voice=chooseArabicVoice(voices);
   // An empty/incomplete voice list does not mean Arabic synthesis is unavailable.
   // Start synchronously in the click gesture so mobile browsers can choose their own voice.
   clearTimeout(watchdog);synth.removeEventListener?.('voiceschanged',begin);next();
  }
  begin();
 }
 if(!getText&&!text.trim())return null;
 return <div className="read-aloud"><button type="button" className="btn read-aloud__button" aria-label={status!=='idle'?`إيقاف ${label}`:label} aria-pressed={status!=='idle'} aria-busy={status==='loading'} onClick={toggle}>{status!=='idle'?<Square size={17} aria-hidden="true"/>:<Volume2 size={18} aria-hidden="true"/>}{status==='speaking'?'إيقاف القراءة':status==='loading'?'جارٍ تشغيل الصوت…':label}</button>{error&&<small role="status">{error}</small>}</div>;
}
