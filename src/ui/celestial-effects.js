const clamp=value=>Math.min(1,Math.max(0,Number(value)||0));
function randomFor(id){let seed=2166136261;for(const c of String(id)){seed^=c.charCodeAt(0);seed=Math.imul(seed,16777619)}return ()=>{seed+=0x6D2B79F5;let n=seed;n=Math.imul(n^n>>>15,n|1);n^=n+Math.imul(n^n>>>7,n|61);return ((n^n>>>14)>>>0)/4294967296}}
// Decorative background coordinates, never astronomical stars or quest slots.
// Fixed bounded composition; progress changes opacity, never particle positions.
export function milkyWaySvg(id,value,box=[0,0,290,115],pulse=null){
 const ratio=clamp(value);if(!ratio)return '';
 const [x,y,width,height]=box,rand=randomFor(id),dots=[];
 for(let i=0;i<48;i++){
  const t=rand(),spread=(rand()-.5)*height*.65;
  const px=x+width*(.06+.88*t),py=y+height*(.75-.5*t)+spread;
  const onset=i/64,opacity=clamp((ratio-onset)/(1-onset))*(.25+rand()*.4);
  dots.push(`<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${(.35+rand()*.65).toFixed(2)}" opacity="${opacity.toFixed(3)}"/>`);
 }
 const band=clamp((ratio-.25)/.75),cx=x+width/2,cy=y+height/2;
 return `<g class="milky-way${pulse?' mastery-pulse'+(pulse.full?' mastery-arrival':''):''}" style="animation-delay:-${Math.max(0,pulse?.elapsed||0)}ms" aria-hidden="true" data-ratio="${ratio.toFixed(6)}"><g fill="#bfe9fa">${dots.join('')}</g><g fill="none" stroke-linecap="round"><path d="M ${x+width*.08} ${y+height*.76} Q ${cx} ${y+height*.3} ${x+width*.92} ${y+height*.24}" stroke="#87bde2" stroke-width="${height*.025}" opacity="${(band*.09).toFixed(3)}"/><path d="M ${x+width*.12} ${y+height*.78} Q ${cx} ${y+height*.25} ${x+width*.88} ${y+height*.26}" stroke="#d9cba0" stroke-width="${height*.01}" opacity="${(band*.13).toFixed(3)}"/></g><ellipse cx="${cx}" cy="${cy}" rx="${width*.38}" ry="${height*.32}" fill="#86c7ed" opacity="${(ratio**3*.025).toFixed(4)}"/><path class="mastery-signature" d="M ${x+width*.77} ${y+height*.21} l 1.5 -3 l 1.5 3 l -1.5 3 Z" fill="#e1d2a4" opacity="${(ratio**6*.65).toFixed(3)}"/></g>`;
}
