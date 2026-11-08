"""Attach exact prior reference fields for safe migration of device-only edits."""
from pathlib import Path
from copy import deepcopy
import argparse
import json

FIELDS=('title','artist','key','sections','notes','source')

def read(path):
    raw=Path(path).read_text()
    return json.loads(raw[raw.index('=')+1:].rstrip(';\r\n '))

def attach(old, new):
    before={song['id']:song for song in old['songs']}
    ids=[song['id'] for song in new['songs']]
    if len(ids)!=len(set(ids)):
        raise ValueError('New catalogue contains duplicate song IDs')
    if not set(before).issubset(ids):
        raise ValueError('New catalogue removes an existing song ID')
    changed=0
    for song in new['songs']:
        prior=before.get(song['id'])
        if prior and any(song.get(field)!=prior.get(field) for field in FIELDS):
            previous={'version':old.get('version','RC215')}
            for field in FIELDS:
                if field in prior: previous[field]=deepcopy(prior[field])
            song['previousReference']=previous
            changed+=1
    return changed

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('baseline');p.add_argument('candidate');p.add_argument('output')
    a=p.parse_args()
    old,new=read(a.baseline),read(a.candidate)
    changed=attach(old,new)
    Path(a.output).write_text('window.BassSongReferenceData='+json.dumps(new,ensure_ascii=False,separators=(',',':'))+';\n')
    print(json.dumps({'songs':len(new['songs']),'reference_baselines_added':changed}))
