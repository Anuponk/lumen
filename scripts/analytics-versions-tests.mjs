import assert from 'node:assert/strict';
import {buildVersionModel,versionRate,renderVersionHealth,MIN_VERSION_SAMPLE} from '../src/ui/analytics-versions.js';
import {createTranslator} from '../src/ui/i18n.js';

// #708 Lot D: a release is compared with its exposure; small samples are never ranked.
const {t}=createTranslator({locale:'fr'});
assert.equal(versionRate(3,4),75);
assert.equal(versionRate(1,0),null,'no exposure, no rate');
assert.equal(versionRate(null,10),null,'missing failures are not 0');
assert.deepEqual(buildVersionModel(null),{available:false});
const data={days:7,totals:{hydrations:200,failures:10},versions:[
 {version:'1.11.1+719',hydrations:40,failures:8,blocked:1,players:5,devices:6,waiting_devices:1,last_seen:'2026-11-21T10:00:00Z'},
 {version:'1.11.1+718',hydrations:150,failures:2,players:20,devices:22,waiting_devices:0},
 {version:'1.11.1+700',hydrations:10,failures:5,players:1},
 {version:'unknown',hydrations:0,failures:0}]};
const m=buildVersionModel(data);
assert.equal(m.overall,5);
assert.deepEqual(m.rows.map(r=>[r.version,r.rate,r.small,r.examine]),[
 ['1.11.1+719',20,false,true],['1.11.1+718',1.3,false,false],['1.11.1+700',50,true,false],['unknown',null,true,false]],
 'only a sufficient sample with a clear gap is flagged; 50 % on 10 hydrations stays a small sample');
assert.equal(MIN_VERSION_SAMPLE,20);
const host={innerHTML:''};
renderVersionHealth(host,data,{t});
assert.match(host.innerHTML,/Comparaison des versions.*Taux d’échec global : 5 % sur 200 hydratations/s);
assert.match(host.innerHTML,/analytics-row-alert.*1\.11\.1\+719.*20 %.*à examiner/s);
assert.match(host.innerHTML,/1\.11\.1\+700.*50 %.*échantillon faible/s);
assert.match(host.innerHTML,/version inconnue.*non calculable/s);
assert.match(host.innerHTML,/une attente n’est pas une perte de progression/);
renderVersionHealth(host,null,{t});
assert.match(host.innerHTML,/indisponible.*ce n’est pas zéro/s);
renderVersionHealth(host,{days:7,totals:{hydrations:0,failures:0},versions:[]},{t});
assert.match(host.innerHTML,/taux global non calculable.*Aucune version observée/s);
renderVersionHealth(host,{...data,versions:[{version:'<b>x',hydrations:30,failures:1}]},{t});
assert(!host.innerHTML.includes('<b>x'),'escaped');
console.log('analytics versions tests passed');
