import {PitchEngine} from './pitch-engine-rc361.mjs';
class EarPitchProcessor extends AudioWorkletProcessor{
 static get parameterDescriptors(){return [{name:'semitones',defaultValue:0,minValue:-12,maxValue:12,automationRate:'k-rate'}];}
 constructor(options){super();this.port.onmessage=({data})=>{if(data==='stop')this.engine=null;};this.engine=new PitchEngine(sampleRate,options.parameterData?.semitones||0);}
 process(inputs,outputs,parameters){if(!this.engine)return false;this.engine.process(inputs[0]||[],outputs[0],parameters.semitones[0]);return true;}
}
registerProcessor('bass-ear-pitch-rc361',EarPitchProcessor);
