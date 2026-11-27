"""Check every new source mix, drum loop and the duplicate comparison maths."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import json,sys
import numpy as np,soundfile as sf
from scipy.signal import resample_poly

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import prepare_cultural_uploads_rc352 as pipeline
def data(name):return json.loads(Path('ear-source/cultural-recordings-rc352.js').read_text().split('window.'+name+'=')[1].split(';\n')[0])
rows=data('BassCulturalUploads');mixes=data('BassCulturalMixes');drums=data('BassCulturalDrums')
def check(row):
 asset=mixes[row['audio']];pcm,rate=sf.read(asset['url'],dtype='float32',always_2d=True)
 assert rate==32000 and pcm.shape==(asset['frames'],6) and asset['channels']==6,row['id']
 assert np.isfinite(pcm).all() and np.abs(pcm).max()<=.951,row['id']
 assert np.max(np.abs(pcm[0]-pcm[-1]))<.0001,(row['id'],'Loop seam')
 original,source_rate=sf.read(row['audio'],dtype='float32',always_2d=True)
 reference=resample_poly(original,32000,source_rate,axis=0)*asset['scale'];mixed=pcm[:,:2]+pcm[:,2:4]+pcm[:,4:6];count=min(len(mixed),len(reference))-32
 error=float(np.sqrt(np.mean((mixed[:count]-reference[:count])**2)))/max(.001,float(np.sqrt(np.mean(reference[:count]**2))))
 assert abs(len(mixed)-len(reference))<64 and error<.16,(row['id'],error)
 assert .001<asset['bassRms'] and .001<asset['otherRms'] and asset['estimated'],row['id']
 assert 40<=row['originalBpm']<=220,(row['id'],row['originalBpm'])
 return error
with ThreadPoolExecutor(max_workers=2)as pool:errors=list(pool.map(check,rows))
for row in drums:
 pcm,rate=sf.read(row['url'],dtype='float32',always_2d=True)
 peak_limit=.95 if row.get('recreated') else .851
 join_limit=.012 if row.get('recreated') else .0001
 assert rate==32000 and pcm.shape[1]==2 and np.isfinite(pcm).all() and np.abs(pcm).max()<=peak_limit,row['id']
 assert np.max(np.abs(pcm[0]-pcm[-1]))<join_limit and np.sqrt(np.mean(pcm**2))>.001,row['id']
 assert 40<=row['bpm']<=220 and abs(len(pcm)/rate-60*row['beats']/row['bpm'])<.001,row['id']
# The normalised similarity is bounded by one and scores matching frames,
# rather than accidentally summing over an entire phrase.
original=pipeline.audio_fingerprint
try:
 a=np.zeros((12,128));a[0]=1;b=np.zeros_like(a);b[5]=1
 pipeline.audio_fingerprint=lambda row:row['fingerprint']
 row=lambda value:dict(genre='woro',notes=[dict(midi=36)],fingerprint=value)
 assert abs(pipeline.similar(row(a),row(a))-1)<1e-8
 assert pipeline.similar(row(a),row(b))==0
finally:pipeline.audio_fingerprint=original
assert len(rows)==45 and len(drums)==48
assert {d["sourceClip"] for d in drums if d.get("recreated")}=={r["id"] for r in rows}
assert sum(d.get("instrumentalRecording", False) for d in drums if d["genre"]=="ariaria")==3
print(json.dumps(dict(passed=True,sourceMixes=len(rows),sourceDrumLoops=len(drums),allSixChannelsValid=True,continuousJoins=True,largestRelativeReconstructionError=round(max(errors),5),duplicateMathChecked=True)))
