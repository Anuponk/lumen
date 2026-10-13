import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {reconcileCompatibleCloudProfiles} from "../src/persistence/cloud-profile.js";

const base={solved:{0:1},badges:{},shards:4,xp:10,skyScore:2,daily:{dates:["2026-10-12"]},challenges:{a:1}};
const storage={getItem:()=>JSON.stringify({...base,daily:{dates:["2026-10-13"]},challenges:{b:1}}),setItem:()=>{throw Error("Unexpected backup write")}};
const supabase={rpc:async()=>{throw Error("Unexpected cloud write")}};
const result=await reconcileCompatibleCloudProfiles(supabase,storage,base);
assert.deepEqual(result,{status:"blocked",reason:"mutable_ledger",fields:["daily","challenges"]});
const game=readFileSync(new URL("../src/ui/game-screen.js",import.meta.url),"utf8");
assert.match(game,/fields:Array\.isArray\(resolution\.fields\)\?resolution\.fields:\[\]/);
console.log("Cloud diagnostics report conflicting ledger names without writing");
