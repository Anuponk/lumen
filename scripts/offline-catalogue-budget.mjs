import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync,brotliCompressSync} from 'node:zlib';

const sw=fs.readFileSync('sw.js','utf8');
const match=sw.match(/const SHELL=\[([^\]]+)\]/);
assert(match,'Missing offline shell declaration');
const queue=JSON.parse('['+match[1]+']');
const seen=new Set();
const imports=/(?:import|export)\s+(?:[^'";]*?\s+from\s*)?["']([^"']+)["']/g;
let bytes=0,gzip=0,brotli=0;
const missing=[];
while(queue.length){
 const url=queue.shift();
 if(seen.has(url))continue;
 seen.add(url);
 const filename=url==='/'?'index.html':url.replace(/^\//,'');
 if(!fs.existsSync(filename)){missing.push(filename);continue}
 const buffer=fs.readFileSync(filename);
 bytes+=buffer.length;gzip+=gzipSync(buffer).length;brotli+=brotliCompressSync(buffer).length;
 if(/\.(?:js|mjs|css)$/.test(filename)){
  const source=buffer.toString('utf8');
  for(const match of source.matchAll(imports)){
   if(!match[1].startsWith('.')&&!match[1].startsWith('/'))continue;
   const resolved=path.posix.normalize(path.posix.join(path.posix.dirname('/'+filename),match[1]));
   if(resolved.startsWith('/src/')||resolved.startsWith('/content/'))queue.push(resolved);
  }
 }
 assert(seen.size<2000,'Unexpectedly large offline asset graph');
}
assert.equal(missing.length,0,'Offline assets missing: '+missing.join(', '));
const report={assetCount:seen.size,uncompressedBytes:bytes,gzipBytes:gzip,brotliBytes:brotli,estimatedBrotliMiB:Number((brotli/1048576).toFixed(2)),note:'Per-file compression estimate, not a measured network transfer; excludes runtime dynamic requests.'};
console.log(JSON.stringify(report,null,2));
if(brotli>10*1024*1024)console.warn('WARNING: Offline asset graph exceeds the 10 MiB Brotli target');
