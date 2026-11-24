"""Review owner-supplied cultural recordings with local CPU inference only.

Nominate active passages across each medley, retain returning musical phrases,
omit repeated captures, and export synchronised estimated bass/drum/other stems.
The original archive and all inference checkpoints remain outside the app.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
import argparse,hashlib,json,re,subprocess,threading,time,warnings
import numpy as np,librosa
from scipy.signal import butter,sosfilt,resample_poly
from bass_stem_opencv_rc352 import BassSeparator
from prepare_practice_mix_rc350 import decode,encode_mix
from refine_reggae_bass_rc348 import transcribe
from prepare_world_methods_rc350 import phrase,audio_fingerprint,difference_from
warnings.filterwarnings('ignore',category=UserWarning)

def clean_name(name):
 text=re.sub(r'^Y2Mate\.is\s*-\s*','',Path(name).stem,flags=re.I)
 text=re.sub(r'\b(?:youtubevideo|youtube|bassguitar|bassist|gospelsongs|africanpraise|nigerianpraise|pastorjerryeze|streamsofjoyinternational|streamsofjoytv)\b','',text,flags=re.I)
 text=re.sub(r'[_|]+',' · ',text);text=re.sub(r'wor+o','Woro',text,flags=re.I);text=re.sub(r'aria\s+ria','Ariaria',text,flags=re.I)
 return re.sub(r'\s+',' ',text).strip(' .-·')[:130]

def proposals(row,count=4):
 wave=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',row['path'],'-ac','1','-ar','4000','-f','f32le','-']),'<f4')
 low=sosfilt(butter(3,[35,240],fs=4000,btype='bandpass',output='sos'),wave)
 hop=400;n=len(low)//hop;power=np.sqrt(np.mean(low[:n*hop].reshape(n,hop)**2,axis=1));reference=max(.0001,float(np.median(power)))
 candidates=[]
 for start in np.arange(12,max(13,row['duration']-34),4):
  values=power[round(start*10):round((start+32)*10)]
  if len(values)<300:continue
  active=float(np.mean(values>reference*.35));stable=float(np.mean(values<max(reference*4,float(np.median(values))*3)))
  score=active*stable*min(2,float(np.median(values))/reference)
  candidates.append(dict(start=float(start),end=float(start+32),score=score))
 selected=[]
 for i in range(count):
  lo=row['duration']*i/count;hi=row['duration']*(i+1)/count
  pool=[r for r in candidates if lo<=r['start']<hi and all(abs(r['start']-s['start'])>=32 for s in selected)]
  if pool:selected.append(max(pool,key=lambda r:r['score']))
 return selected

def similar(a,b):
 if a['genre']!=b['genre'] or abs(np.median([n['midi']for n in a['notes']])-np.median([n['midi']for n in b['notes']]))>1.1:return 0
 aa,bb=audio_fingerprint(a),audio_fingerprint(b);best=0
 for factor in [1,2]:
  for reverse in [False,True]:
   left,right=(bb,aa)if reverse else(aa,bb)
   if factor==2:right=np.concatenate([right[:,::2],right[:,::2]],axis=1)
   rolled=np.stack([np.roll(right,shift,axis=1)for shift in range(0,128,2)])
   scores=np.einsum('ij,kij->kj',left,rolled)
   best=max(best,float(np.max(.6*scores.mean(axis=1)+.4*np.quantile(scores,.1,axis=1))))
 if best>1.00001:raise ValueError('Invalid normalised phrase similarity')
 return best

def main():
 p=argparse.ArgumentParser();p.add_argument('--media',type=Path,required=True);p.add_argument('--model',required=True);p.add_argument('--cache',type=Path,required=True);p.add_argument('--workers',type=int,default=2);p.add_argument('--candidates',type=int,default=4);args=p.parse_args();args.cache.mkdir(exist_ok=True)
 sources=sorted(json.loads(args.media.read_text()),key=lambda r:(r['genre'],r['file']));jobs=[];source_numbers=Counter()
 for row in sources:
  if not row['genre']:continue
  source_numbers[row['genre']]+=1;row['number']=source_numbers[row['genre']];row['sourceId']=hashlib.sha256(Path(row['path']).read_bytes()).hexdigest()[:16];row['title']=clean_name(row['file'])
  checkpoint=args.cache/(row['sourceId']+'-proposals.json')
  if checkpoint.exists():regions=json.loads(checkpoint.read_text())
  else:regions=proposals(row,args.candidates);checkpoint.write_text(json.dumps(regions))
  jobs.extend(dict(row,**region)for region in regions)
 print(json.dumps(dict(sources=len(sources),candidatePassages=len(jobs))),flush=True);local=threading.local();started=time.monotonic()
 def process(row):
  token=hashlib.sha256((row['sourceId']+str(row['start'])).encode()).hexdigest()[:16];save=args.cache/(token+'.json');bass_file=args.cache/(token+'-bass.npy')
  if save.exists():return json.loads(save.read_text())
  try:
   audio=decode(row['path'],start=row['start'],seconds=row['end']-row['start'])
   if bass_file.exists():bass=np.load(bass_file)
   else:
    if not hasattr(local,'model'):local.model=BassSeparator(args.model,threads=2)
    bass=local.model.separate(audio);np.save(bass_file,bass)
   ratio=float(np.sqrt(np.mean(bass**2))/max(.0001,np.sqrt(np.mean(audio**2))))
   if ratio<.13:raise ValueError('No clear bass in this passage')
   mono=resample_poly(bass.mean(axis=0),80,441);notes=transcribe(mono,len(mono)/8000)
   cut=phrase(mono,notes,len(mono)/8000,counts=(16,32,24,12,8),minimum_confidence=.7)
   selected=[];step=cut['duration']/cut['beats']
   for n in notes:
    if n['start']>=cut['end']or n['end']<=cut['start']:continue
    item={**n,'start':round(max(0,n['start']-cut['start']),5),'end':round(min(cut['duration'],n['end']-cut['start']),5)}
    item['beat']=item['start']/step;item['length']=(item['end']-item['start'])/step;selected.append(item)
   result=dict(**row,token=token,bassFile=str(bass_file),notes=selected,cut=cut,bassRatio=ratio)
  except Exception as error:result=dict(**row,token=token,rejected=str(error))
  save.write_text(json.dumps(result));return result
 checked=[]
 with ThreadPoolExecutor(max_workers=args.workers)as pool:
  for i,row in enumerate(pool.map(process,jobs),1):
   checked.append(row)
   if i%4==0:print(json.dumps(dict(checked=i,total=len(jobs),accepted=sum('cut'in r for r in checked),seconds=round(time.monotonic()-started))),flush=True)
 selected=[];duplicates=[]
 for source in sources:
  picks=sorted([r for r in checked if r.get('sourceId')==source.get('sourceId')and 'cut'in r],key=lambda r:r['cut']['score'],reverse=True);kept=[]
  for row in picks:
   match=next((old for old in kept if similar(row,old)>.965),None)
   if not match:match=next((old for old in selected if similar(row,old)>.985),None)
   if match:duplicates.append(dict(source=source['title'],sameAs=match['token']));continue
   kept.append(row)
   if len(kept)==3:break
  selected.extend(kept)
 selected.sort(key=lambda r:(r['genre'],r['number'],r['start']+r['cut']['start']))
 folder=Path('ear-assets/cultural-rc352');folder.mkdir(exist_ok=True);rows=[];mixes={};phrases={};drum_candidates={};counts=Counter();audit=[]
 for row in selected:
  counts[row['sourceId']]+=1;take=counts[row['sourceId']];cut=row['cut'];start=row['start']+cut['start'];duration=cut['duration'];uid=row['genre']+'-'+row['token'];target=folder/(uid+'.ogg');audio=decode(row['path'],start=start,seconds=duration)
  fade=88;audio[:,-fade:]+=np.linspace(0,1,fade)*(audio[:,0,None]-audio[:,-1,None])
  subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar','44100','-ac','2','-i','pipe:0','-c:a','libopus','-b:a','160k',str(target)],input=audio.T.astype('<f4').tobytes(),check=True)
  raw=np.load(row['bassFile']);offset=round(cut['start']*44100);bass=raw[:,offset:offset+audio.shape[1]]
  if bass.shape[1]<audio.shape[1]:bass=np.pad(bass,((0,0),(0,audio.shape[1]-bass.shape[1])))
  rest=audio-bass;spec=librosa.stft(rest,n_fft=2048,hop_length=512);_,percussive=librosa.decompose.hpss(spec,margin=(2,2));drums=librosa.istft(percussive,n_fft=2048,hop_length=512,length=audio.shape[1]);parts=np.stack([drums,bass,rest-drums,np.zeros_like(rest)])
  entry=encode_mix(audio,parts,folder/(uid+'-mix.flac'));mixes['./'+str(target)]=entry
  previous=next((r for r in reversed(audit)if r['sourceId']==row['sourceId']),None);difference=difference_from(row,previous)
  name=(row['genre'].title()+' '+str(row['number']).zfill(2)+'.'+str(take)).replace(' ','')[:12]
  family='Bassmatics'if 'bassmatics'in row['file'].lower()else row['genre'].title()+' recordings'
  item=dict(id=uid,title=name,displayName=name,originalTitle=row['title'],group=row['genre'],collection='recorded-cultural',culturalUpload=True,originalMix=True,audio='./'+str(target),duration=duration,parts=[dict(start=0,end=duration)],notes=[{k:v for k,v in n.items()if k not in ['beat','length']}for n in row['notes']],sourceFilename=re.sub(r'(?i)^Y2Mate\.is\s*-\s*','',row['file']),sourceStart=round(start,5),sourceFamily=family,sourceRecording=row['sourceId'],originalBpm=cut['bpm'],practiceStyle=row['genre'],difference=difference,automaticNotes=True,meter=2 if '6_8'in row['file']else 4,subdivision=3 if '6_8'in row['file']else None)
  rows.append(item);phrases[uid]=[[0,duration,cut['beats'],0,target.stat().st_size,1]];audit.append(dict(**row,finalId=uid,difference=difference))
  score=entry['drumsRms']/(entry['bassRms']+entry['otherRms']+.001)*cut['closure']
  if row['sourceId']not in drum_candidates or score>drum_candidates[row['sourceId']]['score']:
   drum_candidates[row['sourceId']]=dict(score=score,row=item,pcm=resample_poly(drums,320,441,axis=1).T.astype('<f4'),beats=cut['beats'])
 drums=[]
 for source_id,data in drum_candidates.items():
  row=data['row'];pcm=data['pcm'];peak=float(np.max(np.abs(pcm)));rms=float(np.sqrt(np.mean(pcm**2)));gain=min(.84/max(.001,peak),.15/max(.001,rms));pcm*=gain;pcm[-16:]+=np.linspace(0,1,16)[:,None]*(pcm[0]-pcm[-1]);path=folder/('drums-'+source_id+'.flac')
  subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar','32000','-ac','2','-i','pipe:0','-c:a','flac','-sample_fmt','s16',str(path)],input=pcm.tobytes(),check=True)
  drum_id='cultural-drums-'+source_id;drums.append(dict(id=drum_id,title=row['displayName']+' · source drums (est.)',genre=row['practiceStyle'],bpm=row['originalBpm'],beats=data['beats'],url='./'+str(path),tempoSource='estimated',estimated=True,automaticDefault=True,sourceId=row['id']))
  for item in rows:
   if item['sourceRecording']==source_id:item['sourceDrumLoopId']=drum_id
 Path('ear-source/cultural-recordings-rc352.js').write_text('/* Owner-supplied cultural recordings; notes, tempo and separation are estimates. */\n'+''.join('window.'+name+'='+json.dumps(value,separators=(',',':'))+';\n'for name,value in [('BassCulturalUploads',rows),('BassCulturalMixes',mixes),('BassCulturalPhrases',phrases),('BassCulturalDrums',drums)]))
 report=dict(sourceRecordings=len(sources),reviewedPassages=len(jobs),loops=len(rows),byGenre=dict(Counter(r['practiceStyle']for r in rows)),representedSources=len(counts),duplicatesOmitted=len(duplicates),rejections=dict(Counter(r['rejected']for r in checked if 'rejected'in r)),unrepresented=[r['title']for r in sources if r['sourceId']not in counts],checks=[dict(id=r['finalId'],source=r['title'],sourceId=r['sourceId'],genre=r['genre'],start=round(r['start']+r['cut']['start'],5),cut=r['cut'],difference=r['difference'])for r in audit])
 (folder/'review.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items()if k!='checks'}),flush=True)
 active={Path(r['audio']).name for r in rows}|{Path(r['url']).name for r in mixes.values()}|{Path(r['url']).name for r in drums}
 for path in list(folder.glob('*.ogg'))+list(folder.glob('*.flac')):
  if path.name not in active:path.unlink()

if __name__=='__main__':main()
