const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
test('Excel export retains Arabic text and formula-like names as text with RTL sheets',async()=>{
 const source=fs.readFileSync(require('node:path').join(__dirname,'../src/ui/exportExcel.ts'),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 let blob,filename;const mod={exports:{}};
 vm.runInNewContext(`(function(require,module,exports){${code}})`,{Blob,Uint8Array,URL:{createObjectURL:b=>{blob=b;return 'blob:test';},revokeObjectURL:()=>{}},document:{createElement:()=>({set download(v){filename=v;},click(){}})},setTimeout:()=>{}})(require,mod,mod.exports);
 await mod.exports.downloadExcel([{name:'الطلاب',rows:[['الاسم','الدرجة'],['=HYPERLINK("bad")',3],['أحمد محمد علي',8]]},{name:'الإجابات',rows:[['الإجابة'],['المعدة']]}]);
 assert.match(filename,/\.xlsx$/);const Excel=require('exceljs'),book=new Excel.Workbook();await book.xlsx.load(Buffer.from(await blob.arrayBuffer()));
 assert.equal(book.worksheets.length,2);assert.equal(book.worksheets[0].getCell('A2').value,'=HYPERLINK("bad")');assert.equal(book.worksheets[0].getCell('B3').value,8);assert.equal(book.worksheets[0].views[0].rightToLeft,true);assert.equal(book.worksheets[0].views[0].ySplit,1);
});
