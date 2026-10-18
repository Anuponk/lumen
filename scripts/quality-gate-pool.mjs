// Each task owns its browser profile, CDP port and report. Drain all tasks on
// failure so another task cannot be killed by shared server cleanup.
export async function runPool(tasks, workers=1) {
 if(!Number.isInteger(workers)||workers<1||workers>2)throw Error('Browser workers must be 1 or 2');
 let next=0;
 const errors=[];
 await Promise.all(Array.from({length:workers},async()=>{
  while(next<tasks.length) {
   const task=tasks[next++];
   try{await task()}catch(error){errors.push(error)}
  }
 }));
 if(errors.length)throw new AggregateError(errors,errors.map(error=>error.message).join('\n'));
}
