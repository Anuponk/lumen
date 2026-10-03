import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {functionSource} from './source-tools.mjs';

const baseline='dcd9f3c872e623541be698edc212b64589d3b164';
const original=(process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):execFileSync('git',['show',baseline+':index.html'],{encoding:'utf8'})).replace(/\r/g,'');
const html=fs.readFileSync('index.html','utf8');
assert(!/<style\b|\sonclick\s*=/i.test(html),'Shell contains inline CSS or handlers');
for(const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
 assert(/\bsrc=/.test(script[1])&&!script[2].trim(),'Shell contains inline logic');
}
assert(html.includes('src="./src/main.js"'),'Module bootstrap missing');
const styles=original.match(/<style>([\s\S]*?)<\/style>/)[1].trim();
assert.equal(fs.readFileSync('src/ui/styles.css','utf8').replace(/\r/g,'').trim(),styles,'Styles changed');
const labels=source=>[...source.matchAll(/\btest\("([^"\n]+)"/g)].map(match=>match[1]);
const tests=labels(fs.readFileSync('src/testing/hint-tests.js','utf8'));
assert.equal(tests.length,66);
assert.deepEqual(tests,labels(functionSource(original,'runHintTests')),'Regression cases removed or renamed');
const graph=new Map();
function visit(filename,stack=[]){
 const file=path.resolve(filename);
 assert(!stack.includes(file),'Module import cycle: '+[...stack,file].join(' -> '));
 if(graph.has(file))return;
 const source=fs.readFileSync(file,'utf8');
 const imports=[...source.matchAll(/\bimport\s+(?:[\s\S]*?\s+from\s+)?["'](\.[^"']+)["']/g)].map(match=>path.resolve(path.dirname(file),match[1]));
 graph.set(file,imports);
 for(const target of imports){assert(fs.existsSync(target),'Missing import '+target);visit(target,[...stack,file])}
}
visit('src/main.js');
console.log(JSON.stringify({baseline,modules:graph.size,acyclic:true,shell:true,css:'identical',regressionCases:tests.length}));
