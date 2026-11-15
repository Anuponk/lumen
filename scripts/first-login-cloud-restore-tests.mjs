import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ui=readFileSync(new URL("../src/ui/game-screen.js",import.meta.url),"utf8");
assert.match(ui,/const switchingOwner=currentOwner!==accountId/);
assert.match(ui,/if\(currentLocal&&existing&&!switchingOwner\)/,"only same-account snapshots are reconciled");
// #711: the pre-switch copy goes through the shared verified helper (identical
// copy reused, or IndexedDB copy read back when the localStorage quota is full).
assert.match(ui,/await preserveRecoverySnapshot\(localStorage,"lumenBeforeAccountSwitch_",currentLocal\);/,"guest snapshot backup checked before removal");
const cloudProfile=readFileSync(new URL("../src/persistence/cloud-profile.js",import.meta.url),"utf8");
assert.match(cloudProfile,/if\(storage\.getItem\(key\)!==value\)throw/,"local recovery copy is read back");
assert.match(cloudProfile,/if\(saved!==value\)throw/,"IndexedDB recovery copy is read back");
assert.match(ui,/if\(currentLocal!==null\)localStorage.removeItem\("lumenProgressV1"\)/);
assert.match(ui,/changed=installCloudProfileLocally\(localStorage,cloud\)/);
assert.match(ui,/localStorage.setItem\(ownerKey,accountId\)/);
assert.match(ui,/if\(currentLocal!==null&&localStorage.getItem\("lumenProgressV1"\)===null\)/,"rollback when install fails");
console.log("New-owner hydration distinguishes unowned guest cache from signed-in local progress");
