"""Prepare the owner's supplied recordings as complete, beat-aligned 8-bar loops.

Usage: python3 scripts/prepare_supplied_drums_rc294.py INPUT_DIRECTORY
Requires ffmpeg, numpy and scipy. Source archives stay outside the repository.
"""
from pathlib import Path
import sys, re, json, subprocess, hashlib
import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'audio/drums-rc294'
OUT.mkdir(parents=True, exist_ok=True)
RATE = 44100

def decode(path, rate, seconds=None):
    args = ['ffmpeg','-v','error','-i',str(path),'-vn']
    if seconds: args += ['-t',str(seconds)]
    raw = subprocess.check_output(args+['-ar',str(rate),'-ac','2','-f','f32le','-'])
    return np.frombuffer(raw,dtype='<f4').reshape(-1,2).copy()

def envelope(y, rate=11025):
    mono=y.mean(axis=1)
    hop=64
    _,_,z=signal.stft(mono,fs=rate,nperseg=512,noverlap=512-hop,boundary='zeros')
    mag=np.abs(z)
    flux=np.maximum(0,np.diff(mag,axis=1,prepend=mag[:,:1]))
    allflux=flux.sum(axis=0)
    lowflux=flux[:9].sum(axis=0)
    return allflux,lowflux,rate/hop

def analyse(path, label):
    y=decode(path,11025,100)
    env,low,hz=envelope(y)
    # Analyse the steady interior, avoiding title/count-in and fade-out sections.
    lo=12 if len(y)/11025>55 else 2
    end=min(len(y)/11025-2,95)
    if label is None:
        clip=env[int(lo*hz):int(end*hz)]
        corr=signal.correlate(clip-clip.mean(),clip-clip.mean(),method='fft')[len(clip)-1:]
        candidates=np.arange(70,161,.05)
        def value(bpm):
            lag=60/bpm*hz
            return sum(np.interp(lag*i,np.arange(len(corr)),corr)/i for i in [1,2,4,8])
        label=float(max(candidates,key=value))
        label=round(label,2)
    beat=60/label
    # Select a quarter-note phase and bar phase using low-frequency attacks.
    # Offbeats retain their original position; audio is not quantised.
    times=np.arange(lo,end-32*beat,beat/16)
    if not len(times): times=np.arange(0,max(.001,end-32*beat),.002)
    def score(t):
        ix=(t+np.arange(64)*beat/2)*hz
        valid=ix<len(env)
        energy=np.interp(ix[valid],np.arange(len(env)),env)
        kick=np.interp(ix[valid],np.arange(len(low)),low)
        # The same phrase should recur one bar later.
        later=np.interp(ix[valid]+4*beat*hz,np.arange(len(env)),env)
        similarity=np.dot(energy,later)/(np.linalg.norm(energy)*np.linalg.norm(later)+1e-12)
        down=kick[::8].sum()+.35*kick[4::8].sum()
        return (energy.sum()+2*down)*(0.5+similarity)
    first=max(times,key=score)
    # Refine spectral frame placement to 1 ms, including the attack's onset.
    refined=np.arange(max(0,first-beat/16),first+beat/16,.001)
    first=float(max(refined,key=score))
    # Flux is centred on the start of the attack. Include 3 ms of its leading edge.
    first=max(0,first-.003)
    return label,first

def genre(name):
    n=name.lower()
    for value,pattern in [('soul','neo soul|rnb'),('soca','soca'),('zouk','zouk'),('soukous','soukous|seben'),('makossa','makossa'),('highlife','highlife'),('afrobeat','afrobeat|afrotrap|afropop|amapiano'),('reggae','reggae'),('funk','funk|70s'),('rock','rock'),('worship','worship|ballad')]:
        if re.search(pattern,n): return value
    return 'praise'

samples=[]
for path in sorted(Path(sys.argv[1]).rglob('*')):
    if path.suffix.lower() not in ['.wav','.mp3','.mp4'] or 'Twenty Snare' in path.name: continue
    native=path.suffix.lower()=='.wav'
    g=genre(path.name)
    match=re.search(r'(\d+(?:\.\d+)?)\s*bpm|bpm\D*(\d+(?:\.\d+)?)',path.stem,re.I)
    labelled=float(next(v for v in match.groups() if v)) if match else None
    if native:
        pcm=decode(path,RATE)
        bpm=labelled or 32*60*RATE/len(pcm)
        first=0
    else:
        bpm,first=analyse(path,labelled)
        full=decode(path,RATE,first+32*60/bpm+.2)
        start=round(first*RATE)
        pcm=full[start:start+round(32*60/bpm*RATE)].copy()
    expected=round(32*60/bpm*RATE)
    if len(pcm)<expected: pcm=np.pad(pcm,((0,expected-len(pcm)),(0,0)))
    pcm=pcm[:expected]
    pcm-=pcm.mean(axis=0)
    peak=float(np.abs(pcm).max())
    if peak<.001: raise ValueError('Silent recording: '+path.name)
    pcm*=.8/peak
    # Repair only a sub-millisecond endpoint discontinuity; no time is removed.
    fade=44
    delta=pcm[0]-pcm[-1]
    pcm[-fade:]+=np.linspace(0,1,fade)[:,None]*delta
    digest=hashlib.sha256(path.name.encode()).hexdigest()[:10]
    ident=('correct-' if native else 'supplied-')+g+'-'+digest
    file=ident+'.flac'
    p=subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(RATE),'-ac','2','-i','-','-c:a','flac','-sample_fmt','s16',str(OUT/file)],input=pcm.astype('<f4').tobytes(),check=True)
    short=re.sub(r'(?i)^Y2Mate\.is\s*-\s*','',path.stem)
    short=re.sub(r'(?i)_B6.*|_Premium.*','',short).replace('_',' ')
    short=re.sub(r'(?i)free for profit|free drums loop\s*-?|free download|practice tool|backing track|drum kit only|drum metronome loop|for practice','',short)
    short=re.sub(r'(?i)\s*(\d+(?:\.\d+)?)\s*bpm|bpm\D*\d+(?:\.\d+)?','',short)
    short=re.sub(r'\s+',' ',short).strip(' -')
    samples.append(dict(id=ident,file=file,url='./audio/drums-rc294/'+file,title=short,bpm=bpm,beats=32,frames=expected,sampleRate=RATE,genre=g,sourceName=path.name,sourceStart=first,tempoSource='filename' if labelled else '8-bar duration' if native else 'estimated',automaticDefault=bool(labelled or native) and g!='worship'))
    print(len(samples),short,round(bpm,3),round(first,3),flush=True)
manifest=dict(version='RC294',samples=samples,excluded=['Twenty Snare Drums in Two Minutes: demonstration, not a continuous beat'])
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(ROOT/'ear-source/drum-loops-data-rc294.js').write_text('/* Owner-supplied drum recordings and source tempo metadata. */\nwindow.BassDrumLoops='+json.dumps(samples,separators=(',',':'))+';\n')
print('Prepared',len(samples),'loops')
