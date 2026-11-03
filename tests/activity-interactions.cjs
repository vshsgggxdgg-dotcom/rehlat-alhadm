const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');
const {JSDOM}=require('jsdom');const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost'});
global.window=dom.window;global.document=dom.window.document;global.HTMLElement=dom.window.HTMLElement;Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});global.IS_REACT_ACT_ENVIRONMENT=true;
class TestPointerEvent extends dom.window.MouseEvent{constructor(type,opts={}){super(type,opts);this.pointerType=opts.pointerType??'touch';this.pointerId=opts.pointerId??1;}}
dom.window.PointerEvent=TestPointerEvent;dom.window.HTMLElement.prototype.setPointerCapture=function(){};
const React=require('react');const {render,fireEvent,cleanup,waitFor}=require('@testing-library/react');
let cloudOverride=null;const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const req=id=>{if(id==='../backend/cloud' && cloudOverride)return cloudOverride;if(id==='../backend/cloud')return {loadManifest:async()=>m,adminCloud:{from:()=>({select:()=>({eq:async()=>({data:all.map(a=>({activity_id:a.activityId,canonical_correct_answer:'test-answer',scientific_hint_ar:'تلميح',scientific_explanation_ar:'تفسير'})),error:null})})})}};if(!id.startsWith('.'))return require(id);const p=path.resolve(path.dirname(file),id);return load(fs.existsSync(p+'.tsx')?p+'.tsx':p+'.ts');};vm.runInNewContext(`(function(require,module,exports){${js}\n})`,{console,window:dom.window,document:dom.window.document,setTimeout,clearTimeout,Map,Set,Date,structuredClone,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},ResizeObserver:undefined})(req,mod,mod.exports);return mod.exports;}
const {ActivityRendererRegistry}=load('src/activities/ActivityRendererRegistry.tsx');const {DIGESTION_CURRICULUM_MANIFEST:m}=load('src/content/digestionManifest.ts');
const all=m.levels.flatMap(l=>l.activities);function props(activity,extra={}){return {activity,activityIndex:0,totalActivitiesInLevel:2,studentName:'اختبار',draftSelectedOptionId:'',previousAttempts:[],disabled:false,onDraftOptionChange:()=>{},onSubmitAttempt:()=>{},...extra};}
test.afterEach(cleanup);
test('browser content exposes no canonical answers or premature feedback',()=>{for(const a of all){assert.equal(a.correctOptionId,'__SERVER_PROTECTED_ANSWER_KEY__');assert.equal(a.scientificHintAr,'');assert.equal(a.scientificExplanationAr,'');for(const b of a.fillInConfig?.blanks??[])assert.equal(b.correctWordId,'__SERVER_PROTECTED_ANSWER_KEY__');assert.equal(a.orderingConfig?.correctOrderIds.length??0,0);assert.equal(a.matchingConfig?.correctPairs.length??0,0);for(const o of a.options)assert.equal(o.feedbackAr,'');}});
test('incomplete input consumes no attempt',()=>{let count=0;const a=all.find(a=>a.type==='fill_in');const ui=render(React.createElement(ActivityRendererRegistry,props(a,{onSubmitAttempt:()=>count++})));fireEvent.submit(ui.container.querySelector('form'));assert.equal(count,0);assert.ok(ui.getByTestId('incomplete-input-alert'));});
test('failed request releases submit lock and keeps draft retryable',async()=>{let count=0;const a=all.find(a=>a.type==='multiple_choice');const ui=render(React.createElement(ActivityRendererRegistry,props(a,{draftSelectedOptionId:a.options[0].optionId,onSubmitAttempt:async()=>{count++;throw Error('offline');}})));fireEvent.submit(ui.container.querySelector('form'));await waitFor(()=>assert.ok(ui.getByTestId('incomplete-input-alert')));fireEvent.submit(ui.container.querySelector('form'));await waitFor(()=>assert.equal(count,2));});
test('duplicate submit while request pending sends one request',async()=>{let finish,count=0;const a=all.find(a=>a.type==='multiple_choice');const ui=render(React.createElement(ActivityRendererRegistry,props(a,{draftSelectedOptionId:a.options[0].optionId,onSubmitAttempt:()=>{count++;return new Promise(resolve=>{finish=resolve;});}})));const form=ui.container.querySelector('form');fireEvent.submit(form);fireEvent.submit(form);assert.equal(count,1);await React.act(async()=>finish());});
test('touch drag reorders a card at the visible insertion target',()=>{let draft;const a=all.find(a=>a.type==='ordering');const ui=render(React.createElement(ActivityRendererRegistry,props(a,{onDraftOptionChange:value=>{draft=value;}})));const cards=[...ui.container.querySelectorAll('.ordering-card')];cards.forEach((c,i)=>c.getBoundingClientRect=()=>({top:i*50,height:40}));const handle=ui.container.querySelector('.ordering-card__drag-surface');fireEvent.pointerDown(handle,{pointerType:'touch',clientY:10,pointerId:1});fireEvent.pointerMove(handle,{pointerType:'touch',clientY:1000,pointerId:1});fireEvent.pointerUp(handle,{pointerType:'touch',clientY:1000,pointerId:1});const initial=a.orderingConfig.initialOrderIds;assert.equal(draft,[...initial.slice(1),initial[0]].join('>'));});
test('touch word drop updates blank without submitting an attempt',()=>{let draft,count=0;const a=all.find(a=>a.type==='fill_in');const ui=render(React.createElement(ActivityRendererRegistry,props(a,{onDraftOptionChange:v=>{draft=v;},onSubmitAttempt:()=>count++})));const word=ui.container.querySelector('.word-card-chip'),blank=ui.container.querySelector('.fill-in-blank-slot');dom.window.document.elementFromPoint=()=>blank;fireEvent.pointerDown(word,{pointerType:'touch',clientX:5,clientY:5,pointerId:1});fireEvent.pointerMove(word,{pointerType:'touch',clientX:50,clientY:60,pointerId:1});fireEvent.pointerUp(word,{pointerType:'touch',clientX:50,clientY:60,pointerId:1});assert.equal(draft,`${a.fillInConfig.blanks[0].blankId}:${a.fillInConfig.wordCards[0].wordId}`);assert.equal(count,0);});

