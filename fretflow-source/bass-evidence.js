/* Screen local bass-stem estimates for keyboard-like tone before showing notes.
   Harmonic and detuning weights fitted on licensed NSynth and sampled instrument tones.
   Benchmark sources and limitations are recorded in BASS_KEYBOARD_BENCHMARK_RC315.md. */
window.BassNoteEvidence=(()=>{
  'use strict';
  const sampleRate=8000, fftLength=8192;
  const harmonicWeights=[1.659960, 1.159371, 0.756902, 1.164829, 0.747770, -0.010480, -1.682895, 0.463790, -0.673840, 0.592077, 0.916001, -0.788090];
  const detuningWeights=[0.030809, 0.011423, -0.015963, -0.013471, 0.004067, -0.012527, -0.000327, -0.001338, -0.004494, -0.016826, -0.006239];
  const bias=1.431527;
  const threshold=0;

  function supportsBass(source,note){
    const start=note.start+.015,end=Math.min(note.start+.205,note.end+.025,source.duration);
    const count=Math.floor((end-start)*sampleRate);
    if(count<300)return false;
    const left=source.getChannelData(0);
    const right=source.numberOfChannels>1?source.getChannelData(1):left;
    const step=source.sampleRate/sampleRate;
    const real=new Float64Array(fftLength),imag=new Float64Array(fftLength);
    for(let i=0;i<count;i++){
      const first=Math.floor(start*source.sampleRate+i*step);
      const stop=Math.max(first+1,Math.floor(start*source.sampleRate+(i+1)*step));
      let sum=0;
      for(let j=first;j<stop;j++)sum+=(left[j]||0)+(right[j]||0);
      const taper=.5-.5*Math.cos(2*Math.PI*i/(count-1));
      real[i]=sum*taper/(2*(stop-first));
    }
    window.BassStemTransforms.fftInPlace(real,imag);

    const pitch=440*2**((note.midi-69)/12),levels=[],frequencies=[];
    const amplitude=k=>Math.hypot(real[k],imag[k]);
    for(let h=1;h<=harmonicWeights.length;h++){
      const expected=pitch*h*fftLength/sampleRate;
      const low=Math.round(expected*.97),high=Math.round(expected*(h===1?1.03:1.08));
      let peak=low;
      for(let k=low+1;k<=high;k++)if(amplitude(k)>amplitude(peak))peak=k;
      const level=amplitude(peak);
      const l=Math.log(Math.max(1e-12,amplitude(peak-1)));
      const c=Math.log(Math.max(1e-12,level));
      const r=Math.log(Math.max(1e-12,amplitude(peak+1)));
      const bend=l-2*c+r;
      const offset=bend?Math.max(-.5,Math.min(.5,(l-r)/(2*bend))):0;
      levels.push(level);
      frequencies.push((peak+offset)*sampleRate/(fftLength*h));
    }
    const strongest=Math.max(...levels);
    if(strongest<=1e-8)return false;

    let score=bias;
    for(let i=0;i<levels.length;i++){
      const relative=levels[i]/strongest;
      score+=harmonicWeights[i]*Math.log10(Math.max(.005,relative));
      if(i<2||relative<=.04)continue;
      const cents=1200*Math.log2(frequencies[i]/frequencies[0]);
      if(Math.abs(cents)<90)score+=detuningWeights[i-2]*Math.max(-40,Math.min(45,cents));
    }
    return score>=threshold;
  }

  return {supportsBass};
})();
