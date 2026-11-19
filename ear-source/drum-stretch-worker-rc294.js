import {stretchLoop} from './drum-stretch-rc294.mjs';
self.onmessage=({data})=>{
 try{const channels=stretchLoop(data.channels,data.sampleRate,data.frames,data.beats);self.postMessage({channels},channels.map(x=>x.buffer));}
 catch(error){self.postMessage({error:String(error.message||error)});}
};