test('anatomy selection reveals organ name without letter badges',()=>{const a=all.find(a=>a.imageIdentificationConfig?.mode==='hotspot_select');let draft='';const make=()=>React.createElement(ActivityRendererRegistry,props(a,{draftSelectedOptionId:draft,onDraftOptionChange:v=>{draft=v;}}));const ui=render(make());const target=ui.container.querySelector('.anatomy-hotspot--organ');assert.ok(target);assert.equal(ui.container.querySelectorAll('.anatomy-hotspot--badge').length,0);assert.equal(target.textContent.trim(),'');fireEvent.click(target);ui.rerender(make());assert.ok(ui.container.querySelector('.anatomy-hotspot--selected').textContent.trim().length>1);});

test('label placement keeps compact location markers and full selected names separate',()=>{
 const a=all.find(a=>a.imageIdentificationConfig?.mode==='label_placement');let draft='';
 const make=()=>React.createElement(ActivityRendererRegistry,props(a,{draftSelectedOptionId:draft,onDraftOptionChange:v=>{draft=v;}}));
 const ui=render(make());
 for(const marker of ui.container.querySelectorAll('.anatomy-drop-pin__letter')) assert.equal(marker.textContent.length,1);
 const first=a.imageIdentificationConfig.labelsToPlace[0];
 fireEvent.click(ui.getByRole('button',{name:first.labelAr,exact:true}));
 ui.rerender(make());fireEvent.click(ui.container.querySelector('.anatomy-drop-pin'));ui.rerender(make());
 assert.ok(ui.getByRole('group',{name:'المسميات الموضوعة على الرسم'}).textContent.includes(first.labelAr));
 assert.ok(draft.includes(first.labelId));
});

test('six achievement medals use different image assets and meaningful names',()=>{
 const {LevelBadgeIllustration}=load('src/ui/illustrations/TransparentIllustrations.tsx');
 const ui=render(React.createElement('div',{},...Array.from({length:6},(_,i)=>React.createElement(LevelBadgeIllustration,{key:i,order:i+1,earned:true}))));
 const sources=[...ui.container.querySelectorAll('img')].map(e=>e.getAttribute('src'));
 assert.equal(new Set(sources).size,6);
 for(const source of sources)assert.ok(fs.existsSync(path.join('public',source)));
 assert.ok(ui.getByRole('img',{name:'وسام المستكشف الصغير — مكتسب'}));
});
test('all 26 activity renderers open independently in admin preview',()=>{for(const a of all){const ui=render(React.createElement(ActivityRendererRegistry,props(a)));assert.ok(ui.container.querySelector('form'),a.activityId);ui.unmount();}});

