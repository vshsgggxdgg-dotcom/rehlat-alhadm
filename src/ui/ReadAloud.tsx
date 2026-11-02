import { useEffect, useRef, useState } from 'react';
import { Volume2, Square } from 'lucide-react';
import { chooseArabicVoice, egyptianReading } from '../audio/reading';
let stopCurrent: (()=>void) | null = null;
export function ReadAloud({text,label}:{text:string;label:string}) {
 const [playing,setPlaying]=useState(false),[error,setError]=useState('');
 const ownStop=useRef<(()=>void)|null>(null);
 useEffect(()=>()=>{ownStop.current?.();},[text]);
 function toggle(){
  if(playing){ownStop.current?.();return;}
  if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){setError('القراءة الصوتية غير متاحة في المتصفح ده. جرّب Chrome أو Edge.');return;}
  stopCurrent?.();
  const synth=window.speechSynthesis,voice=chooseArabicVoice(synth.getVoices());
  let live=true;const stop=()=>{live=false;synth.cancel();setPlaying(false);if(stopCurrent===stop)stopCurrent=null;};
  ownStop.current=stop;stopCurrent=stop;setError('');setPlaying(true);synth.cancel();
  const chunks=egyptianReading(text).match(/.{1,160}(?:\s|$)|\S+/g) ?? [];
  let index=0;
  const next=()=>{
   if(!live)return;
   if(index>=chunks.length){setPlaying(false);if(stopCurrent===stop)stopCurrent=null;return;}
   const utterance=new SpeechSynthesisUtterance(chunks[index++]);
   utterance.lang=voice?.lang ?? 'ar-EG';if(voice)utterance.voice=voice;utterance.rate=.88;utterance.volume=1;
   utterance.onend=next;utterance.onerror=e=>{if(!live)return;stop();if(e.error!=='canceled'&&e.error!=='interrupted')setError('تعذّر تشغيل الصوت. تأكد إن جهازك فيه صوت عربي وجرّب تاني.');};
   synth.speak(utterance);
  };
  next();
 }
 if(!text.trim())return null;
 return <div className="read-aloud"><button type="button" className="btn read-aloud__button" aria-label={playing?`إيقاف ${label}`:label} aria-pressed={playing} onClick={toggle}>{playing?<Square size={17} aria-hidden="true"/>:<Volume2 size={18} aria-hidden="true"/>}{playing?'إيقاف القراءة':label}</button>{error&&<small role="status">{error}</small>}</div>;
}
