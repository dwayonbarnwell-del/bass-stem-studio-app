"""Prepare phrase-aware verse/chorus excerpts from the owner's source recordings.

A repeated harmonic and bass pattern must return at the loop boundary. Structural
labels are automatic estimates, not manual annotations. Original audio is kept.
"""
from pathlib import Path
import argparse,hashlib,json,re,subprocess
import numpy as np
from scipy.signal import butter,sosfiltfilt,find_peaks
from scipy.ndimage import median_filter
from sklearn.cluster import KMeans
import librosa
RATE=8000;HOP=128

def decode(file,start=0,seconds=None,rate=RATE,channels=1):
 cmd=['ffmpeg','-v','error','-ss',str(start),'-i',str(file)]
 if seconds is not None:cmd+=['-t',str(seconds)]
 cmd+=['-ac',str(channels),'-ar',str(rate),'-f','f32le','-']
 x=np.frombuffer(subprocess.check_output(cmd),'<f4').copy()
 return x if channels==1 else x.reshape(-1,channels)
def unit(x):return x/np.maximum(np.linalg.norm(x,axis=-1,keepdims=True),1e-8)
def cosine(a,b):return float(np.dot(a,b)/max(1e-9,np.linalg.norm(a)*np.linalg.norm(b)))
def key_of(chroma):
 profiles=[np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]),np.array([6.33,2.68,3.52,5.38,2.6,3.53,2.54,4.75,3.98,2.69,3.34,3.17])]
 value=chroma.mean(axis=0);value-=value.mean();scores=[]
 for minor,p in enumerate(profiles):
  for tonic in range(12):scores.append((cosine(value,np.roll(p-p.mean(),tonic)),tonic,bool(minor)))
 scores.sort(reverse=True);return dict(tonic=scores[0][1],minor=scores[0][2],confidence=round(scores[0][0],4),margin=round(scores[0][0]-scores[1][0],4))
