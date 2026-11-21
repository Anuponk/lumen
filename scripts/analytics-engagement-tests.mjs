import assert from 'node:assert/strict';
import {buildEngagementModel,engagementRate,renderAnalyticsEngagement} from '../src/ui/analytics-engagement.js';
import {createTranslator} from '../src/ui/i18n.js';

// #708 Lot C: a missing source is unavailable (never 0), acquisition without
// public collection is « Non mesurable », retention by channel is never invented.
const {t}=createTranslator({locale:'fr'}),en=createTranslator({locale:'en'}).t;
assert.equal(engagementRate(1,4),25);
assert.equal(engagementRate(0,0),null,'no denominator, no rate');
assert.equal(engagementRate(null,4),null);
assert.deepEqual(buildEngagementModel(null),{available:false});
const data={days:7,traffic:{identifiers:10,human:2,qa:3,automated_test:4,undetermined:1},
 acquisition:[{channel:'player_share',opened:4,q1_started:2,q1_completed:1},{channel:'tiktok',opened:0,q1_started:0,q1_completed:0}],
 challenges:{created:13,senders:4,sent_to_friends:5,accepted:5,completed:5,abandoned:0,in_progress:0,guest_participations:0},
 daily:{flag_enabled:false,players:2,days:1,runs:2,completed:1,abandoned:0,in_progress:1},
 retention_by_channel:{measurable:false}};
const m=buildEngagementModel(data);
assert.equal(m.channels[0].activation,25);
assert.equal(m.channels[1].activation,null,'0 openings → not computable, not 0 %');
assert.equal(m.challenges.completionRate,100);
assert.equal(m.daily.completionRate,50);
assert.equal(m.retentionByChannel,false);
const host={innerHTML:''};
renderAnalyticsEngagement(host,data,{collectionEnabled:false,t});
assert.match(host.innerHTML,/Trafic observé par type.*Joueurs humains.*QA.*Tests automatisés.*Non déterminés/s);
assert.match(host.innerHTML,/Collecte publique désactivée/);
assert.match(host.innerHTML,/Non mesurable\..*échantillon partiel/s,'acquisition labelled as a partial sample');
assert.match(host.innerHTML,/player_share.*25 %.*\(n=4\)/s,'rate with its sample size');
assert.match(host.innerHTML,/tiktok.*non calculable/s);
assert.match(host.innerHTML,/13<\/strong><span>Défis créés<\/span><small>4 expéditeurs/);
assert.match(host.innerHTML,/Masqué au public \(drapeau désactivé\)/);
assert.match(host.innerHTML,/Rétention J\+1 \/ J\+7 par canal.*Non mesurable/s);
for(const word of ['Définition','Source','Dénominateur','Période'])assert(host.innerHTML.includes(word),word+' documented');
renderAnalyticsEngagement(host,data,{collectionEnabled:true,t});
assert.doesNotMatch(host.innerHTML,/échantillon partiel/,'no partial warning once collection is enabled');
renderAnalyticsEngagement(host,null,{t});
assert.match(host.innerHTML,/indisponible.*ce n’est pas zéro/s,'unavailable source is not zero');
renderAnalyticsEngagement(host,{...data,acquisition:[],challenges:{}},{t});
assert.match(host.innerHTML,/Aucune ouverture attribuée/);
assert.match(host.innerHTML,/indisponible<\/strong><span>Défis créés/,'missing counter shown as unavailable, not 0');
renderAnalyticsEngagement(host,{...data,acquisition:[{channel:'<img src=x>',opened:1}]},{t});
assert(!host.innerHTML.includes('<img'),'escaped');
renderAnalyticsEngagement(host,data,{t:en});
assert.match(host.innerHTML,/Observed traffic by type.*Not measurable/s,'English copy');
console.log('analytics engagement tests passed');
