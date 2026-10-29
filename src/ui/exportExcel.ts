export async function downloadExcel(sheets: {name: string; rows: unknown[][]}[]) {
  const ExcelJS = (await import('exceljs')).default;
  const book = new ExcelJS.Workbook(); book.creator = 'رحلة الهضم';
  for(const data of sheets) {
    const sheet = book.addWorksheet(data.name, {views:[{state:'frozen',ySplit:1,rightToLeft:true}]});
    for(const row of data.rows) sheet.addRow(row.map(v => typeof v === 'number' ? v : String(v ?? '')));
    sheet.columns.forEach(c => {c.width=26;});
    sheet.eachRow((row,index) => { row.height=index===1?32:48; row.eachCell(cell => {cell.alignment={vertical:'middle',wrapText:true,horizontal:'right'};cell.font={name:'Arial',size:11,color:{argb:index===1?'FFFFFFFF':'FF38262B'},bold:index===1};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:index===1?'FF672739':index%2?'FFFFF8ED':'FFFFFFFF'}};});});
    sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:data.rows[0].length}};
  }
  const buffer=await book.xlsx.writeBuffer();
  const url=URL.createObjectURL(new Blob([new Uint8Array(buffer)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
  const a=document.createElement('a');a.href=url;a.download=`تقرير-رحلة-الهضم-${new Date().toISOString().slice(0,10)}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
