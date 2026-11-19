/* Keep the musical intervals intact by moving the complete phrase in octaves. */
window.BassRegister=(()=>{
 'use strict';
 const low=23,high=59,preferredHigh=47;
 const name=n=>['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'][((n%12)+12)%12]+(Math.floor(n/12)-1);
 function fit(notes){
  if(!notes?.length)return {notes:[],shift:0,revoiced:false};
  const pitches=notes.map(n=>n.midi),min=Math.min(...pitches),max=Math.max(...pitches);
  let shifts=[];
  for(const ceiling of [preferredHigh,high]){for(let shift=-120;shift<=120;shift+=12)if(min+shift>=low&&max+shift<=ceiling)shifts.push(shift);if(shifts.length)break;}
  shifts.sort((a,b)=>Math.abs((min+max)/2+a-35)-Math.abs((min+max)/2+b-35)||Math.abs(a)-Math.abs(b));
  const shift=shifts[0];
  return {shift:shift??0,revoiced:shift===undefined,notes:notes.map(n=>{let midi=n.midi+(shift??0);while(midi<low)midi+=12;while(midi>high)midi-=12;return {...n,midi};})};
 }
 function plan(value){if(!value)return value;const f=fit(value.bass);return {...value,bass:f.notes,bassShift:f.shift,bassRevoiced:f.revoiced};}
 function question(q){
  if(q.sound!=='bass'||!q.events.length)return q;
  const all=[...q.events,...(q.reference||[]),...(q.keyboard||[]).map(midi=>({midi}))],f=fit(all);
  // Progression answers concern harmony. Move whole chord voicings separately
  // when the full progression cannot share one octave shift.
  if(f.revoiced&&q.mode==='progressions'){
   const times=[...new Set(q.events.map(n=>n.start))];
   q.events=times.flatMap(t=>fit(q.events.filter(n=>n.start===t)).notes);
   if(q.reference)q.reference=fit(q.reference).notes;
   if(q.reference?.length)q.tonic=q.reference[0].midi;
   return q;
  }
  // Never fold individual interval notes: the question's distance must stay exact.
  if(f.revoiced)throw Error('Bass exercise exceeds its supported range');
  const names=new Map(all.map(n=>[name(n.midi),name(n.midi+f.shift)]));
  for(const field of ['events','reference'])if(q[field])q[field]=q[field].map(n=>({...n,midi:n.midi+f.shift}));
  if(q.keyboard)q.keyboard=q.keyboard.map(n=>n+f.shift);
  if(Array.isArray(q.answer))q.answer=q.answer.map(n=>n+f.shift);
  if(Number.isFinite(q.tonic))q.tonic+=f.shift;
  for(const field of ['prompt','explanation'])q[field]=q[field].replace(/[A-G][♯♭]?-?\d+/g,n=>names.get(n)||n);
  return q;
 }
 return {low,high,preferredHigh,fit,plan,question};
})();
