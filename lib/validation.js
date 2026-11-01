export function validateQuestion(q,ids=new Set(),advanced=true){
 if(!q||typeof q.id!=='string'||!/^[a-z0-9-]{1,60}$/.test(q.id)||ids.has(q.id))throw Error('معرّفات الأسئلة والأنشطة يجب أن تكون فريدة.');ids.add(q.id);
 if(typeof q.prompt!=='string'||!q.prompt.trim()||typeof q.explanation!=='string'||!q.explanation.trim())throw Error('السؤال والتفسير مطلوبان.');
 const type=q.type||'choice';if(!advanced&&type!=='choice')throw Error('نوع السؤال غير متاح لهذه النسخة.');
 if(!Array.isArray(q.options)||q.options.length<(advanced?2:4)||q.options.length>(advanced?8:4)||q.options.some(o=>typeof o!=='string'||!o.trim())||new Set(q.options).size!==q.options.length)throw Error('راجع عدد الاختيارات وتنوعها.');
 if(type==='choice'){if(!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length)throw Error('الإجابة الصحيحة خارج الاختيارات.');}
 else if(type==='hotspot'){if(!Array.isArray(q.targets)||q.targets.length<2||!q.targets.some(t=>t.id===q.answer)||q.targets.some(t=>typeof t.label!=='string'||!Number.isFinite(t.lon)||!Number.isFinite(t.lat)||Math.abs(t.lon)>180||Math.abs(t.lat)>90))throw Error('راجع مواضع الخريطة وإجابتها.');}
 else if(['classify','match','order'].includes(type)){
  if(!Array.isArray(q.items)||q.items.length<2||q.items.length>10||q.items.some(i=>typeof i.id!=='string'||typeof i.label!=='string')||new Set(q.items.map(i=>i.id)).size!==q.items.length)throw Error('راجع بطاقات النشاط.');
  const keys=q.items.map(i=>i.id);
  if(type==='order'){if(!Array.isArray(q.answer)||q.answer.length!==keys.length||new Set(q.answer).size!==keys.length||q.answer.some(a=>!keys.includes(a)))throw Error('ترتيب الإجابة غير صالح.');}
  else if(!Array.isArray(q.optionIds)||q.optionIds.length!==q.options.length||new Set(q.optionIds).size!==q.optionIds.length||!q.answer||Array.isArray(q.answer)||Object.keys(q.answer).length!==keys.length||keys.some(k=>!q.optionIds.includes(q.answer[k])))throw Error('راجع مفاتيح التوصيل والتصنيف.');
 }else throw Error('نوع السؤال غير معروف.');return q;
}
export function validateCourse(doc){
 if(!doc||typeof doc.title!=='string'||doc.title.length<3||doc.title.length>160)throw Error('عنوان الدرس مطلوب (٣–١٦٠ حرفًا).');
 if(!Array.isArray(doc.stations)||doc.stations.length!==4)throw Error('يجب أن يتضمن الدرس أربع محطات.');
 const ids=new Set(),advanced=doc.format===2;
 for(const[index,s]of doc.stations.entries()){
  if(s.id!==index+1||typeof s.title!=='string'||!s.title.trim())throw Error('ترقيم المحطات أو عناوينها غير صحيح.');
  if(!Array.isArray(s.cards)||s.cards.length<1||s.cards.length>12)throw Error('كل محطة تحتاج من بطاقة إلى ١٢ بطاقة.');checkCards(s.cards);
  if(!Array.isArray(s.questions)||s.questions.length!==5)throw Error('كل محطة تحتاج خمسة أسئلة.');for(const q of s.questions)validateQuestion(q,ids,advanced);
  if(advanced){if(!Array.isArray(s.pages)||s.pages.length<1||s.pages.length>16)throw Error('صفحات المحطة مطلوبة.');for(const p of s.pages){if(!/^[a-z0-9-]{1,60}$/.test(p.id)||ids.has(p.id)||!p.title)throw Error('راجع عنوان ومعرّف صفحة الشرح.');ids.add(p.id);checkCards(p.cards);if(p.exercise)validateQuestion(p.exercise,ids,true);}}
 }
 if(!Array.isArray(doc.final)||doc.final.length!==8)throw Error('التحدي النهائي يحتاج ثمانية أسئلة.');for(const q of doc.final)validateQuestion(q,ids,advanced);
 if(advanced){if(!Array.isArray(doc.evidence)||doc.evidence.length!==4)throw Error('ملفات الأدلة الأربعة مطلوبة.');for(const e of doc.evidence){if(ids.has(e.id)||!e.title||!Array.isArray(e.nodes))throw Error('ملف أدلة غير صالح.');ids.add(e.id);validateQuestion(e.exercise,ids,true);}}
 if(JSON.stringify(doc).length>180000)throw Error('حجم الدرس أكبر من الحد المسموح.');return doc;
 function checkCards(cards){if(!Array.isArray(cards)||cards.length<1||cards.some(c=>typeof c.title!=='string'||typeof c.text!=='string'||!c.text.trim()))throw Error('بطاقات الشرح غير مكتملة.');}
}
