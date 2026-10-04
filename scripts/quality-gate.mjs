import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import {spawn,spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const validationDir=path.join(root,"docs","validation");
fs.mkdirSync(validationDir,{recursive:true});
const nodeSuites=[
 "audit-catalogue.mjs",
 "engine-equivalence.mjs",
 "campaign-tests.mjs",
 "persistence-tests.mjs",
 "analytics-tests.mjs",
 "module-structure-tests.mjs",
 "responsive-architecture-tests.mjs",
 "attempt-engine-tests.mjs",
 "performance-badge-tests.mjs",
 "daily-engagement-tests.mjs",
 "learning-tests.mjs",
 "social-challenge-tests.mjs",
 "social-challenge-ui-tests.mjs"
];

const started=[];
const summary=[];
const startedAt=Date.now();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function run(command,args,{env=process.env,cwd=root,label=command}={}){
 return new Promise((resolve,reject)=>{
  const t=Date.now(),child=spawn(command,args,{cwd,env,stdio:"inherit",shell:false});
  child.on("error",reject);
  child.on("exit",code=>{
   summary.push({label,seconds:Math.round((Date.now()-t)/100)/10,ok:code===0});
   if(code===0)resolve();else reject(Error(label+" failed with exit code "+code));
  });
 });
}
function mime(file){
 const ext=path.extname(file).toLowerCase();
 return {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".webmanifest":"application/manifest+json; charset=utf-8",".svg":"image/svg+xml"}[ext]||"application/octet-stream";
}
function startServer(){
 return new Promise((resolve,reject)=>{
  const port=Number(process.env.LUMEN_TEST_PORT||8000);
  const server=http.createServer((req,res)=>{
   try{
    const url=new URL(req.url,"http://127.0.0.1"),raw=decodeURIComponent(url.pathname),relative=raw==="/"?"index.html":raw.replace(/^\/+/, "");
    const file=path.resolve(root,relative);
    if(!file.startsWith(root)){res.writeHead(403);res.end("Forbidden");return}
    const stat=fs.existsSync(file)?fs.statSync(file):null;
    const target=stat?.isDirectory()?path.join(file,"index.html"):file;
    if(!fs.existsSync(target)){res.writeHead(404);res.end("Not found");return}
    res.writeHead(200,{"Content-Type":mime(target),"Cache-Control":"no-store"});fs.createReadStream(target).pipe(res);
   }catch(error){res.writeHead(500);res.end(String(error))}
  });
  server.once("error",reject);
  server.listen(port,"127.0.0.1",()=>{started.push(()=>new Promise(done=>server.close(()=>done())));resolve({server,port})});
 });
}
function chromeCandidates(){
 const c=[];
 if(process.env.LUMEN_CHROME_BIN)c.push(process.env.LUMEN_CHROME_BIN);
 if(process.platform==="win32"){
  for(const base of [process.env.PROGRAMFILES,process.env["PROGRAMFILES(X86)"],process.env.LOCALAPPDATA]){
   if(base)c.push(path.join(base,"Google","Chrome","Application","chrome.exe"),path.join(base,"Microsoft","Edge","Application","msedge.exe"));
  }
 }else{
  c.push("/usr/bin/chromium","/usr/bin/chromium-browser","/usr/bin/google-chrome","/usr/bin/google-chrome-stable");
 }
 return c.find(Boolean&&((x)=>fs.existsSync(x)));
}
async function stopProcess(child){
 if(!child||child.exitCode!==null)return;
 if(process.platform==="win32"){
  spawnSync("taskkill",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore"});
 }else{
  child.kill("SIGTERM");await sleep(250);if(child.exitCode===null)child.kill("SIGKILL");
 }
}
async function startChrome(port){
 const executable=chromeCandidates();
 if(!executable)throw Error("Chrome/Chromium not found. Set LUMEN_CHROME_BIN to the browser executable.");
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),"lumen-quality-"));
 const args=["--headless=new","--remote-debugging-port="+port,"--remote-debugging-address=127.0.0.1","--user-data-dir="+profile,"--no-first-run","--no-default-browser-check","--disable-dev-shm-usage","--no-sandbox","about:blank"];
 const child=spawn(executable,args,{cwd:root,stdio:"ignore",shell:false});
 const cleanup=async()=>{await stopProcess(child);fs.rmSync(profile,{recursive:true,force:true})};
 started.push(cleanup);
 for(let i=0;i<60;i++){
  if(child.exitCode!==null)throw Error("Chrome exited before CDP became ready");
  try{const response=await fetch("http://127.0.0.1:"+port+"/json/version");if(response.ok)return {child,profile,cleanup}}catch(_){}
  await sleep(100);
 }
 throw Error("Chrome CDP did not become ready on port "+port);
}
async function runBrowser(script,output,port){
 const chrome=await startChrome(port);
 try{
  await run(process.execPath,[path.join("scripts",script),path.join("docs","validation",output)],{
   env:{...process.env,LUMEN_TEST_URL:"http://127.0.0.1:"+(process.env.LUMEN_TEST_PORT||8000)+"/",LUMEN_CDP_URL:"http://127.0.0.1:"+port},
   label:script
  });
 }finally{await chrome.cleanup()}
}
async function cleanup(){
 while(started.length){const fn=started.pop();try{await fn()}catch(_){}}
}
let failed=null;
try{
 console.log("LUMEN quality gate — Node "+process.version+" — "+process.platform);
 for(const suite of nodeSuites)await run(process.execPath,[path.join("scripts",suite)],{label:suite});
 await startServer();
 await runBrowser("browser-tests.mjs","ci-browser.json",9222);
 await runBrowser("ux-cleanup-tests.mjs","ci-ux.json",9222);
 await runBrowser("learning-browser-tests.mjs","ci-learning.json",9223);
}catch(error){failed=error;console.error("\nQUALITY GATE FAILED:",error.message)}
finally{
 await cleanup();
 console.log("\nQuality summary");
 for(const item of summary)console.log((item.ok?"✓":"✗"),item.label,item.seconds+"s");
 console.log("Total",Math.round((Date.now()-startedAt)/100)/10+"s");
}
if(failed)process.exitCode=1;
