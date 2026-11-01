import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync('../natural-earth-land.geojson','utf8'));
const shapes=[];
for(const f of data.features){const polygons=f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates];for(const polygon of polygons){const ring=polygon[0];const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);if(Math.max(...xs)<-25||Math.min(...xs)>65||Math.max(...ys)<-36||Math.min(...ys)>42)continue;shapes.push(polygon.map(r=>r.map(([x,y],i)=>(i?'L':'M')+x.toFixed(3)+' '+(-y).toFixed(3)).join(' ')+'Z').join(' '));}}
fs.writeFileSync('public/assets/maps/land.js','export const landPaths='+JSON.stringify(shapes)+';\n');
