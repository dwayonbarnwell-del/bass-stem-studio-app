"""Release gates for source preservation and independently checked number values."""
import argparse
import json
from pathlib import Path
import re


def read(path):
    raw = Path(path).read_text()
    return json.loads(raw[raw.index('=') + 1:].rstrip(';\r\n '))


parser = argparse.ArgumentParser()
parser.add_argument('--baseline', type=Path, required=True)
parser.add_argument('--candidate', type=Path,
                    default=Path(__file__).resolve().parents[1] / 'song-reference/data.js')
parser.add_argument('--entries', type=Path, required=True)
args = parser.parse_args()
before, data = read(args.baseline), read(args.candidate)
entries = json.loads(args.entries.read_text())
old = {song['id']: song for song in before['songs']}
new = {song['id']: song for song in data['songs']}
assert before['version'] == 'RC215' and data['version'] == 'RC216'
assert len(new) == len(data['songs']) == 899
assert set(old).issubset(new)
assert sum(any(section.get('chords', '').strip() for section in song.get('sections', []))
           for song in data['songs']) == 559
for sid, original in old.items():
    current = new[sid]
    assert [s for s in original.get('sections', []) if s.get('source') != 'user'] == [
        s for s in current.get('sections', []) if s.get('source') != 'user'], sid
    fields = ('title', 'artist', 'key', 'sections', 'notes', 'source')
    if any(original.get(field) != current.get(field) for field in fields):
        expected = {'version': 'RC215', **{field: original[field] for field in fields if field in original}}
        assert current['previousReference'] == expected, ('migration baseline', sid)
    archive = current.get('previousImport')
    if archive:
        for field in ('notes', 'sections', 'title', 'artist'):
            if field in archive:
                assert archive[field] == original.get(field), ('original archive', sid, field)

assert len(entries) == 558 and sum(len(entry['rows']) for entry in entries) == 2742
for entry in entries:
    records = [record for song in data['songs']
               for record in song.get('documentImport', {}).get('entries', [])
               if record['headingNumber'] == entry['n']]
    assert records, entry['n']
    source_lines = [row['text'] for row in entry['rows']]
    assert all(record['originalLines'] == source_lines for record in records), entry['n']
    assert {p for record in records for p in record['paragraphs']} == {
        row['i'] for row in entry['rows']}, entry['n']

modern = [song for song in data['songs']
          if 'Modern Christian songs 2002–2026' in song.get('collections', [])]
assert len(modern) == 11 and sum(len(song['sections']) for song in modern) == 18
natural = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
major = [0, 2, 4, 5, 7, 9, 11]


def pitch(note):
    return (natural[note[0]] + note.count('#') - note.count('b')) % 12


def numeric_pitch(number, key):
    match = re.fullmatch(r'([b#]?)([1-7])', number)
    assert match, number
    return (key + major[int(match[2]) - 1] + (1 if match[1] == '#' else -1 if match[1] == 'b' else 0)) % 12


converted = 0
for song in modern:
    source = song['source']
    assert source['licence'] == 'CC0 1.0'
    assert source['licenceUrl'] == 'https://creativecommons.org/publicdomain/zero/1.0/'
    assert all(2002 <= source[field] <= 2026 for field in ('wordsYear', 'musicYear'))
    assert source['url'].startswith('https://ryancornett.com/')
    assert source.get('chartUrl') and source.get('sectionNote')
    for section in song['sections']:
        letters, numbers = section['letterChords'].split(), section['chords'].split()
        assert len(letters) == len(numbers), song['title']
        key = pitch(section['sourceKey'])
        for letter, number in zip(letters, numbers):
            original = re.fullmatch(r'([A-G][b#]?)([^/]*)(?:/([A-G][b#]?))?', letter)
            degree = re.fullmatch(r'([b#]?[1-7])([^/]*)(?:/([b#]?[1-7]))?', number)
            assert original and degree, (letter, number)
            assert pitch(original[1]) == numeric_pitch(degree[1], key), (letter, number)
            # Parentheses distinguish a chord extension from another scale degree.
            assert original[2] == degree[2].replace('(', '').replace(')', ''), (letter, number)
            assert bool(original[3]) == bool(degree[3]), (letter, number)
            if original[3]:
                assert pitch(original[3]) == numeric_pitch(degree[3], key), (letter, number)
            converted += 1
rest = next(song for song in modern if song['title'] == 'There Is Rest')
assert [section['part'] for section in rest['sections']] == ['Verse', 'Pre-chorus', 'Chorus', 'Final chorus', 'Tag']
assert rest['sections'][2]['chords'] != rest['sections'][3]['chords']
print(json.dumps({'result': 'pass', 'stableExistingIds': len(old),
                  'sourceHeadings': len(entries), 'sourceBodyParagraphs': 2742,
                  'totalSongs': 899, 'withProgressions': 559, 'needsProgression': 340,
                  'modernSongs': len(modern), 'numberedChordsChecked': converted}))