test('administrator opens final level and skips questions without student identity or submissions',async()=>{const {AdminExplorer}=load('src/ui/AdminExplorer.tsx');const ui=render(React.createElement(AdminExplorer,{onManage:()=>{},onExit:()=>{}}));await waitFor(()=>assert.ok(ui.getByRole('button',{name:'افتح المستوى 6'})));fireEvent.click(ui.getByRole('button',{name:'افتح المستوى 6'}));assert.ok(ui.getByRole('heading',{name:m.levels[5].activities[0].titleAr}));fireEvent.click(ui.getByRole('button',{name:'السؤال التالي بدون إجابة'}));assert.ok(ui.getByRole('heading',{name:m.levels[5].activities[1].titleAr}));fireEvent.change(ui.getByLabelText('انتقل لأي سؤال'),{target:{value:'3'}});assert.ok(ui.getByRole('heading',{name:m.levels[5].activities[3].titleAr}));});

test('read-aloud reads the actual text, prefers Arabic voice and stops',()=>{let spoken,cancels=0;Object.defineProperty(dom.window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{lang:'en-US'},{lang:'ar-EG'}],cancel:()=>cancels++,speak:u=>{spoken=u;}}});dom.window.SpeechSynthesisUtterance=function(){};const {ReadAloud}=load('src/ui/ReadAloud.tsx');const ui=render(React.createElement(ReadAloud,{text:'ما وظيفة المعدة؟',label:'اسمع السؤال'}));fireEvent.click(ui.getByRole('button',{name:'اسمع السؤال'}));assert.equal(spoken.text,'ما وظيفة المعدة؟');assert.equal(spoken.lang,'ar-EG');assert.equal(spoken.rate,.92);fireEvent.click(ui.getByRole('button',{name:'إيقاف اسمع السؤال'}));assert.ok(cancels>=2);});
test('student cannot trigger explanation narration before it is disclosed',()=>{const a=all.find(a=>a.type==='multiple_choice');const ui=render(React.createElement(ActivityRendererRegistry,props(a)));assert.ok(ui.getByRole('button',{name:'اسمع السؤال'}));assert.equal(ui.queryByRole('button',{name:'اسمع الشرح'}),null);assert.equal(ui.queryByRole('button',{name:'اسمع التلميح'}),null);});


test('reader marks actual speech start only after the engine start event',()=>{let utterance;Object.defineProperty(dom.window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{lang:'ar-EG'}],cancel:()=>{},speak:u=>utterance=u}});dom.window.SpeechSynthesisUtterance=function(){};const {ReadAloud}=load('src/ui/ReadAloud.tsx');const ui=render(React.createElement(ReadAloud,{text:'اختبار الصوت',label:'اسمع السؤال'}));fireEvent.click(ui.getByRole('button',{name:'اسمع السؤال'}));let button=ui.getByRole('button',{name:'إيقاف اسمع السؤال'});assert.equal(button.getAttribute('aria-busy'),'true');React.act(()=>utterance.onstart());assert.equal(button.getAttribute('aria-busy'),'false');assert.match(button.textContent,/إيقاف القراءة/);});

test('reader tries Arabic even when browser only lists English voices',()=>{let spoken;Object.defineProperty(dom.window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{lang:'en-US'}],cancel:()=>{},speak:u=>spoken=u}});dom.window.SpeechSynthesisUtterance=function(){};const {ReadAloud}=load('src/ui/ReadAloud.tsx');const ui=render(React.createElement(ReadAloud,{text:'اختبار',label:'اسمع السؤال'}));fireEvent.click(ui.getByRole('button',{name:'اسمع السؤال'}));assert.equal(spoken.lang,'ar-EG');assert.equal(spoken.voice,undefined);assert.equal(ui.queryByRole('status'),null);});
test('mobile speech help does not show Windows instructions',()=>{const {arabicVoiceHelp}=load('src/audio/reading.ts');assert.doesNotMatch(arabicVoiceHelp('Android Chrome'),/Windows/);assert.doesNotMatch(arabicVoiceHelp('iPhone Safari'),/Windows/);assert.match(arabicVoiceHelp('Windows Chrome'),/Windows/);});

test('two chances remain until a recorded attempt; timer stops when completed',()=>{
 const {ChallengeStatus}=load('src/ui/ChallengeStatus.tsx');
 const ui=render(React.createElement(ChallengeStatus,{used:0,finished:false,paused:false,activityId:'test'}));
 assert.equal(ui.container.querySelectorAll('.is-available').length,2);
 assert.ok(ui.getByRole('timer'));
 ui.rerender(React.createElement(ChallengeStatus,{used:1,finished:false,paused:false,activityId:'test'}));
 assert.equal(ui.container.querySelectorAll('.is-available').length,1);
 assert.match(ui.getByRole('status').textContent,/باقي فرصة واحدة/);
 ui.rerender(React.createElement(ChallengeStatus,{used:1,finished:true,paused:false,activityId:'test'}));
 assert.equal(ui.container.querySelectorAll('.is-available').length,0);
 assert.match(ui.getByRole('status').textContent,/اكتمل التحدي/);
});

