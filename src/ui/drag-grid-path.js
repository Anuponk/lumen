// Enumerate every cell crossed by a straight segment, including coalesced moves.
// Midpoints between grid-line crossings avoid skipping thin/diagonal intervals.
export function gridCellsAlongSegment(from,to,rect,size){
 const {left,top,width,height}=rect;
 if(!Number.isInteger(size)||size<1||![...from,...to,left,top,width,height].every(Number.isFinite)||width<=0||height<=0)return [];
 const dx=to[0]-from[0],dy=to[1]-from[1],cuts=[0,1];
 for(let i=0;i<=size;i++){
  if(dx){const t=(left+i*width/size-from[0])/dx;if(t>0&&t<1)cuts.push(t)}
  if(dy){const t=(top+i*height/size-from[1])/dy;if(t>0&&t<1)cuts.push(t)}
 }
 cuts.sort((a,b)=>a-b);const cells=[];
 const add=t=>{const x=(from[0]+dx*t-left)/width,y=(from[1]+dy*t-top)/height;
  if(x<0||x>=1||y<0||y>=1)return;const cell=[Math.floor(y*size),Math.floor(x*size)];
  if(!cells.length||cells.at(-1).some((v,i)=>v!==cell[i]))cells.push(cell);
 };
 add(0);for(let i=1;i<cuts.length;i++)if(cuts[i]>cuts[i-1])add((cuts[i]+cuts[i-1])/2);add(1);return cells;
}
