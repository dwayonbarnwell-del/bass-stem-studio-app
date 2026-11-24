"""Check uploaded MIDI provenance, exported waveform and real attack timing."""
from pathlib import Path
import hashlib,json,subprocess
import mido,numpy as np
from scipy.ndimage import maximum_filter1d

report=json.loads(Path('audio/drums-rc349/manifest.json').read_text())
changes={row['loop']:row for row in report['changes']};worst=0;checked=0
for loop in report['loops']:
 path=Path(loop['sourceMidi']);assert hashlib.sha256(path.read_bytes()).hexdigest()==loop['sourceSha256']
 midi=mido.MidiFile(path);notes=[];tempos=[]
 for track in midi.tracks:
  tick=0
  for msg in track:
   tick+=msg.time
   if msg.type=='note_on' and msg.velocity:notes.append([round(tick/midi.ticks_per_beat,7),msg.note,msg.velocity])
   elif msg.type=='set_tempo':tempos.append(round(mido.tempo2bpm(msg.tempo),3))
 notes.sort(key=lambda n:(n[0],n[1]));assert notes==changes[loop['id']]['notes'];assert loop['bpm']==tempos[0]
 pcm=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',loop['url'],'-ar','32000','-ac','2','-f','f32le','-']),'<f4').reshape(-1,2)
 assert len(pcm)==loop['frames'] and np.isfinite(pcm).all()
 assert .02<float(np.sqrt(np.mean(pcm**2)))<=.161
 assert .15<float(np.abs(pcm).max())<.951
 assert float(np.max(np.abs(pcm[0]-pcm[-1])))<.0001
 # Independent spectral-flux measurement checks strong snare attacks against
 # their source MIDI timestamps, without quantising the uploaded performance.
 mono=pcm.mean(axis=1);hop=32;fft=256
 windows=np.lib.stride_tricks.sliding_window_view(np.pad(mono,(0,fft)),fft)[::hop]
 spectrum=np.abs(np.fft.rfft(windows*np.hanning(fft),axis=1));band=np.log1p(spectrum[:,8:105]*20)
 flux=np.maximum(0,np.diff(band,axis=0,prepend=band[:1])).sum(axis=1)
 peaks=(flux==maximum_filter1d(flux,size=9))&(flux>max(.015,float(flux.max())*.045))
 times=(np.flatnonzero(peaks)*hop+fft/2)/32000
 for at,note,velocity in notes:
  if note not in [38,40] or velocity<84:continue
  expected=at*round(32000*60/loop['bpm'])/32000
  distance=float(np.min(np.abs(times-expected)))
  # A simultaneous kick or a long ringing snare can mask a small flam attack.
  assert distance<.04,(loop['title'],at,distance)
  worst=max(worst,distance);checked+=1
print(json.dumps({'audioFiles':len(report['loops']),'midiTimingAndVelocitiesPreserved':True,'nativeTemposVerified':True,'snareAttacksChecked':checked,'largestMeasuredSnareOffsetMs':round(worst*1000,2),'finiteAudio':True,'loopEdgesChecked':True}))
