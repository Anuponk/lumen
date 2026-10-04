import vm from 'node:vm';
import {createGameEngine} from '../src/game/engine.js';
import {CAT} from '../src/campaign/catalogue.js';
import {CAMPAIGN6_ORDER,CAMPAIGN_SIZE_SCHEDULE,CONSTELLATIONS,CONSTELLATION_GRID_COUNTS,SKY_TARGET} from '../src/campaign/data.js';
import {skyStarsForGrid,campaignQuestCount} from '../src/campaign/progression.js';
const context={createGameEngine,CAT,CAMPAIGN6_ORDER,CAMPAIGN_SIZE_SCHEDULE,CONSTELLATIONS,skyStarsForGrid,campaignQuestCount};vm.createContext(context);
vm.runInContext('let n=6,puz=CAT["6"][0],state=[];function render(){};const {proofEngine}=createGameEngine(()=>({n,puz,state}),()=>true);',context);
const AUDIT_EXPRESSION = "(()=>{const old={n,puz,state};let failures=[],count=0,metadata=[];function enumerate(p,size){let total=0;function go(r,cols,regs,prev){if(total>1)return;if(r===size){total++;return}for(let c=0;c<size;c++){const g=p.reg[r][c];if(cols.has(c)||regs.has(g)||(prev!==null&&Math.abs(prev-c)<=1))continue;go(r+1,new Set([...cols,c]),new Set([...regs,g]),c)}}go(0,new Set(),new Set(),null);return total}function valid(p,size){return p.reg.length===size&&p.reg.every(r=>r.length===size)&&p.sol.length===size&&new Set(p.reg.flat()).size===size&&new Set(p.sol).size===size&&p.sol.every(c=>c>=0&&c<size)&&new Set(p.sol.map((c,r)=>p.reg[r][c])).size===size&&p.sol.every((c,r)=>!r||Math.abs(c-p.sol[r-1])>1)}try{for(const [sizeKey,puzzles]of Object.entries(CAT)){const size=Number(sizeKey);for(let index=0;index<puzzles.length;index++){const p=puzzles[index],id=sizeKey+'/'+index;count++;if(!valid(p,size)){failures.push({id,kind:'structure'});continue}for(const g of new Set(p.reg.flat())){let cells=[];for(let r=0;r<size;r++)for(let c=0;c<size;c++)if(p.reg[r][c]===g)cells.push([r,c]);if(cells.length<2&&!((id==='5/0'&&g===2&&p.reg[2][2]===2)||(id==='5/1'&&g===0&&p.reg[0][0]===0)))failures.push({id,kind:'singleton',region:g});const seen=new Set([cells[0].join(',')]),todo=[cells[0]];while(todo.length){const [r,c]=todo.pop();for(const [dy,dx]of [[1,0],[-1,0],[0,1],[0,-1]]){let y=r+dy,x=c+dx,k=y+','+x;if(y>=0&&y<size&&x>=0&&x<size&&p.reg[y][x]===g&&!seen.has(k)){seen.add(k);todo.push([y,x])}}}if(seen.size!==cells.length)failures.push({id,kind:'disconnected',region:g})}const solutions=enumerate(p,size);if(solutions!==1)failures.push({id,kind:'uniqueness',solutions});n=size;puz=p;state=Array.from({length:size},()=>Array(size).fill(0));let steps=0,rules={};for(;steps<200;steps++){if(state.flat().filter(v=>v===2).length===size)break;const h=proofEngine(),rule=h.detail?.rule;if(h.kind==='place'&&rule==='single'){state[h.cell[0]][h.cell[1]]=2}else if(h.kind==='elim'&&['locked','group','diamond','manual'].includes(rule)){state[h.cell[0]][h.cell[1]]=1}else{failures.push({id,kind:'explainability',step:steps,hint:h.kind,rule});break}rules[rule]=(rules[rule]||0)+1}if(steps===200)failures.push({id,kind:'replay-limit'});if(size<=5)metadata.push({id,solutions,steps,rules})}}const references=Object.values(CAMPAIGN_SIZE_SCHEDULE).map(([size,index])=>size+'/'+(size==='6'?CAMPAIGN6_ORDER[index]:index));if(references.length!==campaignQuestCount()||new Set(references).size!==campaignQuestCount())failures.push({kind:'schedule-count-duplicates'});for(const ref of references){const [size,index]=ref.split('/');if(!CAT[size]?.[index])failures.push({kind:'missing-reference',ref})}return {count,campaign:references.length,constellations:CONSTELLATIONS.length,stars:Array.from({length:campaignQuestCount()},(_,i)=>skyStarsForGrid(i)).reduce((a,b)=>a+b,0),failures,metadata}}finally{n=old.n;puz=old.puz;state=old.state;render()}})()\r\n";
// Retain the original structural/replay checks and audit metadata at every size.
const allMetadataExpression=AUDIT_EXPRESSION.replace('if(size<=5)metadata.push','metadata.push');
const result=vm.runInContext(allMetadataExpression,context,{timeout:30000});
const references=vm.runInContext('Object.values(CAMPAIGN_SIZE_SCHEDULE).map(([size,index])=>size+"/"+(size==="6"?CAMPAIGN6_ORDER[index]:index))',context);
result.campaignFailures=result.failures.filter(f=>references.includes(f.id)).map(f=>({...f,quest:references.indexOf(f.id)+1}));
for(const entry of result.metadata){
  const [size,index]=entry.id.split('/');
  const stored=vm.runInContext('CAT["'+size+'"]['+index+'].audit',context);
  // Legacy grids have no metadata; new generated grids and introductions do.
  if(!stored&&Number(size)>5)continue;
  const hardestRule=entry.rules.group?'group':entry.rules.locked?'locked':'single';
  if(!stored||stored.boardSize!==Number(size)||stored.solutionCount!==entry.solutions||stored.proofSteps!==entry.steps||stored.hardestRule!==hardestRule||JSON.stringify(stored.rules)!==JSON.stringify(entry.rules))result.failures.push({id:entry.id,kind:'audit-metadata'});
}
if(result.campaign!==campaignQuestCount()||result.constellations!==CONSTELLATION_GRID_COUNTS.length||result.stars!==SKY_TARGET||SKY_TARGET!==CONSTELLATIONS.reduce((sum,c)=>sum+c.count,0))result.failures.push({kind:'campaign-invariants'});

let start=0;
for(let ci=0;ci<CONSTELLATIONS.length;ci++){
 if(!Number.isInteger(CONSTELLATION_GRID_COUNTS[ci])||CONSTELLATION_GRID_COUNTS[ci]<1||!Number.isInteger(CONSTELLATIONS[ci].count)||CONSTELLATIONS[ci].count<CONSTELLATION_GRID_COUNTS[ci]||CONSTELLATIONS[ci].pts.length!==CONSTELLATIONS[ci].count){result.failures.push({kind:'constellation-definition',constellation:ci});continue}
 const count=CONSTELLATION_GRID_COUNTS[ci],earned=Array.from({length:count},(_,offset)=>skyStarsForGrid(start+offset)).reduce((sum,value)=>sum+value,0);
 if(earned!==CONSTELLATIONS[ci].count)result.failures.push({kind:'constellation-stars',constellation:ci,earned,expected:CONSTELLATIONS[ci].count});
 start+=count;
}
if(start!==campaignQuestCount()||Object.keys(CAMPAIGN_SIZE_SCHEDULE).some((key,index)=>Number(key)!==index))result.failures.push({kind:'campaign-coverage'});
process.exitCode=result.failures.length?1:0;
console.log(JSON.stringify(result,null,2));
