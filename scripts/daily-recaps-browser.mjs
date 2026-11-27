import assert from 'node:assert/strict';

export async function verifyDailyRecaps({send,evaluate}) {
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,mobile:true,deviceScaleFactor:1});
  for(const locale of ['fr','en','es']){
    const result=await evaluate(`(async()=>{
      const {setupDailyRecaps}=await import('/src/ui/daily-recaps.js');
      const {createTranslator}=await import('/src/ui/i18n.js');
      let reads=0,safe=false,owner='recap-owner';
      const part={participants:3,top:[{rank:1,nickname:'<Ana>',points:70,score:420,mine:false},{rank:2,nickname:'Moi',points:56,score:480,mine:true}],me:{rank:2,points:56,played:7,score:480,best_score:60}};
      const client={},opened=[];
      const recap=setupDailyRecaps({document,context:()=>({owner,client,day:'2026-12-07',safe}),
        read:async()=>{reads++;return {kind:'week',day:'2026-11-23',board:{final:true,general:part,friends:part}}},
        t:createTranslator({locale:${JSON.stringify(locale)}}).t,locale:()=>${JSON.stringify(locale)},
        formatDuration:s=>s+' s',openBoard:r=>opened.push(r.day)});
      await recap.wake();const before=reads;safe=true;await recap.wake();await recap.wake();
      const dialog=document.querySelector('.daily-recap');
      const escaped=dialog.querySelector('.lumen-podium .ranking-step-1 .ranking-name').textContent==='<Ana>';
      const points=dialog.textContent.includes('56');
      const focus=dialog.contains(document.activeElement);
      const bounds=dialog.querySelector('.daily-celebration-card').getBoundingClientRect();
      dialog.querySelector('[data-scope="friends"]').click();
      const selected=dialog.querySelector('[data-scope="friends"]').getAttribute('aria-selected');
      dialog.querySelector('[data-action="board"]').click();
      await recap.wake();const closed=!document.querySelector('.daily-recap');
      return {before,reads,escaped,points,focus,selected,closed,opened,fits:bounds.width<=innerWidth&&bounds.height<=innerHeight};
    })()`,true);
    assert.deepEqual(result,{before:0,reads:1,escaped:true,points:true,focus:true,selected:'true',closed:true,opened:['2026-11-23'],fits:true});
  }
  return {locales:['fr','en','es'],idleOnly:true,once:true,focus:true,weeklyPoints:true};
}
