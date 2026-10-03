import vm from 'node:vm';
// Parse a complete existing declaration with the JS parser, including templates.
export function functionSource(source,name){
 const match=new RegExp('(?:async )?function '+name+'\\(').exec(source);
 if(!match)throw Error('Missing function: '+name);
 for(let end=source.indexOf('}',match.index)+1;end>0;end=source.indexOf('}',end)+1){
  const body=source.slice(match.index,end);
  try{new vm.Script('('+body+')')}catch{continue}
  return body;
 }
 throw Error('Incomplete function: '+name);
}
