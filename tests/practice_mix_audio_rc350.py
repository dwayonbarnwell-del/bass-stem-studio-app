"""Verify separated-channel layout, source reconstruction and continuous joins."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json,subprocess,sys
import numpy as np
from scipy.signal import resample_poly

def data(path,name):
 text=Path(path).read_text();return json.loads(text.split('window.'+name+'=')[1].split(';')[0])
assets=data('ear-source/practice-mix-data-rc350.js','BassPracticeMixAssets')
methods=data('ear-source/world-methods-rc350.js','BassWorldMethodMixes')
if '--require-methods' in sys.argv:assert methods,'No lesson mixes prepared'
def decode(path,channels,rate):
 return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',path,'-ac',str(channels),'-ar',str(rate),'-f','f32le','-']),'<f4').reshape(-1,channels)
def check(row):
 source,asset,method=row;pcm=decode(asset['url'],6,32000)
 assert len(pcm)==asset['frames'] and np.isfinite(pcm).all(),source
 assert np.abs(pcm).max()<=.951,(source,'Clipped channel')
 assert np.max(np.abs(pcm[0]-pcm[-1]))<.0001,(source,'Discontinuous join')
 mixed=pcm[:,:2]+pcm[:,2:4]+pcm[:,4:6]
 reference=resample_poly(decode(source,2,44100),320,441,axis=0)*asset['scale']
 count=min(len(mixed),len(reference))-32
 assert abs(len(mixed)-len(reference))<64,source
 error=float(np.sqrt(np.mean((mixed[:count]-reference[:count])**2)))
 if method:
  # The public original is Opus; the stems retain the pre-encoding lesson audio.
  assert error/max(.001,float(np.sqrt(np.mean(reference[:count]**2))))<.16,(source,error)
 else:assert error<.00015,(source,error)
 assert asset['estimated'] is True
 return error
rows=[(key,value,False) for key,value in assets.items()]+[(key,value,True) for key,value in methods.items()]
with ThreadPoolExecutor(max_workers=2) as pool:errors=list(pool.map(check,rows))
print(json.dumps({'recordingMixes':len(assets),'lessonMixes':len(methods),'allSixChannelsValid':True,'sourceReconstructionChecked':True,'loopJoinsChecked':True,'largestReconstructionRmsError':round(max(errors),6)}))
