"""Prepare original-mix practice loops from the owner's Reggae.zip.

Use --source for the extracted MP3 folder. Notes are automatic estimates;
uncertain pitches remain flagged. Original drums and bass always stay together.
"""
from pathlib import Path
import argparse,hashlib,json,re,subprocess
import numpy as np
from scipy.signal import butter,sosfiltfilt,fftconvolve
import librosa

def decode(file,start,seconds,rate):
 return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-ss',str(start),'-i',str(file),'-t',str(seconds),'-ac','1','-ar',str(rate),'-f','f32le','-']),'<f4').copy()
def title(name):
 text=re.sub(r'-[A-Za-z0-9_-]{11}$','',Path(name).stem)
 text=re.sub(r'(OfficialMusicVideo|OfficialVideowithLyrics|OfficialVideo|BestQuality|withlyrics|withLyrics|Lyrics|TopPop)','',text,flags=re.I)
 text=re.sub(r'(?<=[a-z])(?=[A-Z])',' ',text).replace('_',' ').replace('-',' ')
 text=re.sub(r'([A-Z])([A-Z][a-z])',r'\1 \2',text)
 return re.sub(r'\s+',' ',text).strip()
def same_recording(first,second):
 x=decode(first,25,60,4000);y=decode(second,25,60,4000)
 template=x[60000:140000].astype(float);y=y.astype(float)
 if len(template)<60000 or len(y)<len(template):return 0
 template-=template.mean();y-=y.mean()
 cross=fftconvolve(y,template[::-1],mode='valid')
 energy=fftconvolve(y*y,np.ones(len(template)),mode='valid')
 return float(np.max(cross/np.sqrt(np.maximum(energy,1e-15)*sum(template*template))))
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--source',type=Path,required=True);args=ap.parse_args()
 folder=Path('ear-assets/reggae-rc347');folder.mkdir(exist_ok=True)
 rows=[];phrases={};audit=[];seen={}
 for index,file in enumerate(sorted(args.source.glob('*.mp3')),1):
  uid='reggae-'+hashlib.sha256(file.name.encode()).hexdigest()[:12]
  checkpoint=folder/(uid+'.json')
  if checkpoint.exists():
   row,phrase,check=json.loads(checkpoint.read_text())
   if row.get('analysisVersion')=='harmonic-bass-v2':rows.append(row);phrases[uid]=phrase;audit.append(check);continue
  duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(file)]))
  skip=min(25,duration*.15);y=decode(file,skip,min(75,duration-skip-2),22050)
  env=librosa.onset.onset_strength(y=y,sr=22050,hop_length=256)
  tempo,frames=librosa.beat.beat_track(onset_envelope=env,sr=22050,hop_length=256,start_bpm=85,trim=True,tightness=100)
  beats=librosa.frames_to_time(frames,sr=22050,hop_length=256)
  if len(beats)<18:raise ValueError('Not enough regular beats: '+file.name)
  candidates=[]
  for start in range(2,len(beats)-16):
   pulse=beats[start:start+17];intervals=np.diff(pulse);cv=np.std(intervals)/np.mean(intervals)
   if 60/np.mean(intervals)<48 or 60/np.mean(intervals)>180:continue
   # Prefer a strong downbeat and a steady, complete four-bar passage.
   strength=env[min(len(env)-1,frames[start])]/max(.001,np.mean(env))
   candidates.append((cv-.008*strength,start,cv))
  if not candidates:raise ValueError('No stable passage: '+file.name)
  _,start,cv=min(candidates);a,b=beats[start],beats[start+16];seconds=float(b-a);native=960/seconds
  raw=decode(file,skip+float(a),seconds,8000)
  harmonic=librosa.effects.harmonic(raw,n_fft=2048,hop_length=128,margin=3)
  low=sosfiltfilt(butter(4,[28,260],btype='bandpass',fs=8000,output='sos'),harmonic)
  pitch,voiced,prob=librosa.pyin(low,fmin=librosa.note_to_hz('B0'),fmax=librosa.note_to_hz('B3'),sr=8000,frame_length=2048,hop_length=160,fill_na=np.nan)
  midi=librosa.hz_to_midi(pitch);notes=[];current=None
  for i,m in enumerate(midi):
   at=i*.02;v=int(round(m)) if np.isfinite(m) and prob[i]>=.35 else None
   if v is not None and not 23<=v<=59:v=None
   if current and (v!=current['midi'] or at>=seconds):
    current['end']=round(min(seconds,at),4)
    if current['end']-current['start']>=.08:
     current['confidence']=round(current.pop('probabilitySum')/current.pop('probabilityCount'),3);current['review']=current['confidence']<.72;notes.append(current)
    current=None
   if v is not None and current is None and at<seconds:current=dict(midi=v,start=round(at,4),end=round(min(seconds,at+.02),4),confidence=round(float(prob[i]),3),velocity=82,review=bool(prob[i]<.72),probabilitySum=float(prob[i]),probabilityCount=1)
   elif current:current['probabilitySum']+=float(prob[i]);current['probabilityCount']+=1
  if current:
   current['end']=round(seconds,4)
   if current['end']-current['start']>=.08:
    current['confidence']=round(current.pop('probabilitySum')/current.pop('probabilityCount'),3);current['review']=current['confidence']<.72;notes.append(current)
  # Keep the recording even when the bass transcription needs checking.
  audio=folder/(uid+'.ogg')
  subprocess.run(['ffmpeg','-v','error','-y','-ss',str(skip+float(a)),'-i',str(file),'-t',str(seconds),'-ar','48000','-ac','2','-c:a','libopus','-b:a','192k','-af','afade=t=in:d=0.002,afade=t=out:st='+str(max(0,seconds-.002))+':d=0.002',str(audio)],check=True)
  source_sha=hashlib.sha256(file.read_bytes()).hexdigest()
  label=title(file.name)
  row=dict(analysisVersion='harmonic-bass-v2',id=uid,title=label,originalTitle=label,collection='recorded-reggae',group='reggae',originalMix=True,audio='./'+str(audio),duration=seconds,parts=[dict(start=0,end=seconds)],notes=notes,automatic=True,sourceFilename=file.name,sourceSha256=source_sha,tempoReview=bool(cv>.08),sourceStart=round(skip+float(a),6))
  phrase=[[0,seconds,16,0,audio.stat().st_size,1]]
  check=dict(id=uid,title=label,source=file.name,sourceSha256=source_sha,bpm=round(native,3),beatIntervalCV=round(float(cv),4),notes=len(notes),reviewNotes=sum(n['review'] for n in notes))
  checkpoint.write_text(json.dumps([row,phrase,check]));rows.append(row);phrases[uid]=phrase;audit.append(check)
  print('Prepared',index,'of 54',flush=True)
 # Byte-identical imports represent the same source, even with different filenames.
 unique=[];duplicates=[];titles={};short_names=set()
 for row in rows:
  row['title']=title(row['sourceFilename']);row['originalTitle']=row['title']
  match=None;correlation=0
  if row['sourceSha256'] in seen:match=seen[row['sourceSha256']]
  normalized=re.sub('[^a-z0-9]','',row['title'].lower())
  if not match and normalized in titles:
   previous=titles[normalized];correlation=same_recording(args.source/previous['sourceFilename'],args.source/row['sourceFilename'])
   if correlation>.95:match=previous['id']
  if match:
   duplicates.append(dict(id=row['id'],kept=match,correlation=round(correlation,4)))
   (folder/(row['id']+'.ogg')).unlink(missing_ok=True);continue
  stem=re.sub(r'^(Gramps Morgan|Morgan Heritage|Tarrus Riley|Bob Marley|Tony Rebel\s+Swade|Beres Hammond|Garnett? Silk|Peter Andre|Jimmy Cliff|Luciano|Maxi Priest|Third World|UB40|Buju Banton|Sanchez)\s*','',row['title'],flags=re.I)
  name=stem[:12].strip();counter=1
  while name.lower() in short_names:
   counter+=1;suffix=' '+str(counter);name=stem[:12-len(suffix)].strip()+suffix
  row['displayName']=name;short_names.add(name.lower())
  seen[row['sourceSha256']]=row['id'];titles[normalized]=row;unique.append(row)
 Path('ear-source/reggae-recordings-rc347.js').write_text('/* Original mixes from the owner\'s Reggae.zip. Automatic notes need listening checks. */\nwindow.BassReggaeRecordings='+json.dumps(unique,separators=(',',':'))+';\nObject.assign(window.BassRecordedPhrases,'+json.dumps({r['id']:phrases[r['id']] for r in unique},separators=(',',':'))+');\n')
 Path('tests/reggae_import_rc347.json').write_text(json.dumps(dict(sourceFiles=len(rows),imported=len(unique),duplicates=duplicates,recordings=audit),indent=2))
 print('Imported',len(unique),'original reggae loops;',len(duplicates),'duplicate sources',flush=True)
if __name__=='__main__':main()