test('recorded feedback reads hint first, then result and explanation without early solution',()=>{
 const spoken=[];
 Object.defineProperty(dom.window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{lang:'ar-EG'}],cancel:()=>{},speak:u=>spoken.push(u)}});
 dom.window.SpeechSynthesisUtterance=function(){};
 const a=all.find(a=>a.type==='multiple_choice');
 const first={attemptId:'a1',activityId:a.activityId,contentVersionId:m.contentVersionId,attemptNumber:1,isCorrect:false,scoreEarned:0,maxScore:a.maxScore,selectedOptionId:'wrong',durationMs:500,submittedAtIso:'2026-11-03T00:00:00Z',syncedToBackend:true,revealedHintAr:'راجع وظيفة المعدة'};
 const ui=render(React.createElement(ActivityRendererRegistry,props(a,{previousAttempts:[first]})));
 assert.match(spoken.map(u=>u.text).join(' '),/راجع وظيفة المعدة/);
 assert.equal(ui.queryByRole('button',{name:'اسمع النتيجة والشرح'}),null);
 const second={...first,attemptId:'a2',attemptNumber:2,isCorrect:true,scoreEarned:a.maxScore/2,revealedExplanationAr:'المعدة تخلط الطعام',revealedCorrectAnswer:a.options[0].optionId};
 ui.rerender(React.createElement(ActivityRendererRegistry,props(a,{previousAttempts:[first,second]})));
 assert.ok(ui.getByRole('button',{name:'إيقاف اسمع النتيجة والشرح'}));
 assert.match(spoken.map(u=>u.text).join(' '),/حصلت على/);
 assert.match(spoken.map(u=>u.text).join(' '),/المعدة تخلط الطعام/);
});

test('admin dashboard separates reports, editing and preview; student table paginates and filters',async()=>{
 const fixtures={content_versions:[{content_version_id:m.contentVersionId,status:'published'}],activity_answer_keys:[],student_profiles:Array.from({length:21},(_,i)=>({student_id:`s${i}`,display_name:`طالب الاختبار ${i}`,class_name:i===20?'6/6':'6/1'})),activity_submissions:[],student_level_best_scores:[],curriculum_activities:[],student_journeys:[],scored_level_runs:[]};
 cloudOverride={loadManifest:async()=>m,adminCloud:{rpc:async()=>({data:{isAdmin:true},error:null}),from:table=>{const q={select:()=>q,order:()=>q,eq:()=>q,range:async(a,b)=>({data:(fixtures[table]??[]).slice(a,b+1),error:null}),then:resolve=>Promise.resolve({data:fixtures[table]??[],error:null}).then(resolve)};return q;}}};
 try {
  const {Admin}=load('src/ui/Admin.tsx');const ui=render(React.createElement(Admin,{manifest:m,onExplore:()=>{},onPublished:async()=>{}}));
  await waitFor(()=>assert.ok(ui.getByRole('table',{name:'الطلاب — 21 نتيجة'})));
  assert.equal(ui.getAllByRole('button',{name:'عرض الإجابات'}).length,20);
  fireEvent.click(ui.getByRole('button',{name:'التالي',exact:true}));
  assert.equal(ui.getAllByRole('button',{name:'عرض الإجابات'}).length,1);
  fireEvent.change(ui.getByLabelText('الفصل',{exact:true}),{target:{value:'6/6'}});
  assert.ok(ui.getByRole('table',{name:'الطلاب — 1 نتيجة'}));
  assert.equal(ui.queryByRole('button',{name:'حفظ المسودة'}),null);
  fireEvent.click(ui.getByRole('button',{name:'إدارة المحتوى',exact:true}));
  assert.ok(ui.getByRole('button',{name:'حفظ المسودة'}).disabled);
  assert.equal(ui.queryByRole('table'),null);
  fireEvent.click(ui.getByRole('button',{name:'معاينة الأنشطة',exact:true}));
  assert.ok(ui.getByRole('button',{name:'اسمع السؤال'}));
  assert.equal(ui.queryByRole('button',{name:'حفظ المسودة'}),null);
 } finally {cloudOverride=null;}
});
