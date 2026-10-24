// Original, local ambient score. No recording, request or player-data writer.
const CHORDS=[
 [0,5,[146.83,220,293.66]],
 [5,10,[130.81,196,261.63]],
 [10,16,[174.61,220,349.23]],
 [16,23,[130.81,196,329.63]],
 [23,30,[146.83,220,293.66,440]]
];
const MELODY=[[10.8,587.33],[13,659.25],[16.8,783.99],[19.2,659.25],[23.5,587.33],[26,880]];

export function createIntroMusic({window,onChange=()=>{}}){
 let enabled=false,context=null,nodes=[],master=null;
 function preference(){try{return window.localStorage.getItem('lumenSound')!=='off'}catch{return false}}
 enabled=preference();
 function pause(){
  const old=context;context=null;
  // Silence synchronously; close/resume promises may settle after navigation.
  if(master){try{master.gain.cancelScheduledValues(0);master.gain.value=0;master.disconnect()}catch{}master=null}
  for(const node of nodes){try{node.stop?.()}catch{}try{node.disconnect()}catch{}}
  nodes=[];
  try{old?.close()?.catch(()=>{})}catch{}
 }
 function start(elapsed=0){
  pause();if(!enabled||elapsed>=30000)return;
  let audio;
  try{
   const Audio=window.AudioContext||window.webkitAudioContext;
   audio=new Audio();context=audio;
   master=audio.createGain();master.gain.value=.3;master.connect(audio.destination);
   const offset=Math.max(0,elapsed/1000),base=audio.currentTime;
   function note(start,end,frequency,volume){
    if(end<=offset)return;
    const at=base+Math.max(0,start-offset),until=base+end-offset;
    if(until-at<.02)return;
    const oscillator=audio.createOscillator(),gain=audio.createGain();
    nodes.push(oscillator,gain);oscillator.type='sine';oscillator.frequency.value=frequency;
    gain.gain.setValueAtTime(.00001,at);
    gain.gain.exponentialRampToValueAtTime(volume,Math.min(at+.7,at+(until-at)/3));
    gain.gain.exponentialRampToValueAtTime(.00001,until);
    oscillator.connect(gain);gain.connect(master);oscillator.start(at);oscillator.stop(until+.02);
   }
   for(const [start,end,frequencies] of CHORDS)for(const frequency of frequencies)note(start,end,frequency,.035);
   for(const [start,frequency] of MELODY)note(start,Math.min(30,start+2.8),frequency,.025);
   const resumed=audio.resume();
   resumed?.catch(()=>{if(context===audio){pause();enabled=false;onChange()}});
  }catch{pause();enabled=false;onChange()}
 }
 return {
  get enabled(){return enabled},
  start,pause,stop:pause,
  resetPreference(){pause();enabled=preference();onChange()},
  setEnabled(value){enabled=!!value;if(!enabled)pause();onChange()}
 };
}
