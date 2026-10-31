export function validateCourse(doc){
 if(!doc||typeof doc.title!=='string'||doc.title.length<3||doc.title.length>160) throw Error('عنوان الدرس مطلوب (٣–١٦٠ حرفًا).');
 if(!Array.isArray(doc.stations)||doc.stations.length!==4) throw Error('يجب أن يتضمن الدرس أربع محطات.');
 const ids=new Set();
 for(const [index,s] of doc.stations.entries()){
  if(s.id!==index+1||typeof s.title!=='string'||!s.title.trim()) throw Error('ترقيم المحطات أو عناوينها غير صحيح.');
  if(!Array.isArray(s.cards)||s.cards.length<1||s.cards.length>12) throw Error('كل محطة تحتاج من بطاقة إلى ١٢ بطاقة.');
  for(const c of s.cards) if(typeof c.title!=='string'||typeof c.text!=='string'||!c.text.trim()) throw Error('بطاقات الشرح غير مكتملة.');
  if(!Array.isArray(s.questions)||s.questions.length!==5) throw Error('كل محطة تحتاج خمسة أسئلة.');
  for(const q of s.questions) check(q);
 }
 if(!Array.isArray(doc.final)||doc.final.length!==8) throw Error('التحدي النهائي يحتاج ثمانية أسئلة.');
 for(const q of doc.final) check(q);
 if(JSON.stringify(doc).length>180000) throw Error('حجم الدرس أكبر من الحد المسموح.');
 return doc;
 function check(q){
  if(typeof q.id!=='string'||!/^[a-z0-9-]{1,60}$/.test(q.id)||ids.has(q.id)) throw Error('معرّفات الأسئلة يجب أن تكون فريدة.');
  ids.add(q.id);
  if(typeof q.prompt!=='string'||!q.prompt.trim()||!Array.isArray(q.options)||q.options.length!==4||q.options.some(o=>typeof o!=='string'||!o.trim())||new Set(q.options).size!==4||!Number.isInteger(q.answer)||q.answer<0||q.answer>3||typeof q.explanation!=='string'||!q.explanation.trim()) throw Error('راجع السؤال والاختيارات والإجابة والتفسير.');
 }
}
