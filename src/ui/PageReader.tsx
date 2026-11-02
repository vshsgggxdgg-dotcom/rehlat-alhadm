import { ReadAloud } from './ReadAloud';
export function visiblePageText(root:HTMLElement):string {
 const walker=document.createTreeWalker(root,4);const parts:string[]=[];let node:Node|null;
 while((node=walker.nextNode())){
  const parent=node.parentElement;
  if(!parent||parent.closest('.read-aloud,.page-reader,[aria-hidden="true"],[hidden],script,style'))continue;
  const range=document.createRange();range.selectNodeContents(node);
  if(!range.getClientRects().length||window.getComputedStyle(parent).visibility==='hidden')continue;
  const text=node.textContent?.replace(/\s+/g,' ').trim();if(text)parts.push(text);
 }
 return parts.join(' ');
}
export function PageReader({scope}:{scope:string}) {
 return <aside className="page-reader" aria-label="قارئ الصفحة"><ReadAloud label="قراءة الصفحة" scopeKey={scope} getText={()=>{const main=document.querySelector<HTMLElement>('main');return main?visiblePageText(main):'';}}/></aside>;
}
