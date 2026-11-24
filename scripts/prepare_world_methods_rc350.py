"""Extract returning bass phrases, retaining distinct lesson variations once.

Existing lesson annotations nominate regions only. Notes and musical returns
are checked again against the newly supplied audio with a bass-specific model.
Uncertain notes and timing remain labelled as automatic estimates in the app.
"""
from pathlib import Path
import argparse,difflib,hashlib,json,math,re,subprocess,threading,time,warnings
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
import librosa,numpy as np
from scipy.signal import resample_poly
from bass_stem_rc348 import BassSeparator
from refine_reggae_bass_rc348 import transcribe
from prepare_practice_mix_rc350 import decode,encode_mix
warnings.filterwarnings('ignore',category=UserWarning)

SOURCES={
 'clip-63':('Congolese-Bass-Lesson-Thumb','Thumb','soukous'),
 'clip-64':('Part-1-Cameroonian','Makossa 1','makossa'),
 'clip-65':('Part-2-Cameroonian','Makossa 2','makossa'),
 'clip-66':('Part-3-Cameroonian','Makossa 3','makossa'),
 'clip-67':('Sebene-Bass-Guitar','Sebene','soukous'),
 'clip-68':('Structuring-Congolese','Congo form','soukous'),
 'clip-69':('The-African-Bass-Lesson-2022','Africa 2022',None),
 'clip-70':('The-African-Bass-Lesson-Edd','Africa bass',None),
 'clip-71':('World-Music-Online','World bass',None),
 'clip-72':('Zouk-Bass-Guitar','Zouk','zouk'),
 'clip-49':('THE-MOST-EASIEST','Easy Makossa','makossa'),
}

def sequence(notes):
 pitches=[n['midi'] for n in notes]
 if not pitches:return []
 root=pitches[0]
 return [(midi-root)%12 for midi in pitches]

def nominate(root,legacy):
 result=[]
 for row in legacy:
  prefix,title,style=SOURCES[row['id']];path=next(root.rglob(prefix+'*.mp3'))
  candidates=[]
  parts=row['parts'][1:] or [{'start':0,'end':row['duration']}]
  if row['duration']<=45:parts=[{'start':0,'end':row['duration']},*parts]
  for part in parts:
   notes=[n for n in row['notes'] if part['start']<=n['start']<part['end'] and 23<=n['midi']<=59 and n.get('confidence',0)>=.67 and n['end']-n['start']>=.11]
   if len(notes)<5:continue
   coverage=sum(min(.7,n['end']-n['start']) for n in notes)/(part['end']-part['start'])
   score=float(np.mean([n['confidence'] for n in notes]))+min(.5,coverage)+min(.3,len(notes)/80)
   candidates.append(dict(source=str(path),legacy=row['id'],title=title,style=style,start=max(0,part['start']-1.2),end=min(row['duration'],part['end']+2),score=score,sequence=sequence(notes)))
  selected=[]
  for candidate in sorted(candidates,key=lambda r:r['score'],reverse=True):
   if any(difflib.SequenceMatcher(None,candidate['sequence'],old['sequence'],autojunk=False).ratio()>.91 for old in selected):continue
   selected.append(candidate)
   if len(selected)>=12:break
  result.extend(selected)
 return result

