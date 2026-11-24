"""Prepare independently adjustable recorded bass, drums and other instruments.

Uses the bass-specific model already used to review recorded notes, then separates
the remaining percussive and harmonic material. The model remains outside git.
All stems share the original timeline; residual correction preserves the source
when all three controls are at 100%. Separation is an automatic estimate.
"""
from pathlib import Path
import argparse,hashlib,json,subprocess,time,threading
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import librosa
from bass_stem_rc348 import BassSeparator
from scipy.signal import resample_poly

def decode(path,rate=44100,start=0,seconds=None):
 command=['ffmpeg','-v','error','-ss',str(start),'-i',str(path)]
 if seconds is not None:command+=['-t',str(seconds)]
 return np.frombuffer(subprocess.check_output(command+['-ac','2','-ar',str(rate),'-f','f32le','-']),'<f4').reshape(-1,2).T.copy()

class Separator:
 def __init__(self,model,threads=3):self.bass=BassSeparator(model,threads=threads)
 def separate(self,audio):
  bass=self.bass.separate(audio);rest=audio-bass
  # Percussive masks are estimated on the accompaniment after bass extraction.
  # Their complement goes to Other, so changing the bass level never changes
  # the backing's timing or silently adds a second copy of the bass.
  spec=librosa.stft(rest,n_fft=2048,hop_length=512)
  _,percussive=librosa.decompose.hpss(spec,margin=(2,2))
  drums=librosa.istft(percussive,n_fft=2048,hop_length=512,length=audio.shape[1])
  other=audio-bass-drums
  return np.stack([drums,bass,other,np.zeros_like(other)])

def encode_mix(source,parts,path):
 bass,drums=parts[1],parts[0]
 other=source-bass-drums
 channels=np.concatenate([bass,drums,other],axis=0)
 peak=float(np.max(np.abs(channels)));scale=min(1,.94/max(.0001,peak));channels*=scale
 pcm=resample_poly(channels,320,441,axis=1).T.astype('<f4')
 pcm[-16:]+=np.linspace(0,1,16)[:,None]*(pcm[0]-pcm[-1])
 peak=float(np.max(np.abs(pcm)))
 if peak>.94:
  correction=.94/peak;pcm*=correction;scale*=correction
 subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar','32000','-ac','6','-i','pipe:0','-c:a','flac','-sample_fmt','s16',str(path)],input=pcm.tobytes(),check=True)
 return dict(url='./'+str(path),frames=len(pcm),sampleRate=32000,channels=6,scale=scale,estimated=True,method='bass-model-percussive-mask',
  bassRms=round(float(np.sqrt(np.mean(bass**2))),6),drumsRms=round(float(np.sqrt(np.mean(drums**2))),6),otherRms=round(float(np.sqrt(np.mean(other**2))),6))

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--model',required=True);parser.add_argument('--sources',type=Path,required=True);parser.add_argument('--cache',type=Path,required=True);args=parser.parse_args()
 folder=Path('ear-assets/practice-mix-rc350');folder.mkdir(exist_ok=True);args.cache.mkdir(exist_ok=True)
 paths=json.loads(args.sources.read_text());local=threading.local();assets={};start=time.monotonic()
 def process(source):
  digest=hashlib.sha256(Path(source).read_bytes()).hexdigest()[:16];checkpoint=args.cache/(digest+'.json');target=folder/(digest+'.flac')
  if checkpoint.exists() and target.exists():entry=json.loads(checkpoint.read_text())
  else:
   if not hasattr(local,'model'):local.model=Separator(args.model)
   audio=decode(source);parts=local.model.separate(audio);entry=encode_mix(audio,parts,target);checkpoint.write_text(json.dumps(entry))
  return source,entry
 with ThreadPoolExecutor(max_workers=1) as pool:
  for index,(source,entry) in enumerate(pool.map(process,paths)):
   assets[source]=entry
   if (index+1)%10==0:print(json.dumps(dict(prepared=index+1,total=len(paths),seconds=round(time.monotonic()-start))),flush=True)
 Path('ear-source/practice-mix-data-rc350.js').write_text('/* Estimated recorded stems: bass L/R, drums L/R, other L/R. */\nwindow.BassPracticeMixAssets='+json.dumps(assets,separators=(',',':'))+';\n')
 print(json.dumps(dict(prepared=len(assets),seconds=round(time.monotonic()-start))),flush=True)

if __name__=='__main__':main()
