// Decorative sky lights only: never HIP stars or new constellation segments.
const halton=(index,base)=>{let value=0,fraction=1;for(let n=index;n>0;n=Math.floor(n/base)){fraction/=base;value+=fraction*(n%base);}return value;};
const segmentDistance=(p,a,b)=>{
 const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
 const t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0;
 return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
};
export function secondaryStarPositions(figure,count){
 if(!figure||!Number.isInteger(count)||count<=0)return [];
 const seed=[...figure.iau].reduce((sum,c)=>sum*31+c.charCodeAt(0),0)%997;
 const xs=figure.pts.map(p=>p[0]),ys=figure.pts.map(p=>p[1]);
 const bounds=[Math.min(...xs)-6,Math.max(...xs)+6,Math.min(...ys)-6,Math.max(...ys)+6];
 const points=[];let attempt=0,clearance=Math.min(14,120/Math.sqrt(count));
 // A filled sky field, not a ring. Prefer empty sky outside the figure bounds;
 // wide source figures can use free sky between lines. Dense future totals
 // reduce spacing rather than losing rewards or imposing a content cap.
 while(points.length<count){
  attempt++;
  if(attempt%Math.max(200,count*50)===0)clearance*=.8;
  const p=[12+266*halton(attempt+seed,2),12+91*halton(attempt+seed,3)];
  if(attempt<=128&&p[0]>bounds[0]&&p[0]<bounds[1]&&p[1]>bounds[2]&&p[1]<bounds[3])continue;
  if(figure.pts.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<Math.max(6,clearance)))continue;
  if(figure.edges.some(([a,b])=>segmentDistance(p,figure.pts[a],figure.pts[b])<Math.max(4,clearance*.55)))continue;
  if(points.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<clearance))continue;
  points.push(p.map(v=>Number(v.toFixed(3))));
 }
 return points;
}

export function secondaryStarsSvg(figure,total,earned,beforeEarned=earned){
 const count=Math.max(0,total-figure.count);
 if(!count)return '';
 const lit=Math.max(0,earned-figure.count),before=Math.max(0,beforeEarned-figure.count);
 const radius=Math.min(2.8,30/Math.sqrt(count));
 const shape=`M0 ${-radius} L${radius*.38} ${-radius*.38} L${radius} 0 L${radius*.38} ${radius*.38} L0 ${radius} L${-radius*.38} ${radius*.38} L${-radius} 0 L${-radius*.38} ${-radius*.38} Z`;
 const stars=secondaryStarPositions(figure,count).map(([x,y],i)=>'<path class="quest-secondary-star'+(i<lit?' on':'')+(i<lit&&i>=before?' new-secondary':'')+'" data-secondary-index="'+i+'" transform="translate('+x+' '+y+')" d="'+shape+'"/>').join('');
 return '<g class="quest-secondary-sky" aria-label="Étoiles secondaires : '+lit+' sur '+count+'">'+stars+'</g>';
}