def phrase(bass,notes,seconds):
 hop=128
 env=librosa.onset.onset_strength(y=bass,sr=8000,hop_length=hop,n_fft=1024)
 tempo,frames=librosa.beat.beat_track(onset_envelope=env,sr=8000,hop_length=hop,start_bpm=115,tightness=80,trim=False)
 beats=librosa.frames_to_time(frames,sr=8000,hop_length=hop)
 if len(beats)<10:raise ValueError('No dependable pulse')
 spec=np.abs(librosa.stft(bass,n_fft=2048,hop_length=hop));chroma=librosa.feature.chroma_stft(S=spec**2,sr=8000,n_fft=2048,hop_length=hop,tuning=0)
 def descriptor(start,end):
  lo=max(0,round(start*8000/hop));hi=min(chroma.shape[1],max(lo+1,round(end*8000/hop)))
  return chroma[:,lo:hi].mean(axis=1)
 def cosine(a,b):return float(np.dot(a,b)/max(1e-8,np.linalg.norm(a)*np.linalg.norm(b)))
 options=[]
 for count in [16,32,8]:
  for index in range(2,len(beats)-count-2):
   start,end=float(beats[index]),float(beats[index+count]);duration=end-start
   if not 5<=duration<=21 or end+.5>seconds:continue
   intervals=np.diff(beats[index:index+count+1]);cv=float(intervals.std()/max(.001,intervals.mean()))
   if cv>.075:continue
   selected=[n for n in notes if n['start']<end and n['end']>start]
   if len(selected)<5:continue
   voiced=sum(min(n['end'],end)-max(n['start'],start) for n in selected)/duration
   confidence=float(np.mean([n['confidence'] for n in selected]))
   if voiced<.32 or confidence<.72:continue
   beat=duration/count
   forward=cosine(descriptor(start,start+beat*2),descriptor(end,end+beat*2))
   lead=cosine(descriptor(start-beat*2,start),descriptor(end-beat*2,end))
   closure=.6*forward+.4*lead
   tail=bass[round((end-.08)*8000):round(end*8000)]
   body=bass[round(start*8000):round(end*8000)]
   release=float(np.sqrt(np.mean(tail**2))/max(.0001,np.sqrt(np.mean(body**2)))) if len(tail) else 1
   first=selected[0]['midi']%12;last=selected[-1]['midi']%12
   cadence=release<.35 and (first-last)%12 in [0,5,7] and closure>.72
   if closure<.85 and not cadence:continue
   score=closure+min(.2,voiced*.2)+confidence*.15-.4*cv-.06*abs(duration-11)/11
   options.append(dict(start=start,end=end,duration=duration,beats=count,bpm=60/beat,closure=closure,cv=cv,score=score,confidence=confidence,cadence=cadence))
 if not options:raise ValueError('No complete returning phrase passed review')
 return max(options,key=lambda r:r['score'])

def signature(notes,beats):
 step=beats;root=notes[0]['midi']
 events=[(round(n['beat']*8),(n['midi']-root)%12,round(n['length']*8)) for n in notes]
 for period in [4,8]:
  if beats<=period:continue
  first=[event for event in events if event[0]<period*8]
  second=[(at-period*8,pitch,length) for at,pitch,length in events if period*8<=at<period*16]
  if first==second:events=first;step=period;break
 return step,events

_fingerprints={}
def audio_fingerprint(row):
 if row['token'] in _fingerprints:return _fingerprints[row['token']]
 raw=np.load(row['bassFile']);cut=row['cut'];raw=raw[:,round(cut['start']*44100):round(cut['end']*44100)]
 bass=resample_poly(raw.mean(axis=0),80,441)
 spec=np.abs(librosa.stft(bass,n_fft=2048,hop_length=128));chroma=librosa.feature.chroma_stft(S=spec**2,sr=8000,n_fft=2048,hop_length=128,tuning=0)
 x=np.linspace(0,chroma.shape[1]-1,128);value=np.stack([np.interp(x,np.arange(chroma.shape[1]),channel) for channel in chroma])
 value/=np.maximum(1e-8,np.linalg.norm(value,axis=0));_fingerprints[row['token']]=value
 return value

def audio_match(a,b):
 aa,bb=audio_fingerprint(a),audio_fingerprint(b);best=0
 for factor in [1,2]:
  for reverse in [False,True]:
   left,right=(bb,aa) if reverse else (aa,bb)
   if factor==2:
    right=np.concatenate([right[:,::2],right[:,::2]],axis=1)
   for shift in range(0,128,2):
    cosine=np.sum(left*np.roll(right,shift,axis=1),axis=0)
    score=.6*float(np.mean(cosine))+.4*float(np.quantile(cosine,.1));best=max(best,score)
 return best

