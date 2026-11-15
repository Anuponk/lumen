// #711: loaded synchronously right after #accountSwitchHold so that, after a reload during
// an account switch, the hold is visible from the first paint (no flash of the previous
// account). Kept external because the shell forbids inline logic.
try{if(sessionStorage.getItem('lumenAccountSwitchHoldV1')==='1')document.getElementById('accountSwitchHold').hidden=false}catch(e){}
