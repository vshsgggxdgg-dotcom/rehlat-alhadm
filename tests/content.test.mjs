import test from 'node:test';
import assert from 'node:assert/strict';
import {course} from '../database/seed.mjs';
import {validateCourse} from '../lib/validation.js';
import {readFileSync} from 'node:fs';
test('curriculum covers all four stations, 28 questions and five outcomes',()=>{assert.equal(course.stations.length,4);assert.equal(course.stations.flatMap(s=>s.questions).length,20);assert.equal(course.final.length,8);assert.equal(course.stations[3].cards.length,5);assert.equal(4*5*3+8*5,100);});
test('rejects duplicate question identities, invalid answer indexes and missing explanations',()=>{for(const change of [d=>d.final[0].id=d.stations[0].questions[0].id,d=>d.final[0].answer=4,d=>d.final[0].explanation='',d=>d.stations.pop(),d=>d.final[0].options[1]=d.final[0].options[0]]){const d=structuredClone(course);change(d);assert.throws(()=>validateCourse(d));}});
test('published frontend does not bundle answer keys or source curriculum',()=>{const files=['app.js','cloud.js','art.js','index.html'].map(f=>readFileSync(new URL('../public/'+f,import.meta.url),'utf8')).join('');assert.ok(!files.includes('s1-q1'));assert.ok(!files.includes('service_role'));assert.ok(!/from ['"]react/.test(files));});