def compare(a,b):
 # Register and key changes are useful lesson variations, even when their
 # pitch-class fingerprints match. Check register before using chroma.
 if abs(float(np.median([n['midi'] for n in a['notes']]))-float(np.median([n['midi'] for n in b['notes']])))>1.1:return 0
 sound=audio_match(a,b)
 if sound>.95:return sound
 sa,sb=a['signature'],b['signature']
 period=math.lcm(sa[0],sb[0]);qa=sorted((at+repeat*sa[0]*8,pitch,length) for repeat in range(period//sa[0]) for at,pitch,length in sa[1]);qb=sorted((at+repeat*sb[0]*8,pitch,length) for repeat in range(period//sb[0]) for at,pitch,length in sb[1])
 if not qa or not qb:return 0
 def tokens(events):
  root=events[0][1]
  return [((pitch-root)%12,round(((events[(i+1)%len(events)][0]-at)%(period*8))/2)) for i,(at,pitch,length) in enumerate(events)]
 target=tokens(qa);best=0
 for index in range(len(qb)):
  rotated=qb[index:]+[(at+period*8,pitch,length) for at,pitch,length in qb[:index]]
  best=max(best,difflib.SequenceMatcher(None,target,tokens(rotated),autojunk=False).ratio())
 return best

def difference_from(row,previous):
 if previous is None:return 'Main pattern'
 a=[n['midi']%12 for n in row['notes']];b=[n['midi']%12 for n in previous['notes']]
 relative=difflib.SequenceMatcher(None,sequence(row['notes']),sequence(previous['notes']),autojunk=False).ratio()
 shift=float(np.median([n['midi'] for n in row['notes']]))-float(np.median([n['midi'] for n in previous['notes']]))
 if abs(shift)>=10 and relative>.8:return 'Octave '+('up' if shift>0 else 'down')
 if abs(shift)>=1.5 and relative>.8:return 'Key change'
 prefix=max(1,min(len(a),len(b))*2//3)
 if a[:prefix]==b[:prefix] and a!=b:return 'Ending variation'
 names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B']
 added=sorted(set(a)-set(b));removed=sorted(set(b)-set(a))
 if added:return 'Adds '+', '.join(names[n] for n in added[:3])
 if removed:return 'Omits '+', '.join(names[n] for n in removed[:3])
 density=(len(a)/row['cut']['beats'])/max(.01,len(b)/previous['cut']['beats'])
 if density>1.3:return 'Busier rhythm'
 if density<.77:return 'More space'
 same=difflib.SequenceMatcher(None,a,b,autojunk=False).ratio()
 return 'Rhythm change' if same>.8 else 'New note order'

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);parser.add_argument('--legacy',type=Path);parser.add_argument('--model',required=True);parser.add_argument('--cache',type=Path,required=True);args=parser.parse_args();args.cache.mkdir(exist_ok=True)
 legacy=json.loads(args.legacy.read_text()) if args.legacy else json.loads(subprocess.check_output(['node','-e',"global.window=global;require('./ear-source/african-data-rc274.js');require('./ear-source/lesson-data-rc272.js');process.stdout.write(JSON.stringify([...BassAfricanStudies,...BassLessonStudies.filter(r=>r.id==='clip-49')]));"],text=True))
 proposals=nominate(args.source,legacy);print('Candidate lesson regions:',len(proposals),flush=True)
 local=threading.local();started=time.monotonic()
 def process(row):
  token=hashlib.sha256((row['legacy']+str(row['start'])+str(row['end'])).encode()).hexdigest()[:16]
  checkpoint=args.cache/(token+'.json');bass_file=args.cache/(token+'-bass.npy')
  previous=args.cache/(hashlib.sha256((row['source']+str(row['start'])+str(row['end'])).encode()).hexdigest()[:16]+'.json')
  for saved in [checkpoint,previous]:
   if saved.exists():
    result=json.loads(saved.read_text())
    if 'cut'in result:
     result['token']=token;result['signature']=signature(result['notes'],result['cut']['beats']);return result
    if result.get('analysisVersion')==35032:return result
  try:
   audio=decode(row['source'],start=row['start'],seconds=row['end']-row['start'])
   if bass_file.exists():separated=np.load(bass_file)
   else:
    if not hasattr(local,'model'):local.model=BassSeparator(args.model,threads=2)
    separated=local.model.separate(audio);np.save(bass_file,separated)
   bass=resample_poly(separated.mean(axis=0),80,441).astype(np.float32)
   ratio=float(np.sqrt(np.mean(separated**2))/max(.0001,np.sqrt(np.mean(audio**2))))
   if ratio<.13:raise ValueError('No clear bass performance in this region')
   notes=transcribe(bass,len(bass)/8000)
   if len(notes)<5:raise ValueError('Too few clear bass notes')
   chosen=phrase(bass,notes,len(bass)/8000)
   start,end=chosen['start'],chosen['end'];step=chosen['duration']/chosen['beats']
   selected=[]
   for n in notes:
    if n['start']>=end or n['end']<=start:continue
    item={**n,'start':round(max(0,n['start']-start),5),'end':round(min(chosen['duration'],n['end']-start),5)}
    item['beat']=item['start']/step;item['length']=(item['end']-item['start'])/step;selected.append(item)
   result=dict(**row,token=token,bassFile=str(bass_file),cut=chosen,notes=selected,signature=signature(selected,chosen['beats']),bassRatio=ratio,analysisVersion=35032)
   np.save(bass_file,separated);checkpoint.write_text(json.dumps(result));return result
  except Exception as error:
   result=dict(**row,rejected=str(error),analysisVersion=35032);checkpoint.write_text(json.dumps(result));return result
 checked=[]
 with ThreadPoolExecutor(max_workers=1) as pool:
  for i,row in enumerate(pool.map(process,proposals),1):
   checked.append(row)
   if i%10==0:print(json.dumps(dict(checked=i,total=len(proposals),accepted=sum('cut' in r for r in checked),seconds=round(time.monotonic()-started))),flush=True)
 selected=[];duplicates=[]
 for row in sorted([r for r in checked if 'cut' in r],key=lambda r:r['cut']['score'],reverse=True):
  match=next((old for old in selected if compare(row,old)>.92),None)
  if match:
   duplicates.append(dict(source=Path(row['source']).name,start=row['start']+row['cut']['start'],sameAs=match['token']));continue
  selected.append(row)
 selected.sort(key=lambda r:(list(SOURCES).index(r['legacy']),r['start']+r['cut']['start']))
 folder=Path('ear-assets/world-methods-rc350');folder.mkdir(exist_ok=True);rows=[];mixes={};audit=[];numbers=Counter()
 for row in selected:
  numbers[row['legacy']]+=1;cut=row['cut'];start=row['start']+cut['start'];duration=cut['duration'];uid='method-'+row['token'];target=folder/(uid+'.ogg')
  audio=decode(row['source'],start=start,seconds=duration)
  # Keep the exact captured phrase, blending only the last 2 ms at its return.
  fade=88;audio[:,-fade:]+=np.linspace(0,1,fade)*(audio[:,0,None]-audio[:,-1,None])
  subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar','44100','-ac','2','-i','pipe:0','-c:a','libopus','-b:a','160k',str(target)],input=audio.T.astype('<f4').tobytes(),check=True)
  raw_bass=np.load(row['bassFile']);lo=round(cut['start']*44100);bass=raw_bass[:,lo:lo+audio.shape[1]]
  if bass.shape[1]<audio.shape[1]:bass=np.pad(bass,((0,0),(0,audio.shape[1]-bass.shape[1])))
  rest=audio-bass;spec=librosa.stft(rest,n_fft=2048,hop_length=512);_,percussive=librosa.decompose.hpss(spec,margin=(2,2));drums=librosa.istft(percussive,n_fft=2048,hop_length=512,length=audio.shape[1]);parts=np.stack([drums,bass,rest-drums,np.zeros_like(rest)])
  entry=encode_mix(audio,parts,folder/(uid+'-mix.flac'));entry['addDrums']=bool(row['style'] and cut['cv']<.04 and entry['drumsRms']<max(.003,entry['bassRms']*.18));mixes['./'+str(target)]=entry
  previous=next((old for old in reversed(audit) if old['legacy']==row['legacy']),None)
  difference=difference_from(row,previous)
  name=(row['title'][:9]+' '+str(numbers[row['legacy']]).zfill(2))[:12]
  notes=[{key:value for key,value in n.items() if key not in ['beat','length']} for n in row['notes']]
  item=dict(id=uid,title=name,displayName=name,originalTitle=row['title']+' · pattern '+str(numbers[row['legacy']]),group='world-method',collection='recorded-world-method',originalMix=True,audio='./'+str(target),duration=duration,parts=[dict(start=0,end=duration)],notes=notes,sourceFilename=Path(row['source']).name,sourceStart=round(start,5),originalBpm=cut['bpm'],practiceStyle=row['style'],difference=difference,automaticNotes=True)
  rows.append(item);audit.append(dict(**row,finalId=uid,difference=difference))
 phrases={r['id']:[[0,r['duration'],audit[i]['cut']['beats'],0,Path(r['audio']).stat().st_size,1]] for i,r in enumerate(rows)}
 Path('ear-source/world-methods-rc350.js').write_text('/* Distinct owner-supplied lesson phrases; notes and pulse are automatic estimates. */\nwindow.BassWorldMethods='+json.dumps(rows,separators=(',',':'))+';\nwindow.BassWorldMethodMixes='+json.dumps(mixes,separators=(',',':'))+';\nObject.assign(window.BassRecordedPhrases,'+json.dumps(phrases,separators=(',',':'))+');\n')
 active={r['id'] for r in rows}
 for path in list(folder.glob('method-*.ogg'))+list(folder.glob('method-*-mix.flac')):
  if path.name.removesuffix('-mix.flac').removesuffix('.ogg') not in active:path.unlink()
 public=[]
 for row in audit:
  item={key:value for key,value in row.items() if key not in ['source','bassFile','sequence']};item['sourceFilename']=Path(row['source']).name;public.append(item)
 report=dict(sources=len(SOURCES),proposals=len(proposals),loops=len(rows),bySource=dict(numbers),duplicatesOmitted=len(duplicates),duplicates=duplicates,rejections=Counter(r['rejected'] for r in checked if 'rejected'in r),checks=public)
 (folder/'review.json').write_text(json.dumps(report,indent=2,default=str)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['duplicates','checks']}),flush=True)

if __name__=='__main__':main()
