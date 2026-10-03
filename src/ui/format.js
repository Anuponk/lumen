export function localDateKey(d=new Date()){let y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return y+"-"+m+"-"+day}

export function dateOffsetKey(n){let d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+n);return localDateKey(d)}

export function formatDuration(seconds){seconds=Math.max(0,Math.round(seconds||0));return Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0")}
