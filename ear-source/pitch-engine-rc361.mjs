import {SoundTouch} from './vendor/soundtouch/core/index.js';
/* Fixed-clock wrapper: buffering changes pitch, never the source playhead. */
export class PitchEngine{
 constructor(rate,semitones=0){
  this.rate=rate;this.latency=.18;this.delay=Math.round(rate*this.latency);this.fed=0;this.underruns=0;
  this.pipe=new SoundTouch({sampleRate:rate});
  this.pipe.setStretchParameters({sequenceMs:80,seekWindowMs:35,overlapMs:12,quickSeek:false});
  this.semitones=semitones;this.pipe.pitchSemitones=semitones;
  this.input=new Float32Array(2048*2);this.output=new Float32Array(2048*2);
  this.dry=[new Float32Array(this.delay+1),new Float32Array(this.delay+1)];this.dryIndex=0;this.wet=semitones?1:0;
 }
 process(input,output,semitones=0){
  const count=output[0].length;
  if(this.semitones!==semitones){this.semitones=semitones;this.pipe.pitchSemitones=Math.max(-12,Math.min(12,semitones));}
  if(this.input.length<count*2){this.input=new Float32Array(count*2);this.output=new Float32Array(count*2);}
  for(let i=0;i<count;i++){this.input[i*2]=input[0]?.[i]||0;this.input[i*2+1]=input[1]?.[i]??input[0]?.[i]??0;}
  this.pipe.inputBuffer.putSamples(this.input,0,count);this.pipe.process();
  const padding=Math.max(0,Math.min(count,this.delay-this.fed));this.fed+=count;
  const wanted=count-padding,available=Math.min(wanted,this.pipe.outputBuffer.frameCount);
  this.pipe.outputBuffer.extract(this.output,0,available);this.pipe.outputBuffer.receive(available);
  for(const channel of output)channel.fill(0);
  for(let c=0;c<output.length;c++)for(let i=0;i<available;i++)output[c][padding+i]=this.output[i*2+Math.min(c,1)];
  const smooth=1-Math.exp(-1/(this.rate*.012));
  for(let i=0;i<count;i++){
   const at=this.dryIndex++%(this.delay+1),next=(at+1)%(this.delay+1);this.wet+=((semitones?1:0)-this.wet)*smooth;
   for(let c=0;c<2;c++)this.dry[c][at]=input[Math.min(c,input.length-1)]?.[i]||0;
   for(let c=0;c<output.length;c++)output[c][i]=output[c][i]*this.wet+this.dry[Math.min(c,1)][next]*(1-this.wet);
  }
  if(available<wanted)this.underruns++;
 }
}
