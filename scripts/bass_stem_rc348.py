"""Offline bass-stem analysis for the owner's practice excerpts.

The browser still plays the original mix. This helper is used only to obtain
bass-note estimates, not to distribute a separation model. MDX transform layout:
https://github.com/nomadkaraoke/python-audio-separator (UVR MDX architecture).
Model: kuielab_a_bass.onnx from the public UVR model repository.
Verified UVR tail-MD5: 6703e39f36f18aa7855ee1047765621d.
"""
from pathlib import Path
import hashlib,subprocess,time
import numpy as np
import librosa,onnxruntime as ort
from scipy.signal import resample_poly

class BassSeparator:
 def __init__(self,model,threads=6):
  p=Path(model)
  with p.open('rb') as f:f.seek(max(0,p.stat().st_size-10240000));digest=hashlib.md5(f.read()).hexdigest()
  if digest!='6703e39f36f18aa7855ee1047765621d':raise ValueError('Unexpected separation model')
  options=ort.SessionOptions();options.intra_op_num_threads=threads;options.inter_op_num_threads=1
  options.enable_cpu_mem_arena=False
  self.session=ort.InferenceSession(str(p),sess_options=options,providers=['CPUExecutionProvider'])
  self.fft=16384;self.hop=1024;self.dim_f=2048;self.dim_t=512;self.chunk=self.hop*(self.dim_t-1);self.trim=self.fft//2;self.gen=self.chunk-2*self.trim
 def separate(self,audio):
  if audio.ndim!=2 or audio.shape[0]!=2:raise ValueError('Expected stereo 44.1 kHz audio')
  length=audio.shape[1];padded=np.pad(audio,((0,0),(self.trim,self.gen+self.trim-length%self.gen)))
  chunks=[]
  for start in range(0,length,self.gen):
   wave=padded[:,start:start+self.chunk].astype('float32')
   spectrum=librosa.stft(wave,n_fft=self.fft,hop_length=self.hop,window='hann',center=True,pad_mode='reflect')
   model_input=np.stack([spectrum.real,spectrum.imag],axis=1).reshape(1,4,self.fft//2+1,self.dim_t)[:,:,:self.dim_f,:].copy().astype('float32');model_input[:,:,:3,:]=0
   prediction=self.session.run(None,{'input':model_input})[0]
   data=prediction.reshape(2,2,self.dim_f,self.dim_t);complex_spec=data[:,0]+1j*data[:,1]
   complex_spec=np.pad(complex_spec,((0,0),(0,self.fft//2+1-self.dim_f),(0,0)))
   out=librosa.istft(complex_spec,n_fft=self.fft,hop_length=self.hop,window='hann',center=True,length=self.chunk)
   chunks.append(out[:,self.trim:-self.trim])
  return np.concatenate(chunks,axis=1)[:,:length]*1.035
 def file(self,file,start=0,seconds=None):
  cmd=['ffmpeg','-v','error','-ss',str(start),'-i',str(file)]
  if seconds is not None:cmd+=['-t',str(seconds)]
  cmd+=['-ar','44100','-ac','2','-f','f32le','-']
  audio=np.frombuffer(subprocess.check_output(cmd),'<f4').reshape(-1,2).T.copy()
  return self.separate(audio)
 def mono8k(self,file,start=0,seconds=None):return resample_poly(self.file(file,start,seconds).mean(axis=0),80,441).astype('float32')

if __name__=='__main__':
 import argparse,json
 ap=argparse.ArgumentParser();ap.add_argument('--model',required=True);ap.add_argument('--file',required=True);ap.add_argument('--output',required=True);args=ap.parse_args()
 start=time.monotonic();separator=BassSeparator(args.model);bass=separator.mono8k(args.file);np.save(args.output,bass)
 f0,voiced,prob=librosa.pyin(bass,sr=8000,fmin=librosa.note_to_hz('B0'),fmax=librosa.note_to_hz('B3'),frame_length=2048,hop_length=160)
 pitches=np.rint(librosa.hz_to_midi(f0[np.isfinite(f0)]));values,counts=np.unique(pitches,return_counts=True)
 print(json.dumps(dict(seconds=round(time.monotonic()-start,2),voiced=int(sum(voiced)),highConfidence=int(sum(prob>.72)),pitches=list(zip(values.astype(int).tolist(),counts.tolist())))),flush=True)
