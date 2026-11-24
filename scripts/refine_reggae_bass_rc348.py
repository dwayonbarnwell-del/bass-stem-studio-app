"""Refine on-screen note estimates using an offline bass-specific separator.

The original mixed audio files are never replaced. Cache/model stay outside git.
"""
from pathlib import Path
import argparse,json,threading
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from scipy.ndimage import median_filter
import librosa
from bass_stem_rc348 import BassSeparator
local=threading.local()

def transcribe(bass,seconds):
 f0,_,prob=librosa.pyin(bass,fmin=librosa.note_to_hz('B0'),fmax=librosa.note_to_hz('B3'),sr=8000,frame_length=2048,hop_length=160)
 midi=librosa.hz_to_midi(f0);rounded=np.where(np.isfinite(midi),np.rint(midi),-1).astype(int);rounded=median_filter(rounded,size=3,mode='nearest')
 attacks=set(librosa.onset.onset_detect(y=bass,sr=8000,hop_length=160,backtrack=True,units='frames',delta=.1).tolist())
 rows=[];current=None
 def finish(at):
  nonlocal current
  if current:
   current['end']=round(min(at,seconds),4);current['confidence']=round(current.pop('sum')/current.pop('count'),3);uncertain=current.pop('uncertain');current['review']=bool(current['confidence']<.8 or uncertain)
   if current['end']-current['start']>=.08:rows.append(current)
   current=None
 for i,value in enumerate(rounded):
  at=i*.02;note=int(value) if 23<=value<=59 and prob[i]>=.35 and at<seconds else None
  if current and (note!=current['midi'] or i in attacks and at-current['start']>=.12):finish(at)
  if note is not None:
   uncertain=not np.isfinite(midi[i]) or abs(midi[i]-note)>.3
   if current is None:current=dict(midi=note,start=round(at,4),end=round(min(seconds,at+.02),4),velocity=82,sum=float(prob[i]),count=1,uncertain=uncertain)
   else:current['sum']+=float(prob[i]);current['count']+=1;current['uncertain']|=uncertain
 finish(seconds);return rows

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--model',required=True);ap.add_argument('--cache',type=Path,required=True);args=ap.parse_args()
 paths=sorted(args.cache.glob('*-sections.json'));count=0
 def process(path):
  row,checks=json.loads(path.read_text())
  if row.get('noteAnalysis')=='bass-specific-mdx-v2':return False
  if not hasattr(local,'separator'):local.separator=BassSeparator(args.model,threads=6)
  for i,section in enumerate(row['sections']):
   cache=args.cache/(row['id']+'-'+section['label'].lower()+'-bass.npy')
   if cache.exists():bass=np.load(cache)
   else:bass=local.separator.mono8k(section['audio']);np.save(cache,bass)
   notes=transcribe(bass,section['duration'])
   if not notes:print('No clear bass estimate',row['id'],section['label'],flush=True)
   section['notes']=notes;section['noteCount']=len(notes);section['noteAnalysis']='bass-specific-mdx-v2';checks[i]['notes']=len(notes)
  row['notes']=row['sections'][0]['notes'];row['noteAnalysis']='bass-specific-mdx-v2'
  tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps([row,checks]));tmp.replace(path);return True
 with ThreadPoolExecutor(max_workers=1) as pool:
  for changed in pool.map(process,paths):
   count+=1;print('Bass checked',count,'of',len(paths),flush=True)
 print('Completed bass checks:',len(paths),flush=True)
if __name__=='__main__':main()
