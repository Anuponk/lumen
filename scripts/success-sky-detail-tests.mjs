import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const nav=readFileSync(new URL('../src/ui/sky-navigation.js',import.meta.url),'utf8');
assert.match(src,/skyNavigation\.open\(\{detail,questIndex:skyQuestIndex,constellationId\}\)/);
const start=src.indexOf('document.getElementById("successSky").onclick='),end=src.indexOf('function learningSkyDiscoveryRequired',start);
assert(start>0&&end>start);
for(const quest of [{id:'stable',ordinal:80,legacyIndex:null,constellationId:'c'},{id:'numeric',ordinal:91,legacyIndex:70,constellationId:'c'}]){
 const button={};let opened;
 const context={document:{getElementById:()=>button},activeQuest:()=>quest,CONTENT_CONSTELLATIONS:[{id:'c',questStart:20}],
  levelIndex:0,hideSuccess(){},learningSkyDiscoveryRequired:()=>false,localStorage:{getItem:()=>null},openJourneyMap:(focus,options)=>{opened={focus,options}}};
 vm.createContext(context);vm.runInContext(src.slice(start,end),context);button.onclick();
 assert(opened.focus&&opened.options.detail);assert.equal(opened.options.constellationId,'c');
 assert.equal(opened.options.questIndex,quest.legacyIndex??20,'Played identity must win over dormant numeric position');
}
assert.match(src,/openSky\.onclick=\(\)=>openJourneyMap\(true\);/,'Regular Mon ciel entry stays in overview');
assert.match(nav,/view=showDetail\?'detail':'overview'/);
assert.match(nav,/setView\(next\)\{view=next;tabs\.hidden=next==='detail'/);
console.log('Success screen opens the exact played constellation detail, not overview');
