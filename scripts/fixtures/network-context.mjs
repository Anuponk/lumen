// Dependencies added to the extracted game-screen code by #847/#851. Harnesses
// that run real excerpts in a vm context receive them without overriding any
// value the harness already defines (its own clock, navigator or engine).
import {attemptOperationId} from '../../src/game/attempt-engine.js';
import {isNetworkFailure} from '../../src/persistence/cloud-profile.js';
export function networkContext(){
 return {attemptOperationId,isNetworkFailure,networkUnavailable:false,setNetworkUnavailable(){},enterNetworkUnavailable:()=>false,
  rememberVerifiedOfflineOwner(){},networkWatchdog:async()=>{},navigator:{onLine:true},setTimeout,clearTimeout,
  // #828: completed-grid guard and deferred-victory check.
  guardiansCompleteAndValid:()=>false,authSessionPending:false,celebrated:false,pendingVictoryView:null,socialChallenge:null};
}
export function withNetworkContext(ctx){
 for(const [key,value] of Object.entries(networkContext()))if(!(key in ctx))ctx[key]=value;
 return ctx;
}
