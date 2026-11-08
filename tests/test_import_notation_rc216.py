"""Regression checks for literal musical notation lost by the earlier importer."""
import argparse
import importlib.util
import json
from pathlib import Path
import re

ap = argparse.ArgumentParser()
ap.add_argument('--parser', type=Path, required=True)
ap.add_argument('--candidate', type=Path, required=True)
ap.add_argument('--entries', type=Path, required=True)
ap.add_argument('--report', type=Path, required=True)
args = ap.parse_args()
spec = importlib.util.spec_from_file_location('reconcile', args.parser)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

checks = 0
def check(condition, message):
    global checks
    assert condition, message
    checks += 1

cases = [
    ('I worship 6 5Maj7 (1) 4, #5 dim', '6 5Maj7 (1) 4, #5 dim'),
    ('Your Majesty 6 5 (1) 4 x2 (#5 dim)', '6 5 (1) 4 x2 (#5 dim)'),
    ('(1 6Maj 2Maj)', '(1 6Maj 2Maj)'),
    ('2 min, 2 dim', '2 min, 2 dim'),
    ('1M7 2m7 4M7 5sus4 5', '1M7 2m7 4M7 5sus4 5'),
    ('1 5 2m7 4sus2', '1 5 2m7 4sus2'),
    ('1 X4', '1 X4'),
    ('1, 6 5 ×', '1, 6 5 ×'),
    ('1 4/6, depression 7 3 6', '1 4/6,  7 3 6'),
    ('2m?? - please', '2m?? -'),
    ('(4 #4 5 #5 6) 7 1 (5 turn around) x2', '(4 #4 5 #5 6) 7 1 (5 ) x2'),
]
for source, expected in cases:
    actual, cue = mod.split_numbers(source)
    # Whitespace is visual formatting; accidentals, slash bass, qualities,
    # brackets, repeats and question marks must remain unchanged.
    check(re.sub(r'\s+', ' ', actual) == re.sub(r'\s+', ' ', expected),
          f'{source!r} became {actual!r}; expected {expected!r}')
for source in ['(Alleluia) x4', '(Alleluia) x 4', 'Modulate to F on #4 verse', 'Set 3']:
    check(mod.split_numbers(source)[0] == '', 'Instruction became a progression: ' + source)
for source in ['Passing M7dim', '1 my, 6my, 6, 4, 2 help']:
    check(mod.split_numbers(source)[0] == source, 'Ambiguous notation partially rewritten: ' + source)

raw = args.candidate.read_text()
data = json.loads(raw[raw.index('=')+1:].strip().rstrip(';'))
by_id = {s['id']:s for s in data['songs']}
entries = json.loads(args.entries.read_text())
report = json.loads(args.report.read_text())
check(report['sourceHeadings'] == 558, 'Incomplete heading import')
check(report['existingMissingFilled'] == 159, 'Unexpected filled-song count')
check(report['candidateWithProgressions'] == 548, 'Unexpected progression count')
check(by_id[2]['sections'][0]['chords'] == '6 5 6 3, 4 5 6\n6 4 1 5 or 2 4 1 5',
      'Adonai still contains unrelated imported song numbers')
check(len(by_id[10]['sections']) == 1 and by_id[10]['sections'][0]['chords'] == '1 4 5 1',
      'Aka aka ya still contains the Holy of Holies notes')
check(by_id[375]['artist'] == 'All Nations Music', 'Verified artist correction missing')
check(by_id[375]['previousImport']['artist'] == 'Todd Dulaney', 'Earlier credit not recoverable')
check(by_id[454]['sections'][0]['chords'] == '' and by_id[454]['sections'][0]['letterChords'],
      'Unstated Wonderful Merciful Savior key was guessed')
hosanna = by_id[168]['sections']
check([s.get('sourceKey') for s in hosanna] == ['G','A','A'], 'Hosanna key change lost')
check('1/b6' in hosanna[-1]['chords'] and 'A/F ' in hosanna[-1]['letterChords'],
      'Original A/F was silently corrected')
