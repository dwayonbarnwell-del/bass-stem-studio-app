#!/usr/bin/env python3
"""Combine the reviewed RC216 imports and attach safe RC215 edit baselines.

Inputs are the unchanged RC215 catalogue, the output of
reconcile_progressions_rc216.py, and the reviewed CC0 source file. Existing
entries are never renumbered. Run this once on the personal-import candidate.
"""
import argparse
from copy import deepcopy
import json
from pathlib import Path

from reference_baseline import attach, read


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--personal', type=Path, required=True)
    parser.add_argument('--open-songs', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    baseline, data = read(args.baseline), read(args.personal)
    additions = json.loads(args.open_songs.read_text())
    if baseline.get('version') != 'RC215' or data.get('version') != 'RC216':
        raise ValueError('This release requires RC215 and the reviewed RC216 personal import')
    if len(data['songs']) != 888 or len(additions) != 11:
        raise ValueError('Unexpected input catalogue sizes; review before combining')
    identities = {(song['title'].casefold(), song.get('artist', '').casefold())
                  for song in data['songs']}
    next_id = max(song['id'] for song in data['songs']) + 1
    for original in additions:
        song = deepcopy(original)
        identity = (song['title'].casefold(), song.get('artist', '').casefold())
        if identity in identities:
            raise ValueError('Duplicate source identity: ' + song['title'])
        source = song.get('source', {})
        if source.get('licence') != 'CC0 1.0':
            raise ValueError('Missing reviewed CC0 permission: ' + song['title'])
        if not all(2002 <= source.get(field, 0) <= 2026
                   for field in ('wordsYear', 'musicYear')):
            raise ValueError('Source dates outside the requested period')
        if not song.get('sections') or not all(section.get('chords', '').strip()
                                               for section in song['sections']):
            raise ValueError('Missing numbered source section: ' + song['title'])
        song['id'] = next_id
        next_id += 1
        identities.add(identity)
        data['songs'].append(song)
    has = lambda song: any(section.get('chords', '').strip()
                           for section in song.get('sections', []))
    total = len(data['songs'])
    progressions = sum(has(song) for song in data['songs'])
    stats = data['stats']
    stats.update({
        'total': total, 'entries': total,
        'additional': total - stats['userList'],
        'withSectionChords': progressions, 'sectionProgressions': progressions,
        'needsProgression': total - progressions,
        'openlyLicensedModernSongs': len(additions),
        'openlyLicensedModernSections': sum(len(song['sections']) for song in additions),
        'openlyLicensedModernPeriod': '2002–2026',
    })
    # Historical acquisition counters from earlier releases remain intact.
    # These explicit release counts describe the current catalogue.
    baselines = attach(baseline, data)
    args.output.write_text('window.BassSongReferenceData=' + json.dumps(
        data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print(json.dumps({'version': data['version'], 'songs': total,
                      'withProgressions': progressions,
                      'needsProgression': total - progressions,
                      'modernSongsAdded': len(additions),
                      'previousReferenceSnapshots': baselines}))


if __name__ == '__main__':
    main()
