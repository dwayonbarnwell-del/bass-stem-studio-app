"""Local bass-model inference with OpenCV's built-in CPU DNN backend.

This module does not import ONNX Runtime or any telemetry client. The verified
model is read from a local file. No provider registration or model download is
performed by the processor. MDX spectrum layout follows bass_stem_rc348.py.
"""
from pathlib import Path
import hashlib,subprocess
import cv2,librosa,numpy as np
from scipy.signal import resample_poly

class BassSeparator:
 def __init__(self,model,threads=3):
  path=Path(model)
  if hashlib.sha256(path.read_bytes()).hexdigest()!='0c3e77b9963185b1ea6bb46a4b8924137d9370fc1ccdefec7b1b416ef550dcaa':raise ValueError('Unexpected bass model')
  cv2.setNumThreads(threads)
  self.net=cv2.dnn.readNetFromONNX(str(path))
  self.net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
  self.net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
  self.fft=16384;self.hop=1024;self.dim_f=2048;self.dim_t=512;self.chunk=self.hop*(self.dim_t-1);self.trim=self.fft//2;self.gen=self.chunk-2*self.trim
 def separate(self,audio):
  if audio.ndim!=2 or audio.shape[0]!=2:raise ValueError('Expected stereo 44.1 kHz audio')
  length=audio.shape[1];padded=np.pad(audio,((0,0),(self.trim,self.gen+self.trim-length%self.gen)));chunks=[]
  for start in range(0,length,self.gen):
   wave=padded[:,start:start+self.chunk].astype('float32')
   spectrum=librosa.stft(wave,n_fft=self.fft,hop_length=self.hop,window='hann',center=True,pad_mode='reflect')
   data=np.stack([spectrum.real,spectrum.imag],axis=1).reshape(1,4,self.fft//2+1,self.dim_t)[:,:,:self.dim_f,:].copy().astype('float32');data[:,:,:3,:]=0
   self.net.setInput(data,'input');prediction=self.net.forward()
   values=prediction.reshape(2,2,self.dim_f,self.dim_t);result=values[:,0]+1j*values[:,1]
   result=np.pad(result,((0,0),(0,self.fft//2+1-self.dim_f),(0,0)))
   out=librosa.istft(result,n_fft=self.fft,hop_length=self.hop,window='hann',center=True,length=self.chunk)
   chunks.append(out[:,self.trim:-self.trim])
  return np.concatenate(chunks,axis=1)[:,:length]*1.035
 def file(self,file,start=0,seconds=None):
  command=['ffmpeg','-v','error','-ss',str(start),'-i',str(file)]
  if seconds is not None:command+=['-t',str(seconds)]
  audio=np.frombuffer(subprocess.check_output(command+['-ar','44100','-ac','2','-f','f32le','-']),'<f4').reshape(-1,2).T.copy()
  return self.separate(audio)
 def mono8k(self,file,start=0,seconds=None):return resample_poly(self.file(file,start,seconds).mean(axis=0),80,441).astype('float32')
