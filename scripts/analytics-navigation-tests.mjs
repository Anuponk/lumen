import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAnalyticsNavigation,ANALYTICS_SECTIONS} from '../src/ui/analytics-navigation.js';

function fixture(href='https://lumen.example/admin/analytics?section=players&days=30'){
 const handlers={};let url=new URL(href),canRead=false,loads=0,periodRefreshes=0;
 const node=()=>({hidden:false,dataset:{},style:{},isConnected:true,focus(){document.activeElement=this},setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]}});
 const buttons=ANALYTICS_SECTIONS.map(section=>Object.assign(node(),{dataset:{analyticsSection:section}}));
 const panels=ANALYTICS_SECTIONS.map(section=>Object.assign(node(),{dataset:{analyticsPanel:section}}));
 const close=node(),access=node(),days=Object.assign(node(),{value:'7',options:[{value:'7'},{value:'30'}],addEventListener(type,fn){handlers['days:'+type]=fn}});
 const nav={querySelectorAll:()=>buttons,addEventListener(type,fn){handlers['nav:'+type]=fn},contains:button=>buttons.includes(button)};
 const modal=Object.assign(node(),{querySelector:s=>s==='[data-analytics-navigation]'?nav:close,querySelectorAll:()=>panels,addEventListener(type,fn){handlers['modal:'+type]=fn}});
 const document={body:{style:{overflow:'auto'}},activeElement:node(),getElementById:id=>id==='adminCockpitDays'?days:access};
 const window={location:{get href(){return url.href}},history:{pushState(_s,_t,path){url=new URL(path,url)},replaceState(_s,_t,path){url=new URL(path,url)}},addEventListener(type,fn){handlers[type]=fn}};
 const controller=createAnalyticsNavigation({window,document,modal,allowed:()=>canRead,onOpen:()=>loads++,onPeriodChange:()=>periodRefreshes++});
 const click=section=>{const b=buttons.find(b=>b.dataset.analyticsSection===section);handlers['nav:click']({target:{closest:()=>b}})};
 return {controller,modal,access,document,days,panels,buttons,click,handlers,get url(){return url},get loads(){return loads},get periodRefreshes(){return periodRefreshes},allow:value=>{canRead=value},go:path=>{url=new URL(path,url);handlers.popstate()}};
}

test('direct Analytics link waits for administrative access before loading any data',()=>{
 const f=fixture();f.controller.syncAccess();assert.equal(f.loads,0);assert.equal(f.access.hidden,false);
 f.allow(true);f.controller.syncAccess();assert.equal(f.loads,1);assert.equal(f.days.value,'30');
 assert.equal(f.controller.section(),'players');assert.equal(f.modal.hidden,false);assert.equal(f.access.hidden,true);
 assert.deepEqual(f.panels.filter(p=>!p.hidden).map(p=>p.dataset.analyticsPanel),['players']);
 f.controller.syncAccess();assert.equal(f.loads,1,'routine auth updates do not trigger another load');
});

test('section navigation retains DOM content, period and browser history without reloading data',()=>{
 const f=fixture();f.allow(true);f.controller.syncAccess();const players=f.panels[1];players.search='retained';
 f.click('sync');assert.equal(f.url.pathname,'/admin/analytics');assert.equal(f.url.searchParams.get('section'),'sync');
 f.click('players');assert.equal(players.search,'retained');assert.equal(f.loads,1);
 f.days.value='7';f.handlers['days:change']();assert.equal(f.url.searchParams.get('days'),'7');
 f.go('/admin/analytics?section=support');assert.equal(f.controller.section(),'support');
 f.go('/admin/analytics?section=support&days=30');assert.equal(f.days.value,'30');assert.equal(f.periodRefreshes,1);
 f.go('/');assert.equal(f.modal.hidden,true);assert.equal(f.document.body.style.overflow,'auto');
});

test('loss of capability closes the view and a detached navigation action cannot load data',()=>{
 const f=fixture();f.allow(true);f.controller.syncAccess();f.allow(false);f.controller.syncAccess();
 assert.equal(f.modal.hidden,true);assert.equal(f.access.hidden,false);assert.equal(f.controller.open(),false);
 f.click('support');assert.equal(f.controller.section(),'players');assert.equal(f.loads,1);
});

test('Escape returns to the original game URL, invalid deep sections fall back safely',()=>{
 const f=fixture('https://lumen.example/?qa=new');f.allow(true);f.controller.open();
 let prevented=false;f.handlers['modal:keydown']({key:'Escape',preventDefault(){prevented=true}});
 assert.equal(prevented,true);assert.equal(f.url.pathname,'/');assert.equal(f.url.search,'?qa=new');
 f.go('/admin/analytics?section=not-a-section');assert.equal(f.controller.section(),'overview');
});

test('all existing cockpit data hosts occur exactly once in the shared shell',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for(const id of ['adminCockpit','adminPlayers','adminTimeline','adminAccounts','adminCockpitKpis','adminDailyChart','adminRetention','adminFunnel','adminFriction','adminAlerts','adminFeedbacks','adminDiagnosticIncidents','adminCatalogueTree']){
  assert.equal(html.split('id="'+id+'"').length-1,1,id);
 }
 for(const name of ANALYTICS_SECTIONS)assert(html.includes('data-analytics-panel="'+name+'"'));
 assert(html.includes('<base href="/">'),'nested route resolves the existing modules from root');
});