def features(file,cache,prior):
 if cache.exists():return dict(np.load(cache))
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(file)]))
 raw=decode(file,0,min(duration,360));spec=np.abs(librosa.stft(raw,n_fft=2048,hop_length=HOP))
 harmonic,percussive=librosa.decompose.hpss(spec,margin=(2,2))
 chroma=librosa.feature.chroma_stft(S=harmonic**2,sr=RATE,n_fft=2048,hop_length=HOP,tuning=0,norm=2)
 bass_spec=harmonic.copy();bass_spec[np.fft.rfftfreq(2048,1/RATE)>260]=0
 bass=librosa.feature.chroma_stft(S=bass_spec**2,sr=RATE,n_fft=2048,hop_length=HOP,tuning=0,norm=2)
 onset=librosa.onset.onset_strength(S=librosa.amplitude_to_db(percussive+1e-8),sr=RATE,hop_length=HOP)
 _,beat_frames=librosa.beat.beat_track(onset_envelope=onset,sr=RATE,hop_length=HOP,bpm=float(prior),tightness=80,trim=True)
 times=librosa.frames_to_time(beat_frames,sr=RATE,hop_length=HOP)
 mfcc=librosa.feature.mfcc(y=raw,sr=RATE,n_fft=2048,hop_length=HOP,n_mfcc=13)
 energy=librosa.feature.rms(S=spec,frame_length=2048,hop_length=HOP)[0]
 def sync(values):return np.array([np.median(values[...,a:b],axis=-1) for a,b in zip(beat_frames[:-1],beat_frames[1:])])
 C=sync(chroma);B=sync(bass);M=sync(mfcc);E=sync(energy);O=sync(onset)
 # Beat-context descriptors distinguish recurring sections, rather than merely loud moments.
 M=(M-np.median(M,axis=0))/(np.std(M,axis=0)+1e-5)
 desc=np.column_stack([unit(C),.24*M,.3*np.log(np.maximum(E,1e-5))])
 labels=KMeans(n_clusters=min(5,max(2,len(desc)//80)),n_init=10,random_state=348).fit_predict(desc)
 labels=median_filter(labels,size=9,mode='nearest')
 result=dict(times=times,C=C,B=B,M=M,E=E,O=O,labels=labels,duration=np.array(duration))
 np.savez_compressed(cache,**result);return result

def cadence_choices(f):
 times=f['times'];B=f['B'];C=unit(f['C']);rms=f['bassEnvelope'];candidates=[]
 for beats in [16,32,8]:
  for start in range(4,len(B)-beats-4):
   end=start+beats;a=float(times[start]);b=float(times[end]);seconds=b-a
   if a<18 or b>float(f['duration'])-8 or not 7<=seconds<=18:continue
   first=B[start:start+2,:12].sum(axis=0);last=B[end-2:end,:12].sum(axis=0)
   if min(first.sum(),last.sum())<1:continue
   root1=int(first.argmax());root2=int(last.argmax());distance=(root1-root2)%12
   if distance not in [0,5,7]:continue
   if min(first.max()/first.sum(),last.max()/last.sum())<.5:continue
   harmony=cosine(C[start:start+4].mean(axis=0),C[end-4:end].mean(axis=0))
   if harmony<.74:continue
   window=rms[max(0,int(a/.02)):min(len(rms),int(b/.02))]
   if not len(window) or window.mean()<.004:continue
   edge=rms[max(0,int((b-.08)/.02)):min(len(rms),int(b/.02))]
   ratio=float(edge.mean()/max(window.mean(),1e-8)) if len(edge) else 1
   # A completed bass note must release before the cut, not be truncated.
   if ratio>.6:continue
   confidence=.4*harmony+.3*(1 if distance==0 else .85)+.3*(1-ratio)
   if confidence<.81:continue
   intervals=np.diff(times[start:end+1]);cv=float(intervals.std()/intervals.mean())
   if cv>.085:continue
   score=confidence-.06*abs(seconds-12.5)/12.5-cv
   candidates.append(dict(start=a,end=b,beats=beats,seconds=seconds,closure=confidence,cv=cv,score=score,boundaryMethod='released-cadence',cadenceHarmony=harmony,lastNoteReleased=True,releaseRatio=ratio,firstBassPitchClass=root1,lastBassPitchClass=root2,context=C[start:end].mean(axis=0)))
 if not candidates:raise ValueError('No complete returning phrase or released cadence passed review')
 candidates.sort(key=lambda x:x['score'],reverse=True);first=candidates[0]
 choices=[c for c in candidates if c['end']<first['start']-3 or c['start']>first['end']+3]
 if not choices:raise ValueError('Only one complete released cadence found')
 second=max(choices,key=lambda c:c['score']+.04*(1-cosine(c['context'],first['context'])))
 rows=sorted([first,second],key=lambda c:c['start']);rows[0]['name']='Verse';rows[1]['name']='Chorus';return rows

def choose(f,bass_priority=False):
 times=f['times'];C=unit(f['C']);B=unit(f['B']);M=f['M'];E=f['E'];labels=f['labels'];n=len(C)
 # Harmonic changes and bass attacks identify a consistent bar phase.
 change=np.r_[0,np.linalg.norm(np.diff(C,axis=0),axis=1)]
 phase_scores=[float(np.mean(change[p::4])) for p in range(4)];phase=int(np.argmax(phase_scores))
 candidates=[]
 for length in [16,32,8]:
  for start in range(4,n-length-5):
   a,b=float(times[start]),float(times[start+length]);seconds=b-a
   if a<18 or b>min(float(f['duration'])-12,float(times[-1])-5) or not 6<=seconds<=21:continue
   intervals=np.diff(times[start:start+length+1]);cv=float(intervals.std()/intervals.mean())
   if cv>.075:continue
   # Both the returning bar and its lead-in must match the opening cycle.
   forward=cosine(C[start:start+4].ravel(),C[start+length:start+length+4].ravel())
   lead=cosine(C[start-4:start].ravel(),C[start+length-4:start+length].ravel())
   bass_forward=cosine(B[start:start+4].ravel(),B[start+length:start+length+4].ravel())
   bass_lead=cosine(B[start-4:start].ravel(),B[start+length-4:start+length].ravel())
   closure=(.24*forward+.16*lead+.36*bass_forward+.24*bass_lead) if bass_priority else (.36*forward+.24*lead+.24*bass_forward+.16*bass_lead)
   strong_bass=min(bass_forward,bass_lead)>=.86 and (forward+lead)/2>=.55
   if closure<(.81 if bass_priority else .79) or (bass_priority and not strong_bass) or (not bass_priority and min(forward,lead)<.70):continue
   # Compare whole phrases elsewhere in the recording, excluding overlapping cuts.
   block=C[start:start+length];matches=[]
   for other in range(4,n-length-4,4):
    if abs(other-start)<length*2:continue
    matches.append(cosine(block.ravel(),C[other:other+length].ravel()))
   recurrence=float(np.mean(sorted(matches,reverse=True)[:3])) if matches else 0
   context=np.r_[C[start:start+length].mean(axis=0),.25*M[start:start+length].mean(axis=0)]
   length_penalty=(abs(seconds-12.5)/12.5)*.08+(0 if 9.5<=seconds<=15.5 else .08)
   length_penalty+=.025 if length==8 else .02 if length==32 else 0
   metrical=.035 if start%4==phase else 0
   score=closure+.09*recurrence+metrical-length_penalty-1.3*cv
   candidates.append(dict(start=a,end=b,beats=length,seconds=seconds,closure=closure,forward=forward,lead=lead,bassForward=bass_forward,bassLead=bass_lead,recurrence=recurrence,cv=cv,score=score,context=context,label=int(labels[start:start+length].mean().round()),energy=float(np.mean(E[start:start+length])),beatIndex=start))
 if not candidates:
  if not bass_priority:return choose(f,True)
  if 'bassEnvelope' in f:return cadence_choices(f)
  raise ValueError('No complete returning phrase passed the boundary checks')
 candidates.sort(key=lambda c:c['score'],reverse=True)
 # Select a recurrent refrain plus a contrasting earlier verse passage.
 early=[c for c in candidates if c['start']<min(140,float(f['duration'])*.7)] or candidates
 chorus=max(early,key=lambda c:c['score']+.055*c['recurrence']+.018*np.log(max(c['energy'],1e-5)))
 alternatives=[c for c in early if c['end']<=chorus['start']-3 or c['start']>=chorus['end']+8]
 if not alternatives:alternatives=[c for c in candidates if abs(c['start']-chorus['start'])>c['seconds']+3]
 if not alternatives:
  if not bass_priority:return choose(f,True)
  if 'bassEnvelope' in f:return cadence_choices(f)
  raise ValueError('No second complete section passed the boundary checks')
 verse=max(alternatives,key=lambda c:c['score']+.09*(1-cosine(c['context'],chorus['context']))+(.025 if c['start']<chorus['start'] else 0))
 # The structural interpretation remains explicitly marked as an estimate.
 for name,row in [('Verse',verse),('Chorus',chorus)]:row['name']=name
 return [verse,chorus]

def notes_for(file,start,seconds):
 raw=decode(file,start,seconds)
 harmonic=librosa.effects.harmonic(raw,n_fft=2048,hop_length=128,margin=3)
 low=sosfiltfilt(butter(4,[28,260],btype='bandpass',fs=RATE,output='sos'),harmonic)
 pitch,_,prob=librosa.pyin(low,fmin=librosa.note_to_hz('B0'),fmax=librosa.note_to_hz('B3'),sr=RATE,frame_length=2048,hop_length=160)
 midi=librosa.hz_to_midi(pitch);values=np.where(np.isfinite(midi),np.rint(midi),-1).astype(int)
 smooth=median_filter(values,size=3,mode='nearest');rows=[];current=None
 def finish(at):
  nonlocal current
  if current:
   current['end']=round(min(seconds,at),4);confidence=current.pop('sum')/current.pop('count');current['confidence']=round(confidence,3);current['review']=bool(confidence<.72)
   if current['end']-current['start']>=.08:rows.append(current)
   current=None
 for i,m in enumerate(smooth):
  at=i*.02;value=int(m) if 23<=m<=59 and prob[i]>=.35 and at<seconds else None
  if current and value!=current['midi']:finish(at)
  if value is not None:
   if current is None:current=dict(midi=value,start=round(at,4),end=round(min(seconds,at+.02),4),sum=float(prob[i]),count=1,velocity=82)
   else:current['sum']+=float(prob[i]);current['count']+=1
 finish(seconds)
 return rows

def write_audio(file,cut,out):
 # Blend only the last 18 ms towards the source immediately before the opening.
 # This keeps the original full phrase and its timing, while avoiding a hard waveform cut.
 sr=48000;a=cut['start'];seconds=cut['seconds'];pre=.025
 raw=decode(file,max(0,a-pre),seconds+pre,rate=sr,channels=2)
 lead=round(pre*sr);frames=round(seconds*sr);mix=raw[lead:lead+frames].copy()
 if len(mix)!=frames:raise ValueError('Incomplete source phrase')
 cross=min(round(.018*sr),lead)
 weights=np.linspace(0,1,cross)[:,None]
 mix[-cross:]=mix[-cross:]*(1-weights)+raw[lead-cross:lead]*weights
 subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(sr),'-ac','2','-i','pipe:0','-c:a','libopus','-b:a','192k',str(out)],input=mix.astype('<f4').tobytes(),check=True)
 return frames/sr

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--source',type=Path,required=True);ap.add_argument('--cache',type=Path,required=True);ap.add_argument('--only');args=ap.parse_args();args.cache.mkdir(parents=True,exist_ok=True)
 old=json.loads(Path('scripts/reggae_sources_rc348.json').read_text())
 folder=Path('ear-assets/reggae-rc348');folder.mkdir(exist_ok=True)
 rows=[];audit=[];failed=[]
 for i,original in enumerate(old,1):
  if 'Action feat Nadine Sutherland' in original['sourceFilename']:continue
  if args.only and args.only not in original['sourceFilename']:continue
  uid=original['id'];checkpoint=args.cache/(uid+'-sections.json')
  if checkpoint.exists():
   row,checks=json.loads(checkpoint.read_text())
   for section in row['sections']:
    if not Path(section['audio']).exists():
     write_audio(args.source/original['sourceFilename'],dict(start=section['sourceStart'],seconds=section['duration']),Path(section['audio']))
   rows.append(row);audit.extend(checks);continue
  try:
   file=args.source/original['sourceFilename'];prior=original['originalBpm'];f=features(file,args.cache/(uid+'-features.npz'),prior);cuts=choose(f);key=key_of(f['C']);sections=[];checks=[]
   for cut in cuts:
    label=cut['name'];out=folder/(uid+'-'+label.lower()+'.ogg');notes=notes_for(file,cut['start'],cut['seconds']);duration=write_audio(file,cut,out)
    if len(notes)<4:raise ValueError('Too few dependable bass-note estimates in '+label)
    section=dict(label=label,structuralEstimate=True,audio='./'+str(out),duration=duration,beats=cut['beats'],sourceStart=round(cut['start'],6),sourceEnd=round(cut['end'],6),notes=notes,key=key,boundaryScore=round(cut['closure'],4),noteCount=len(notes))
    sections.append(section);checks.append({k:round(v,5) if isinstance(v,float) else v for k,v in cut.items() if k!='context'}|dict(id=uid,notes=len(notes),audio=section['audio']))
   row={k:v for k,v in original.items() if k not in ['audio','duration','parts','notes','sourceStart','analysisVersion']}
   row.update(analysisVersion='phrase-return-v1',sections=sections,audio=sections[0]['audio'],duration=sections[0]['duration'],parts=[dict(start=0,end=s['duration']) for s in sections],notes=sections[0]['notes'],key=key)
   checkpoint.write_text(json.dumps([row,checks]));rows.append(row);audit.extend(checks);print('Prepared',i,'of 53',uid,flush=True)
  except Exception as e:
   failed.append(dict(id=uid,source=original['sourceFilename'],error=str(e)));print('Needs review',uid,str(e),flush=True)
 if args.only:
  Path('/tmp/rc348-probe.json').write_text(json.dumps(dict(rows=rows,audit=audit,failed=failed),indent=2));return
 unavailable=[dict(id=r['id'],title=next((o['title'] for o in old if o['id']==r['id']),r['source']),reason=r['error']) for r in failed]
 valid=[]
 for row in rows:
  if any(not section['notes'] for section in row['sections']):
   unavailable.append(dict(id=row['id'],title=row['title'],reason='No clear bass notes in one selected section'))
  else:valid.append(row)
 rows=valid;ids={row['id'] for row in rows};audit=[c for c in audit if c['id'] in ids]
 # Different filenames can contain the same recording. Compare decoded audio,
 # because Opus container serial numbers make file hashes differ.
 seen={};duplicates=[]
 for row in rows:
  fingerprints=tuple(hashlib.sha256(decode(section['audio'],rate=RATE,channels=2).tobytes()).hexdigest() for section in row['sections'])
  prior=seen.get(fingerprints)
  if prior:
   row['duplicateOf']=prior['id'];duplicates.append(dict(id=row['id'],duplicateOf=prior['id']))
   for section,original in zip(row['sections'],prior['sections']):section['audio']=original['audio']
   row['audio']=row['sections'][0]['audio']
  else:seen[fingerprints]=row
 active=[row for row in rows if not row.get('duplicateOf')]
 sections_by_id={row['id']:row['sections'] for row in rows}
 for check in audit:
  check['audio']=next(section['audio'] for section in sections_by_id[check['id']] if section['label']==check['name'])
 active_audio={section['audio'] for row in rows for section in row['sections']}
 for path in folder.glob('*.ogg'):
  if './'+str(path) not in active_audio:path.unlink()
 phrases={r['id']:[[0,s['duration'],s['beats'],0,Path(s['audio']).stat().st_size,1] for s in r['sections']] for r in rows}
 Path('ear-source/reggae-recordings-rc348.js').write_text('/* Original verse/chorus phrase choices. Section labels and notes are automatic estimates. */\nwindow.BassReggaeUnavailable='+json.dumps(unavailable,separators=(',',':'))+';\nwindow.BassReggaeRecordings='+json.dumps(rows,separators=(',',':'))+';\nObject.assign(window.BassRecordedPhrases,'+json.dumps(phrases,separators=(',',':'))+');\n')
 Path('tests/reggae_phrases_rc348.json').write_text(json.dumps(dict(songs=len(rows),sections=len(audit),activeSongs=len(active),activeSections=sum(len(row['sections']) for row in active),duplicates=duplicates,removedSong='Action feat Nadine Sutherland',failed=unavailable,checks=audit),indent=2))
 print('Prepared',len(active),'visible songs,',sum(len(row['sections']) for row in active),'sections;',len(duplicates),'duplicate and',len(unavailable),'need review',flush=True)
if __name__=='__main__':main()
