// #758: the « Comment jouer » page uses the real first quest of Lumen. This module derives
// the example (solution, uniqueness, the first two deductions) from the catalogue and the
// game rules, and draws the four illustrations. Run without arguments to regenerate the
// SVG files, with --check to fail when they no longer match the catalogue.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';

export const EXAMPLE_QUEST_ID='base-q001';
export const SVG_FILES={grid:'src/landing/how-to-play-grid.svg',step1:'src/landing/how-to-play-step1.svg',step2:'src/landing/how-to-play-step2.svg',solution:'src/landing/how-to-play-solution.svg'};

// Same territory colours as the game board.
function territoryColors(){
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 return JSON.parse(source.match(/const TERRITORY_COLORS=(\[[^\]]+\]);/)[1]);
}

const touches=([r1,c1],[r2,c2])=>Math.abs(r1-r2)<=1&&Math.abs(c1-c2)<=1;
export function conflicts(reg,a,b){
 return !(a[0]===b[0]&&a[1]===b[1])&&(a[0]===b[0]||a[1]===b[1]||reg[a[0]][a[1]]===reg[b[0]][b[1]]||touches(a,b));
}
// All placements satisfying the GAMEPLAY.md core rules (one per row, column, territory; no contact).
export function solutions(reg){
 const n=reg.length,found=[];
 const walk=(row,cols)=>{
  if(row===n){found.push([...cols]);return}
  for(let c=0;c<n;c++){
   const cell=[row,c];
   if(cols.some((cc,r)=>conflicts(reg,[r,cc],cell)))continue;
   cols.push(c);walk(row+1,cols);cols.pop();
  }
 };
 walk(0,[]);
 return found;
}

// The first two deductions a player can make, derived from the rules (no solution peeking):
// 1. a territory of a single cell holds its Gardien there;
// 2. after crossing out every cell that touches or shares a line with it, one territory
//    is left with a single possible cell.
export function exampleModel(){
 const quest=canonicalQuestList().find(q=>q.id===EXAMPLE_QUEST_ID);
 if(!quest)throw Error('Example quest missing: '+EXAMPLE_QUEST_ID);
 const {reg,sol}=quest,n=reg.length,cells=[];
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)cells.push([r,c]);
 const all=solutions(reg);
 if(all.length!==1||all[0].join()!==sol.join())throw Error('The example must have exactly the catalogue solution');
 const territory=t=>cells.filter(([r,c])=>reg[r][c]===t);
 const singles=[...new Set(reg.flat())].filter(t=>territory(t).length===1);
 if(singles.length!==1)throw Error('The example needs exactly one single-cell territory');
 const first=territory(singles[0])[0];
 const crossed1=cells.filter(cell=>conflicts(reg,first,cell));
 const open=cell=>!crossed1.some(x=>x[0]===cell[0]&&x[1]===cell[1])&&!(cell[0]===first[0]&&cell[1]===first[1]);
 const forced=[...new Set(reg.flat())].filter(t=>t!==singles[0]).map(t=>({t,left:territory(t).filter(open)})).filter(x=>x.left.length===1);
 if(forced.length<1)throw Error('No forced territory after the first Gardien');
 const second=forced[0].left[0];
 const crossed2=cells.filter(cell=>conflicts(reg,second,cell));
 for(const [r,c] of [first,second])if(sol[r]!==c)throw Error('A deduction disagrees with the solution');
 return {quest,reg,sol,n,first,second,firstTerritory:singles[0],secondTerritory:forced[0].t,crossed1,crossed2,
  label:([r,c])=>'ligne '+(r+1)+', colonne '+(c+1)};
}

function svg(model,{gardiens=[],crossed=[],highlight=null,title}){
 const colors=territoryColors(),{reg,n}=model,s=48,pad=4,size=n*s+pad*2;
 const key=([r,c])=>r+','+c,cross=new Set(crossed.map(key)),guard=new Set(gardiens.map(key));
 const out=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${title}">`,
  `<rect width="${size}" height="${size}" rx="10" fill="#0b1726"/>`];
 for(let r=0;r<n;r++)for(let c=0;c<n;c++){
  const x=pad+c*s,y=pad+r*s,color=colors[reg[r][c]%colors.length];
  out.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${color}" fill-opacity="0.85" stroke="#0b1726" stroke-opacity="0.5"/>`);
 }
 // Thick borders between territories.
 for(let r=0;r<n;r++)for(let c=0;c<n;c++){
  const x=pad+c*s,y=pad+r*s;
  if(c+1<n&&reg[r][c]!==reg[r][c+1])out.push(`<line x1="${x+s}" y1="${y}" x2="${x+s}" y2="${y+s}" stroke="#e6f2fb" stroke-width="3"/>`);
  if(r+1<n&&reg[r][c]!==reg[r+1][c])out.push(`<line x1="${x}" y1="${y+s}" x2="${x+s}" y2="${y+s}" stroke="#e6f2fb" stroke-width="3"/>`);
 }
 out.push(`<rect x="${pad}" y="${pad}" width="${n*s}" height="${n*s}" fill="none" stroke="#e6f2fb" stroke-width="3"/>`);
 for(let r=0;r<n;r++)for(let c=0;c<n;c++){
  const cx=pad+c*s+s/2,cy=pad+r*s+s/2;
  if(guard.has(key([r,c]))){
   if(highlight&&key(highlight)===key([r,c]))out.push(`<circle cx="${cx}" cy="${cy}" r="${s/2-4}" fill="none" stroke="#f2d48a" stroke-width="3"/>`);
   out.push(`<text x="${cx}" y="${cy+9}" font-family="sans-serif" font-size="28" text-anchor="middle" fill="#f2d48a">★</text>`);
  }else if(cross.has(key([r,c])))out.push(`<path d="M${cx-8} ${cy-8}L${cx+8} ${cy+8}M${cx+8} ${cy-8}L${cx-8} ${cy+8}" stroke="#0b1726" stroke-opacity="0.75" stroke-width="3" stroke-linecap="round"/>`);
 }
 out.push('</svg>');
 return out.join('\n')+'\n';
}

export function illustrations(model=exampleModel()){
 const {first,second,sol,crossed1,crossed2}=model;
 const both=[...crossed1,...crossed2];
 return {
  grid:svg(model,{title:'Grille d’exemple 5 × 5 découpée en cinq territoires de couleur'}),
  step1:svg(model,{gardiens:[first],crossed:crossed1,highlight:first,title:'Étape 1 : le Gardien du territoire d’une seule case, et les cases qu’il élimine'}),
  step2:svg(model,{gardiens:[first,second],crossed:both,highlight:second,title:'Étape 2 : il ne reste qu’une case possible dans un territoire, son Gardien y va'}),
  solution:svg(model,{gardiens:sol.map((c,r)=>[r,c]),title:'Solution : cinq Gardiens, un par ligne, colonne et territoire, sans contact'})
 };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const check=process.argv.includes('--check'),drawn=illustrations();
 for(const [name,file] of Object.entries(SVG_FILES)){
  if(check){if(!fs.existsSync(file)||fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')!==drawn[name])throw Error(file+' is stale: run node scripts/how-to-play.mjs')}
  else fs.writeFileSync(file,drawn[name]);
 }
 console.log(check?'how-to-play: illustrations match the catalogue':'how-to-play: illustrations written');
}