majesty = by_id[509]['sections']
check(majesty[0]['chords'].count('5Maj7') == 4, 'Your Majesty major seventh quality lost')
check('x2 (#5 dim)' in majesty[-2]['chords'], 'Your Majesty repeat/diminished quality lost')
check(majesty[-1]['part'] == 'Modulation' and majesty[-1]['chords'] == ''
      and majesty[-1]['cue'] == 'Modulate to F on #4 verse', 'Ordinal was made into a chord')
check({s.get('sourceKey') for s in by_id[547]['sections'] if s.get('chords')} == {'A','Eb'},
      'Firm Foundation session variants were lost or given the surrounding song key')
check(all(s.get('document',{}).get('paragraphs',[]) != list(range(941,949))
          for s in by_id[153]['sections']), 'Firm Foundation remains in Heaven on Earth')
check(not any('Christ is my firm foundation' in s.get('cue','') for s in by_id[112]['sections']),
      'Good Good Father still contains Firm Foundation sections')
check(by_id[547]['notes']['heading'] == by_id[547]['title'], 'Containing title used as Firm Foundation heading')
check(not ({'Good Good Father','Heaven on Earth'} & set(by_id[547].get('aliases',[]))),
      'Containing titles used as Firm Foundation aliases')
check('Good Good Father' not in by_id[547]['notes']['lines'] and 'Heaven on Earth' not in by_id[547]['notes']['lines'],
      'Unlabelled containing titles leaked into active excerpt notes')
heaven_later = [s for s in by_id[153]['sections'] if 955 in s.get('document',{}).get('paragraphs',[])]
check(len(heaven_later) == 1 and not heaven_later[0].get('sourceKey'),
      'Opening Heaven on Earth key inherited after intervening songs and session change')
check(all(939 not in s.get('document',{}).get('paragraphs',[]) for s in heaven_later),
      'Separated Heaven on Earth excerpts were recombined')
hes_able = next(s for s in data['songs'] if s['title'] == 'He’s Able (God is able to do)')
check({p for e in hes_able['documentImport']['entries'] for p in e['paragraphs']} == set(range(588,592)) | set(range(949,954)),
      'Heading109 or heading171 He’s Able source split missing')
check(hes_able['notes']['heading'] == hes_able['title'] and 'Heaven on Earth' not in hes_able.get('aliases',[]),
      'Containing title used for He’s Able active identity')

# Independently scan the original rows for exact high-risk quality, slash and
# repeat spellings. Each must survive in a section sourced to that paragraph.
quality = re.compile(r'(?<![A-Za-z0-9])(?:[#b♯♭]?[1-7](?:\s*(?:Maj|min|dim|aug|add|sus|M|m)(?:[0-9]+)?)|[#b♯♭]?[1-7]/[#b♯♭]?[1-7])(?![A-Za-z0-9])', re.I)
repetition = re.compile(r'(?<![A-Za-z])(?:[xX×]\s*[0-9]+)')
sections_by_paragraph = {}
for song in data['songs']:
    for section in song.get('sections', []):
        docs = [section.get('document', {})] + section.get('alsoFrom', [])
        for doc in docs:
            for p in doc.get('paragraphs', []):
                sections_by_paragraph.setdefault(p, []).append(section)
scanned = 0
for entry in entries:
    for row in entry['rows']:
        source = row['text']
        if row['style'] == 'SongKey' or mod.LETTER_LINE.fullmatch(source) or re.search(r'\b(?:modulat|transpos)', source, re.I):
            continue
        _, remainder, _ = mod.parse_label(source)
        if not mod.NUMBER.search(remainder): continue
        tokens = [m.group() for m in quality.finditer(remainder)]
        tokens += [m.group() for m in repetition.finditer(remainder)]
        for token in tokens:
            visible = '\n'.join(s.get('chords','') for s in sections_by_paragraph.get(row['i'], []))
            check(token in visible, f'Source notation {token!r} lost in heading {entry["n"]}, paragraph {row["i"]}')
            scanned += 1

print(json.dumps({'passed':checks,'failed':0,'sourceNotationTokensChecked':scanned,
                  'headingCount':558,'candidateWithProgressions':548}))
