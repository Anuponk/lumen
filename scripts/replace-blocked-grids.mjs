// Offline, deterministic generation. Never imported by the game.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const appUrl=new URL('../index.html',import.meta.url);
const source=fs.readFileSync(appUrl,'utf8');
const normalized=source.replace(/\r/g,'');
function section(from,to){return normalized.slice(normalized.indexOf(from),normalized.indexOf(to,normalized.indexOf(from)))}
const context={document:{getElementById:()=>({checked:true})}};
vm.createContext(context);
vm.runInContext([
  section('const CAT=','const COLORS='),
  section('function isAutoCross(','function displayedCellState('),
  section('function key(','function directMissingCross()'),
  'let n=6,puz=CAT["6"][0],state=[];'
].join('\n'),context);
const catalogue=JSON.parse(vm.runInContext('JSON.stringify(CAT)',context));
const original=structuredClone(catalogue);
const replayScript=new vm.Script(`(()=>{
  n=candidate.reg.length;puz=candidate;state=Array.from({length:n},()=>Array(n).fill(0));
  const rules={};let steps=0;
  while(steps<200&&state.flat().filter(v=>v===2).length<n){
    const h=proofEngine(),rule=h.detail?.rule;
    if(h.kind==='place'&&rule==='single'&&candidate.sol[h.cell[0]]===h.cell[1])state[h.cell[0]][h.cell[1]]=2;
    else if(h.kind==='elim'&&['locked','group','diamond','manual'].includes(rule)&&candidate.sol[h.cell[0]]!==h.cell[1])state[h.cell[0]][h.cell[1]]=1;
    else return null;
    rules[rule]=(rules[rule]||0)+1;steps++;
  }
  if(state.flat().filter(v=>v===2).length!==n)return null;
  return {boardSize:n,solutionCount:1,proofSteps:steps,rules,hardestRule:rules.group?'group':rules.locked?'locked':'single'};
})()`);
function replay(p){context.candidate=p;return replayScript.runInContext(context,{timeout:1000})}
function solutions(p){
  const size=p.reg.length;let count=0;
  function visit(r,cols,regions,prev){
    if(count>=2)return;
    if(r===size){count++;return}
    for(let c=0;c<size;c++){
      const bit=1<<c,g=1<<p.reg[r][c];
      if((cols&bit)||(regions&g)||(r&&Math.abs(c-prev)<=1))continue;
      visit(r+1,cols|bit,regions|g,c);
    }
  }
  visit(0,0,0,-1);return count;
}
function signature(reg){
  const size=reg.length,variants=[];
  for(let flip=0;flip<2;flip++)for(let rotation=0;rotation<4;rotation++){
    const transformed=Array.from({length:size},()=>Array(size));
    for(let r=0;r<size;r++)for(let c=0;c<size;c++){
      let y=r,x=flip?size-1-c:c;
      for(let k=0;k<rotation;k++)[y,x]=[x,size-1-y];
      transformed[y][x]=reg[r][c];
    }
    const labels=new Map();variants.push(transformed.flat().map(g=>{if(!labels.has(g))labels.set(g,labels.size);return labels.get(g)}).join(','));
  }
  return variants.sort()[0];
}
let seed=20261003;
function random(){seed=(seed+0x6D2B79F5)>>>0;let t=seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}
function shuffle(values){for(let i=values.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[values[i],values[j]]=[values[j],values[i]]}return values}
function generate(size){
  let sol;do{sol=shuffle(Array.from({length:size},(_,i)=>i))}while(sol.some((c,r)=>r&&Math.abs(c-sol[r-1])<=1));
  const reg=Array.from({length:size},()=>Array(size).fill(-1)),counts=Array(size).fill(1);
  const weights=Array.from({length:size},()=>Math.exp(random()*5));
  sol.forEach((c,r)=>reg[r][c]=r);
  for(let remaining=size*size-size;remaining>0;remaining--){
    const frontier=[];let total=0;
    for(let r=0;r<size;r++)for(let c=0;c<size;c++)if(reg[r][c]<0){
      const neighbors=new Set();
      for(const [dy,dx]of [[1,0],[-1,0],[0,1],[0,-1]]){
        const g=reg[r+dy]?.[c+dx];if(g!==undefined&&g>=0)neighbors.add(g);
      }
      for(const g of neighbors){const weight=counts[g]<2?200:weights[g];total+=weight;frontier.push({r,c,g,total})}
    }
    const choice=random()*total,{r,c,g}=frontier.find(cell=>cell.total>choice);
    reg[r][c]=g;counts[g]++;
  }
  if(counts.some(count=>count<2))return null;
  // Normalize color identifiers by first appearance, without changing geometry.
  const labels=new Map();for(const row of reg)for(let c=0;c<size;c++){const g=row[c];if(!labels.has(g))labels.set(g,labels.size);row[c]=labels.get(g)}
  return {reg,sol};
}
const blocked=[];
for(const size of ['7','8'])catalogue[size].forEach((p,index)=>{if(!replay(p))blocked.push({size,index})});
if(!blocked.length){console.log('No blocked grids to replace.');process.exit(0)}
const seen=new Set(Object.values(catalogue).flat().map(p=>signature(p.reg)));
const replacements=[];let attempts=0;
for(const {size,index}of blocked){
  let accepted;
  for(let tries=0;tries<100000;tries++){
    attempts++;const p=generate(Number(size));if(!p)continue;
    const sig=signature(p.reg);if(seen.has(sig)||solutions(p)!==1)continue;
    const audit=replay(p);if(!audit)continue;
    accepted={...p,audit};seen.add(sig);break;
  }
  if(!accepted)throw Error('Generation budget exhausted: '+size+'/'+index);
  catalogue[size][index]=accepted;
  replacements.push({id:size+'/'+index,previousHash:crypto.createHash('sha256').update(JSON.stringify(original[size][index])).digest('hex'),puzzle:accepted});
  console.log('Generated '+size+'/'+index+': '+accepted.audit.proofSteps+' proof steps ('+attempts+' candidates)');
}
// Retain the two scripted introductions exactly; replace only the main CAT literal.
const mainCatalogue={6:catalogue['6'],7:catalogue['7'],8:catalogue['8']};
const updated=source.replace(/const CAT=\{[^\r\n]+\}, LEVELS=/,'const CAT='+JSON.stringify(mainCatalogue)+', LEVELS=');
if(updated===source&&blocked.length)throw Error('Catalogue literal not found');
const report={seed:20261003,attempts,replaced:replacements.length,replacements};
fs.mkdirSync(new URL('./generated/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('./generated/replacements-2026-10-03.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
if(process.argv.includes('--write')){
  fs.writeFileSync(appUrl,updated);
  // Audit the entire catalogue immediately, restoring the source if it fails.
  try{execFileSync(process.execPath,[fileURLToPath(new URL('./audit-catalogue.mjs',import.meta.url))],{stdio:'inherit'})}
  catch(error){fs.writeFileSync(appUrl,source);throw error}
}else console.log('Use --write to insert these audited replacements.');
