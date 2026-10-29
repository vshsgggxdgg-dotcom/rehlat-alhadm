const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync('src/backend/supabaseClient.ts','utf8');
function load(rpcResult){
 const exports={};let signIns=0;
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'abc-123'}}},error:null}),signInAnonymously:async()=>{signIns++;throw Error('Existing session should be reused')}},rpc:async()=>rpcResult};
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const context={exports,require:n=>n==='@supabase/supabase-js'?{createClient:()=>client}:n.includes('ids')?{asStudentId:x=>x}: {},console};
 vm.runInNewContext(js,context);
 return {resolve:exports.resolveProductionSessionIdentity,signIns:()=>signIns};
}
const env={isSupabaseConfigured:true,supabaseUrl:'https://test.supabase.co',supabasePublishableKey:'public-test',contentVersionId:'test-version'};
test('uses exact server student ID and reuses current auth session',async()=>{const m=load({data:{studentId:'stu_abc123'},error:null});const r=await m.resolve(env,'أحمد','boy-omar');assert.equal(r.studentId,'stu_abc123');assert.equal(r.authProvider,'supabase_anonymous');assert.equal(m.signIns(),0)});
test('does not claim success when profile RPC fails',async()=>{const m=load({data:null,error:{message:'missing content'}});const r=await m.resolve(env,'أحمد','boy-omar');assert.equal(r.studentId,null);assert.equal(r.authProvider,'unconfigured')});
test('rejects incomplete RPC response instead of inventing profile identity',async()=>{const m=load({data:{},error:null});const r=await m.resolve(env,'أحمد','boy-omar');assert.equal(r.studentId,null)});
