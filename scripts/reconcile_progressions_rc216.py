#!/usr/bin/env python3
"""Reconcile the user's structured alphabetical notes with the RC215 catalogue.

All source paragraphs are retained verbatim. Number strings are extracted,
never reharmonised. Only explicit labels or documented source corrections are
used. Existing catalogue IDs and external reference sections are preserved.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from zipfile import ZipFile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
SOURCE_NAME = 'Song_Progressions_Alphabetical.docx'
SOURCE_SHA256 = '3f11035ee976a4a6259fa435a1fdf0d156cde2e6f0fc0c44ad269b60dc64b964'

# Explicitly reviewed mappings. No fuzzy matching is used to write the data.
# Values retain an existing ID; reasons describe source matching, not a new
# claim that the user's arrangement has been checked against a recording.
ALIASES = {
    1: (1, 'Same title with the existing artist appended'),
    13: (13, 'Same opening cue and following For he is worthy / No man lines'),
    15: (13, 'Expanded title cue; this heading has no progression'),
    18: (16, 'Exact earlier notes heading; final repetition count retained'),
    33: (29, 'Because He Lives refrain cue I can face tomorrow'),
    46: (3, 'Exact earlier notes heading'),
    83: (78, 'Exact earlier notes heading'),
    84: (78, 'Same title with o/oh spelling variant'),
    92: (86, 'Exact main title and I enter the Holies cue'),
    94: (87, 'Same title with the existing artist appended'),
    96: (457, 'Official artist recording identifies Worthy of My Praise'),
    108: (98, 'Same title with the existing artist appended'),
    128: (118, 'Same heading with a final repetition count'),
    130: (341, 'Promises title and Great is your faithfulness subtitle'),
    131: (120, 'Same title with numbers embedded in the heading'),
    138: (414, 'Exact subtitle It is the sound of victory'),
    153: (98, 'Exact earlier notes heading'),
    166: (157, 'Same title with numbers embedded in the heading'),
    167: (158, 'Same title with numbers embedded in the heading'),
    191: (174, 'Singular/plural spelling of the same source title'),
    192: (174, 'Exact earlier notes heading'),
    198: (86, 'I Enter the Holy of Holies subtitle and same supplied cues'),
    220: (202, 'Lift/life spelling and same I will joyfully sing subtitle'),
    224: (278, 'Exact existing subtitle'),
    230: (210, 'Same title with numbers embedded in the heading'),
    231: (212, 'Same title with a key appended'),
    247: (224, 'Same title and explicit Ecclessia medley attribution'),
    248: (224, 'Expanded title cue from the same personal song notes'),
    254: (231, 'Exact earlier notes heading'),
    261: (242, 'Jesu/Jesus spelling and explicit Fearless subtitle'),
    263: (240, 'Exact earlier notes heading'),
    302: (281, 'Miracle Worker and We believe in your power subtitle'),
    308: (133, 'Same Hallelujah My God Reigns words in reversed order'),
    311: (289, 'Exact earlier notes heading'),
    332: (309, 'Obinasom title cue preserved with the original spelling'),
    340: (354, 'Sing for Joy title with Oh prefix'),
    341: (354, 'Sing for Joy opening cue to God our strength'),
    344: (319, 'Exact earlier note cues I know he loves me; distinct from Judikay entry'),
    349: (324, 'Exact Only You Can Do subtitle cue'),
    350: (324, 'Expanded Only You Can Do subtitle cue'),
    351: (324, 'Explicit Only You Jesus title in the heading'),
    363: (336, 'Exact Praise the Lord O My Soul subtitle'),
    376: (349, 'Saviour and The man you saved cue'),
    378: (309, 'Exact See the Way You Love Me subtitle'),
    401: (438, 'Exact refrain repeated in source heading 472'),
    424: (393, 'Repeated opening words of the same source title'),
    433: (464, 'Explicit Yahweh Sabaoth cue beneath the mnemonic heading'),
    438: (408, 'Exact literal title Trust & Obey, preserving separate existing hymn ID541'),
    439: (409, 'Same Under the Canopy and Your Love Has Taken title cue'),
    446: (416, 'Way Maker title with You Are Here cue'),
    450: (420, 'Explicit existing Ebube Dike subtitle'),
    451: (92, 'Exact earlier notes heading; do not merge catalogue IDs'),
    455: (423, 'Same title with the complete numbers in the heading'),
    458: (426, 'Same title with the existing artist appended'),
    459: (426, 'We lift our hands in the sanctuary cue'),
    463: (429, 'Same title with the existing artist appended'),
    472: (438, 'Exact main title plus supplied Thank you Lord refrain'),
    475: (440, 'Exact existing When the Glory Comes subtitle'),
    476: (442, 'Exact earlier notes heading'),
    477: (442, 'Same When the Spirit of the Lord title and dance like David cue'),
    493: (457, 'Same title with the existing artist appended'),
    496: (460, 'Exact earlier notes heading including the number'),
    507: (469, 'Same Almighty God refrain cue; original variant retained'),
    508: (469, 'Exact earlier notes heading'),
    511: (471, 'Exact main title with Mighty God refrain cue'),
    514: (473, 'Same title words with original ordering retained as alias'),
    546: (272, 'Exact earlier notes heading and You Move Mountains subtitle'),
    548: (258, 'Explicit Kadosh repeated title cue'),
    552: (409, 'Exact Your Love Has Taken Over subtitle'),
}

# Numbers which were accidentally placed in the source heading. They are
# moved into the number view but remain unchanged in the source provenance.
HEADING_NUMBERS = {
    13: '1 3 4', 131: '1 4 1 x', 166: '1 5 6 4 5',
    167: '1 4, 1 5, 1 2 5 1', 230: '2 1 5 6, 1',
    455: '1 4 6 5', 496: '6',
}

SOURCE_METADATA = {
    457: {
        'name': 'Dunsin Oyekan official recording',
        'url': 'https://www.youtube.com/watch?v=lrdmnAn9gxk',
        'purpose': 'Song title and artist only; the progressions remain the user\'s notes.',
    },
    375: {
        'name': 'MultiTracks licensed recording details',
        'url': 'https://www.multitracks.com/songs/All-Nations-Music/Come-Alive/That-Great-Name/overview/',
        'purpose': 'Song identity, artist and section names only; numbers are from the user.',
    },
    547: {
        'name': 'Worship Together publisher song page',
        'url': 'https://www.worshiptogether.com/songs/firm-foundation-he-wont-cody-carnes/',
        'purpose': 'Confirms Firm Foundation (He Won\'t) title, artist and opening cue; numbers are from the user.',
    },
}

def normalise(s):
    s = unicodedata.normalize('NFKD', str(s)).lower().replace('&', 'and')
    return re.sub(r'[^a-z0-9]', '', s)

def read_doc(path):
    with ZipFile(path) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    body = root.find(W + 'body')
    entries = []
    paragraphs = []
    for i, p in enumerate(body.findall(W + 'p')):
        style_el = p.find(f'{W}pPr/{W}pStyle')
        style = style_el.get(W + 'val', '') if style_el is not None else ''
        parts = []
        for el in p.iter():
            if el.tag == W + 't': parts.append(el.text or '')
            elif el.tag == W + 'tab': parts.append('\t')
            elif el.tag in (W + 'br', W + 'cr'): parts.append('\n')
        row = {'i': i, 'style': style, 'text': ''.join(parts)}
        paragraphs.append(row)
        if style == 'SongHeading':
            entries.append({'n': len(entries) + 1, 'title': row['text'],
                            'paragraph': i, 'rows': []})
        elif entries:
            entries[-1]['rows'].append(row)
    return entries, paragraphs

LABEL = r'(?:pre[ -]?(?:chorus|ch)|turn[ -]?around(?: for bass)?|instrumental|interlude|intro|outro|ending|bridge|chorus|verse|bri|vr|ch|run|tag)'
LABEL_START = re.compile(r'^\s*[\[*•]*\s*(' + LABEL + r')(?=$|[\s.\]:/&-])', re.I)
LABEL_SECOND = re.compile(r'^\s*(?:[./&]|and|to)?\s*(' + LABEL + r')(?=$|[\s.\]:/&-])', re.I)
PART_NAMES = {'vr':'Verse','verse':'Verse','ch':'Chorus','chorus':'Chorus',
              'bri':'Bridge','bridge':'Bridge','intro':'Intro','outro':'Outro',
              'instrumental':'Instrumental','interlude':'Interlude','ending':'Ending',
              'run':'Run','tag':'Tag','turnaround':'Turnaround','turn around':'Turnaround',
              'turn around for bass':'Bass turnaround','pre ch':'Pre-chorus',
              'pre-ch':'Pre-chorus','prech':'Pre-chorus','pre chorus':'Pre-chorus',
              'pre-chorus':'Pre-chorus','prechorus':'Pre-chorus'}

QUALITY = r'(?:maj|min|dim|aug|sus|add|m)[0-9]*(?:b[0-9]+)?'
NUMBER = re.compile(r'(?<![A-Za-z0-9])(?:[#b♯♭]?[0-9]+(?:' + QUALITY + r')?(?:\s+' + QUALITY + r')?(?:/[#b♯♭]?[0-9]+)?(?:[xX×][0-9]*)?\?*)(?![A-Za-z])', re.I)
AMBIGUOUS_NOTATION = re.compile(r'(?<![A-Za-z0-9])(?:[#b♯♭]?[0-9]+[A-Za-z]+[A-Za-z0-9?]*|M[0-9]+(?:dim|aug|sus|add))', re.I)
LETTER_TOKEN = r'[A-G][#b]?(?:m7sus|m7b5|maj13|maj11|maj9|maj7|m13|m11|m9|m7|m6|m|sus2|sus4|sus|add2|add9|dim7|dim|aug|7|9|11|13|6|2|5|M7)?(?:/[A-G][#b]?)?'
LETTER_LINE = re.compile(r'^\s*' + LETTER_TOKEN + r'(?:[\s|,]+' + LETTER_TOKEN + r')*\s*$')
META_LINE = re.compile(r'^\s*(?:Key noted:|Set\s+\d+\b|(?:First|Second|Third|Fourth|Fifth) Session\b|High Praise\b|MID-YEAR\b|Transpose|Transposition|Modulate)', re.I)

def parse_label(text):
    m = LABEL_START.match(text)
    if not m:
        if re.match(r'^Bass for the whole song\b', text, re.I):
            return 'Bass line', text, None
        if re.match(r'^Both\b', text):
            return 'Both', text[4:].lstrip(' .:'), None
        if re.match(r'^Chords?\s*[-:]?', text, re.I):
            mm = re.match(r'^Chords?\s*[-:]?\s*', text, re.I)
            return 'Unlabelled', text[mm.end():], None
        return None, text, None
    raw = m.group(1).lower()
    part = PART_NAMES.get(raw, raw.capitalize())
    rest = text[m.end():]
    # Section numbers are used only in explicit long labels or a number
    # followed by a full stop and a word, never guessed from chord numbers.
    index = None
    im = re.match(r'^\s*(\d+)\s*\]', rest)
    if im:
        index = im.group(1); rest = rest[im.end():]
    else:
        im = re.match(r'^\s*\.?\s*(\d+)\.\s*(?=[A-Za-z])', rest)
        if im:
            index = im.group(1); rest = rest[im.end():]
    if index: part += ' ' + index
    # Combined labels such as Vr. Ch., Vr/Ch and Bri to ch.
    for _ in range(2):
        cleaned = rest.lstrip(' .:]')
        sm = LABEL_SECOND.match(cleaned)
        if not sm: break
        second = PART_NAMES.get(sm.group(1).lower(), sm.group(1).capitalize())
        connector = ' to ' if re.match(r'^\s*to\b', cleaned, re.I) else ' / '
        part += connector + second
        rest = cleaned[sm.end():]
    return part, rest.lstrip(' .:]-–—\t'), index

def split_numbers(text):
    """Return exact numeric tokens and the source's separate reminder words."""
    if META_LINE.match(text): return '', text
    matches = list(NUMBER.finditer(text))
    # An unsupported attached word (e.g. the source's "6my") or M7dim
    # cannot be safely split into a chord and lyric. Keep that complete
    # source line verbatim instead of silently changing the notation.
    residual = NUMBER.sub('', text)
    if AMBIGUOUS_NOTATION.search(residual): return text.strip(), ''
    if not matches: return '', text
    repeats = list(re.finditer(r'(?:\bx|×)\s*[0-9]+\b', text, re.I))
    if all(any(r.start() <= m.start() and r.end() >= m.end() for r in repeats) for m in matches):
        return '', text
    # Ordinal words and metadata timings are not musical scale degrees.
    if not any(re.search('[1-7]', m.group()) for m in matches): return '', text
    def notation_gap(value):
        words = re.findall(r"[^\W\d_]+(?:['’][^\W\d_]+)*", value)
        if all(w.lower() in ('or','x') for w in words): return value
        value = re.sub(r"[^\W\d_]+(?:['’][^\W\d_]+)*",
                       lambda m:m.group() if m.group().lower() in ('or','x') else '', value)
        value = re.sub(r'\(\s*\)', '', value)
        return re.sub(r'\s+', ' ', value)
    pieces = []
    prefix = text[:matches[0].start()]
    pm = re.search(r'[\s([#b♯♭]*$', prefix)
    pieces.append(pm.group() if pm else '')
    for i, match in enumerate(matches):
        if i:
            gap = text[matches[i-1].end():match.start()]
            # Words such as "or" and repetition x are part of the written
            # notation; lyric cues between notes are kept in cue instead.
            # Retain punctuation and repeats even when a reminder word
            # appears between the last note and an x2 instruction.
            pieces.append(notation_gap(gap))
        pieces.append(match.group())
    tail = text[matches[-1].end():]
    pieces.append(notation_gap(tail))
    numbers = ''.join(pieces).strip()
    cue = NUMBER.sub('', text)
    cue = re.sub(r'\b(?:or|x[0-9]*)\b', '', cue, flags=re.I)
    # Punctuation that belonged to the number notation is not a lyric cue.
    cue = re.sub(r'^[\s,;|().\[\]{}+*/#♯♭\-–—…•]+|[\s,;|().\[\]{}+*/#♯♭\-–—…•]+$', '', cue)
    if not re.search(r'[^\W\d_]', cue): cue = ''
    return numbers, cue

NOTE_PC = {'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}
DEGREES = ['1','b2','2','b3','3','4','#4','5','b6','6','b7','7']
LETTER_CAPTURE = re.compile(r'^([A-G][#b]?)(m7sus|m7b5|maj13|maj11|maj9|maj7|m13|m11|m9|m7|m6|m|sus2|sus4|sus|add2|add9|dim7|dim|aug|7|9|11|13|6|2|5|M7)?(?:/([A-G][#b]?))?$')

def letter_numbers(text, key):
    def pc(n): return (NOTE_PC[n[0]] + (1 if n.endswith('#') else -1 if n.endswith('b') else 0)) % 12
    tonic = pc(key)
    out = []
    for token in re.split(r'(\s+|[,|])', text):
        if not token.strip() or token in ',|': out.append(token); continue
        m = LETTER_CAPTURE.fullmatch(token)
        if not m: return None
        suffix = {'7':'(7)','2':'(2)','5':'(5)','6':'(6)','9':'(9)','11':'(11)','13':'(13)','M7':'maj7'}.get(m[2], m[2] or '')
        out.append(DEGREES[(pc(m[1])-tonic)%12] + suffix + ('/'+DEGREES[(pc(m[3])-tonic)%12] if m[3] else ''))
    return ''.join(out)

def parse_sections(entry, rows, force_part=None):
    out = []
    current = None
    key = None
    # The source explicitly modulates to A and the existing linked publisher
    # identifies the initial key as G. Other undeclared keys are not inferred.
    if entry['n'] == 184: key = 'G'
    # The session headings immediately precede these clearly delimited
    # embedded song titles; do not inherit the surrounding song's key.
    if entry['n'] == 122 and rows and rows[0]['i'] == 686: key = 'A'
    if entry['n'] == 171 and rows and rows[0]['i'] == 940: key = 'Eb'
    noted_keys = [re.sub(r'^Key noted:\s*', '', r['text']).strip()
                  for r in rows if r['style'] == 'SongKey']
    if len(set(noted_keys)) == 1 and re.fullmatch(r'[A-G][#b]?', noted_keys[0]):
        key = noted_keys[0]
    def new(part):
        return {'part':part, 'chordLines':[], 'cueLines':[], 'letterLines':[], 'paragraphs':[], 'sourceKey':key}
    def flush():
        nonlocal current
        if current is None: return
        if current['chordLines'] or current['cueLines'] or current['letterLines'] or current['part'] != 'Unlabelled':
            sec = {'part':current['part'], 'chords':'\n'.join(current['chordLines']),
                   'cue':'\n'.join(current['cueLines']), 'source':'user',
                   'confidence':'User notes; not checked against a recording',
                   'document':{'headingNumber':entry['n'], 'title':entry['title'],
                               'paragraphs':current['paragraphs']}}
            if current['letterLines']: sec['letterChords'] = '\n'.join(current['letterLines'])
            if current['sourceKey']: sec['sourceKey'] = current['sourceKey']
            elif current['letterLines']:
                sec['notationNote'] = ('More than one key or an unclear key is noted; confirm the key for these chord names before converting to numbers.'
                                       if noted_keys else 'Key not stated in supplied notes; numbers need key confirmation.')
            if re.search(r'(?<![A-Za-z0-9])[1-7]{2,}(?![0-9])', sec['chords']):
                sec['notationNote'] = 'Compact numbers preserved exactly; check the original spacing.'
            out.append(sec)
        current = None
    # Only the explicit allowlist extracts numbers from headings.
    if entry['n'] in HEADING_NUMBERS and rows == entry['rows']:
        current = new('Unlabelled')
        current['chordLines'].append(HEADING_NUMBERS[entry['n']])
        current['paragraphs'].append(entry['paragraph'])
    for r in rows:
        text = r['text']
        if not text.strip(): continue
        if r['style'] == 'SongKey': continue
        mod = re.match(r'^Modulate to ([A-G][#b]?):\s*(.*)', text)
        if mod:
            flush(); key = mod.group(1); current = new('Modulation')
            current['cueLines'].append('Modulate to ' + key)
            current['paragraphs'].append(r['i'])
            if LETTER_LINE.fullmatch(mod.group(2)):
                current['letterLines'].append(mod.group(2))
                current['chordLines'].append(letter_numbers(mod.group(2), key))
            flush(); current = new('Unlabelled'); continue
        # A chord can explicitly lead into a key change. Retain that chord,
        # but do not reinterpret an ordinal in the instruction as a chord.
        change = re.search(r'\b(?:Modulate|Transpose|Transposition)\b', text, re.I)
        if change:
            leading = re.sub(r'\s+to\s*$', '', text[:change.start()], flags=re.I).strip()
            flush(); current = new('Modulation')
            current['paragraphs'].append(r['i'])
            current['cueLines'].append(text)
            if leading and not re.fullmatch(r'[A-G][#b]?', leading):
                transition, _ = split_numbers(leading)
                if transition: current['chordLines'].append(transition)
            flush()
            destination = re.search(r'\bto\s+([A-G][#b]?)(?=\s|$|:)', text)
            if destination: key = destination.group(1)
            elif re.fullmatch(r'[A-G][#b]?', leading): key = leading
            else: key = None
            continue
        part, remaining, _ = parse_label(text)
        if part is not None:
            flush(); current = new(force_part or part); text = remaining
        elif current is None:
            current = new(force_part or 'Unlabelled')
        current['paragraphs'].append(r['i'])
        if LETTER_LINE.fullmatch(text) and text.strip():
            current['letterLines'].append(text)
            if key:
                converted = letter_numbers(text, key)
                if converted: current['chordLines'].append(converted)
            continue
        numbers, cue = split_numbers(text)
        if numbers: current['chordLines'].append(numbers)
        if cue: current['cueLines'].append(cue)
    flush()
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--baseline', type=Path, required=True)
    ap.add_argument('--document', type=Path, required=True)
    ap.add_argument('--out', type=Path, required=True)
    args = ap.parse_args()
    raw = args.baseline.read_text()
    data = json.loads(raw[raw.index('=')+1:].strip().rstrip(';'))
    if data.get('version') != 'RC215':
        raise ValueError('This reviewed import requires the exact RC215 baseline; review before reusing mappings.')
    if hashlib.sha256(args.document.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError('Source document differs from the reviewed document; do not reuse fixed heading mappings.')
    baseline = deepcopy(data)
    songs = data['songs']; by_id = {s['id']:s for s in songs}
    entries, paragraphs = read_doc(args.document)
    assert len(entries) == 558, 'Different document: review mappings before importing.'
    title_index = defaultdict(list)
    for song in songs: title_index[normalise(song['title'])].append(song['id'])
    groups = defaultdict(list); matches = []; next_id = max(by_id) + 1
    new_entries = []; review = []
    def add_song(title, artist='Not confirmed'):
        nonlocal next_id
        sid = next_id; next_id += 1
        song = {'id':sid, 'title':title, 'artist':artist, 'category':'My worship list',
                'sections':[], 'source':{}}
        songs.append(song); by_id[sid] = song; new_entries.append(sid)
        return sid
    israel_id = None
    hes_able_id = None
    medley_id = None
    for entry in entries:
        n = entry['n']; rows = entry['rows']
        if n == 109:
            hes_able_id = add_song('He’s Able (God is able to do)', 'Recording not specified')
            by_id[hes_able_id]['source'] = {
                'name':'Authorised recording reference',
                'url':'https://music.amazon.com/tracks/B001EBY6OU',
                'note':'The cue identifies He’s Able. Deitrick Haddon and Darwin Hobbs versions exist; your exact recording is not specified. The progressions are your original notes.',
            }
            by_id[hes_able_id]['metadataSources'] = [{
                'name':'Published worship bulletin, CCLI 5103739',
                'url':'https://christunitedfellowship.org/wp-content/uploads/2024/08/20240811-Worship-Bulletin.pdf',
                'purpose':'Song identity only; no external chart is copied.',
            }]
            groups[hes_able_id].append((entry,[r for r in rows if r['i'] <= 591],None))
            groups[99].append((entry,[r for r in rows if r['i'] >= 592],None))
            matches.append({'heading':n,'title':entry['title'],'songIds':[hes_able_id,99],
                            'method':'Separate source-confirmed He’s Able cue from the differently notated God Is Able excerpt'})
            continue
        if n == 122:
            groups[112].append((entry,[r for r in rows if r['i'] < 686],None))
            groups[547].append((entry,[r for r in rows if r['i'] >= 686],None))
            matches.append({'heading':n,'title':entry['title'],'songIds':[112,547],
                            'method':'Explicit embedded Firm Foundation title confirmed by the publisher; session A retained'})
            continue
        if n == 171:
            assert hes_able_id is not None
            medley_id = add_song('High Praise I (untitled notes)', 'Not confirmed')
            # A later return after other songs/session changes is a separate
            # excerpt. Its key must not inherit B from the opening passage.
            groups[153].append((entry,[r for r in rows if 936 <= r['i'] <= 939],None))
            groups[153].append((entry,[r for r in rows if 954 <= r['i'] <= 955],None))
            groups[547].append((entry,[r for r in rows if 940 <= r['i'] <= 948],None))
            groups[hes_able_id].append((entry,[r for r in rows if 949 <= r['i'] <= 953],None))
            groups[medley_id].append((entry,[r for r in rows if r['i'] >= 956],None))
            by_id[medley_id]['source']['note'] = 'Unlabelled session notes preserved separately. Song identity and key are not confirmed.'
            review.append({'heading':n,'songId':medley_id,'title':by_id[medley_id]['title'],
                           'reason':'Unlabelled session or medley; no canonical song or artist assumed'})
            matches.append({'heading':n,'title':entry['title'],'songIds':[153,547,hes_able_id,medley_id],
                            'method':'Explicit embedded titles and session boundaries; unconfirmed medley kept separate'})
            continue
        if n == 23:
            israel_id = add_song('Jesus At The Center', 'Israel & New Breed')
            by_id[israel_id]['source'] = {
                'name':'Integrity Worship',
                'url':'https://integrityworship.com/songs/jesus-at-the-center-israel-and-new-breed/',
                'note':'Publisher confirms the title, artist and Bridge label. These numbers and reminder words are from your original notes, not an imported publisher chart.',
            }
            by_id[israel_id]['metadataSources'] = [deepcopy(by_id[israel_id]['source'])]
            groups[240].append((entry, [r for r in rows if r['i'] < 117], None))
            groups[israel_id].append((entry, [r for r in rows if r['i'] >= 117], 'Bridge'))
            matches.append({'heading':n,'title':entry['title'],'songIds':[240,israel_id],
                            'method':'Explicit publisher-confirmed separation of Eben and Israel versions'})
            continue
        if n == 452:
            # The final excerpt is repeated verbatim beneath heading37, whose
            # existing ID33 deliberately has no guessed artist attribution.
            groups[375].append((entry,[r for r in rows if r['i'] < 2676], None))
            groups[33].append((entry,[r for r in rows if r['i'] >= 2676], None))
            matches.append({'heading':n,'title':entry['title'],'songIds':[375,33],
                            'method':'Source-confirmed That Great Name opening; exact repeated Blessed Be the Name excerpt separated'})
            continue
        if n in ALIASES:
            sid, reason = ALIASES[n]
            assert sid in by_id
            method = 'Reviewed alias: ' + reason
        else:
            possible = title_index.get(normalise(entry['title']), [])
            if len(possible) == 1:
                sid = possible[0]; method = 'Exact normalised title'
            else:
                sid = add_song(entry['title']); method = 'Separate original title; identity not assumed'
                review.append({'heading':n,'songId':sid,'title':entry['title'],
                               'reason':'Song identity or recording requires confirmation'})
        groups[sid].append((entry, rows, None))
        matches.append({'heading':n,'title':entry['title'],'songIds':[sid],'method':method})
    before = {s['id']:s for s in baseline['songs']}
    changed = []; filled = []; deduped = []; no_numbers = []
    for sid, parts in groups.items():
        song = by_id[sid]; old = before.get(sid)
        if old is not None:
            snapshot = {k:deepcopy(old.get(k)) for k in ('title','artist','notes')}
            snapshot['sections'] = deepcopy(old.get('sections', []))
            snapshot['version'] = baseline['version']
            snapshot['reason'] = 'Preserved before document reconciliation.'
            if old.get('previousImport'): snapshot['previousImport'] = deepcopy(old['previousImport'])
            if old.get('otherSectionNotes'): snapshot['otherSectionNotes'] = deepcopy(old['otherSectionNotes'])
            song['previousImport'] = snapshot
        external = [deepcopy(s) for s in song.get('sections', []) if s.get('source') != 'user']
        section_list = []; seen = {}; note_blocks = []; seen_notes = set()
        source_entries = []
        aliases = list(song.get('aliases', []))
        key_notes = []
        for entry, rows, force_part in parts:
            # A containing heading is not a song alias when its body has
            # been split. Preserve that title only in source provenance.
            if rows == entry['rows'] and entry['title'] != song['title'] and entry['title'] not in aliases:
                aliases.append(entry['title'])
            source_entries.append({'headingNumber':entry['n'], 'title':entry['title'],
                                   'headingParagraph':entry['paragraph'],
                                   'paragraphs':[r['i'] for r in rows],
                                   'originalLines':[r['text'] for r in entry['rows']],
                                   'originalParagraphs':[r['i'] for r in entry['rows']],
                                   'selectedLines':[r['text'] for r in rows],
                                   'split':rows != entry['rows']})
            block = [r['text'] for r in rows]
            signature = tuple(block)
            if signature not in seen_notes:
                seen_notes.add(signature)
                note_blocks.append((entry['title'], block))
            for r in rows:
                if r['style'] == 'SongKey' and r['text'] not in key_notes:
                    key_notes.append(r['text'])
            sections = parse_sections(entry, rows, force_part)
            if entry['n'] == 96:
                for sec in sections:
                    sec['part'] = 'Chorus'
                    sec['cue'] = entry['title']
                    sec['sectionLabelSource'] = 'https://selahafrik.com/2024/04/dunsin-oyekan-worthy-of-my-praise/'
            # These section names are supported by the licensed recording's
            # own structure; no third-party chord chart is being copied.
            if entry['n'] == 452 and sid == 375:
                sections = []
                for part, selected, cue in [('Bridge 1',[rows[0]],entry['title']),
                                            ('Tag',rows[1:],'We honour you')]:
                    sec = parse_sections(entry,selected,part)[0]
                    sec['cue'] = cue
                    sec['sectionLabelSource'] = SOURCE_METADATA[375]['url']
                    sections.append(sec)
            if force_part:
                for sec in sections:
                    sec['sectionLabelSource'] = by_id[israel_id]['source']['url']
                    sec['originalSectionLabel'] = 'Ch.'
            for sec in sections:
                key = tuple(sec.get(k,'') for k in ('part','chords','cue','letterChords','sourceKey'))
                if key in seen:
                    previous = section_list[seen[key]]
                    previous.setdefault('alsoFrom', []).append(sec['document'])
                    deduped.append({'songId':sid,'heading':entry['n'],'part':sec['part'],
                                    'reason':'Exact section, numbers, cue, chord names and key duplicate'})
                else:
                    seen[key] = len(section_list); section_list.append(sec)
        # Keep each external reference unchanged and labelled as its source.
        song['sections'] = section_list + external
        if any(s.get('chords','').strip() for s in section_list):
            source_note = song.get('source',{}).get('note','')
            stale = 'No chord progression has been verified or imported yet.'
            if stale in source_note:
                song['source']['note'] = source_note.replace(stale, 'Progressions are supplied in your notes and have not been checked against a recording.')
        lines = []
        for block_number, (heading, block) in enumerate(note_blocks, start=1):
            if len(note_blocks) > 1: lines.append('Original excerpt ' + str(block_number))
            lines.extend(block)
        has_split = any(rows != entry['rows'] for entry, rows, _ in parts)
        song['notes'] = {'heading':song['title'] if has_split else parts[0][0]['title'], 'lines':lines,
                         'type':'Original numbered notes; not checked against a recording'}
        if aliases: song['aliases'] = aliases
        song['documentImport'] = {
            'version':'RC216','source':SOURCE_NAME,
            'sha256':hashlib.sha256(args.document.read_bytes()).hexdigest(),
            'paragraphIndexing':'Zero based; original DOCX body paragraphs',
            'entries':source_entries,
            'keyNotes':key_notes,
            'verification':'User-supplied notes. Title/section evidence does not verify the harmonic arrangement.',
        }
        if sid in SOURCE_METADATA:
            song.setdefault('metadataSources', []).append(deepcopy(SOURCE_METADATA[sid]))
        if sid == 375: song['artist'] = 'All Nations Music'
        if sid == 423: song['title'] = 'We go dey hail'
        if old is not None: changed.append(sid)
        if not old or not any(s.get('chords','').strip() for s in old.get('sections', [])):
            if any(s.get('chords','').strip() for s in song['sections']): filled.append(sid)
        if not any(s.get('chords','').strip() for s in section_list):
            no_numbers.append({'songId':sid,'title':song['title'],
                               'headings':[e['n'] for e,_,_ in parts],
                               'hasLetterChords':any(s.get('letterChords') for s in section_list)})
    data['version'] = 'RC216'
    has = lambda s:any(str(sec.get('chords','')).strip() for sec in s.get('sections', []))
    with_chords = sum(has(s) for s in songs)
    stats = deepcopy(data.get('stats', {}))
    stats.update({'total':len(songs),'entries':len(songs),'withSectionChords':with_chords,
                  'sectionProgressions':with_chords,
                  'withUserNotes':sum(bool(s.get('notes',{}).get('lines')) for s in songs),
                  'withPersonalSectionChords':sum(any(x.get('source')=='user' and x.get('chords','').strip() for x in s.get('sections',[])) for s in songs),
                  'documentHeadingsImported':len(entries),'documentSongsMatched':len(groups),
                  'documentMissingProgressionsFilled':len([x for x in filled if x in before]),
                  'documentNewEntries':len(new_entries),
                  'needsProgression':len(songs)-with_chords})
    data['stats'] = stats
    report = {
        'baselineVersion':baseline['version'],'candidateVersion':data['version'],
        'document':SOURCE_NAME,'documentSha256':hashlib.sha256(args.document.read_bytes()).hexdigest(),
        'sourceHeadings':len(entries),'sourceBodyParagraphs':sum(len(e['rows']) for e in entries),
        'baselineSongs':len(baseline['songs']),'candidateSongs':len(songs),
        'baselineWithProgressions':sum(has(s) for s in baseline['songs']),
        'candidateWithProgressions':with_chords,'candidateNeedsProgression':len(songs)-with_chords,
        'existingSongsReconciled':len(changed),'newEntries':len(new_entries),
        'existingMissingFilled':len([x for x in filled if x in before]),
        'newWithProgressions':len([x for x in filled if x not in before]),
        'filledIds':filled,'newIds':new_entries,'changedIds':changed,
        'exactSectionDuplicatesRemoved':len(deduped),'duplicates':deduped,
        'headingMappings':matches,'identityReview':review,'withoutImportedNumbers':no_numbers,
        'rules':[
            'Existing IDs and every existing catalogue entry retained.',
            'Exact normalised matching plus explicit reviewed alias table; no fuzzy matching.',
            'Every heading and body line retained verbatim in documentImport provenance.',
            'Only supplied section labels or cited metadata corrections used; unlabelled parts stay unlabelled.',
            'Numbers extracted without changing root degree, accidentals, suffixes, order or compact notation.',
            'Reminder words stored in editable cue and preserved verbatim in original notes.',
            'Only identical part, numbers, cue, letter chords and key sections deduplicated.',
            'Replaced previous defaults archived exactly; device edits are handled separately by UI.',
            'External publisher/blog/hymn sections unchanged.'
        ],
    }
    # Lossless provenance and stable IDs are release gates for this import.
    assert len(by_id) == len(songs)
    assert all(s['id'] in by_id for s in baseline['songs'])
    assert set(m['heading'] for m in matches) == set(range(1,559))
    for entry in entries:
        records = [r for s in songs for r in s.get('documentImport',{}).get('entries',[]) if r['headingNumber']==entry['n']]
        assert records and all(r['originalLines']==[x['text']for x in entry['rows']] for r in records)
        covered = set(i for r in records for i in r['paragraphs'])
        assert covered == set(x['i']for x in entry['rows']), (entry['n'],'lost source paragraph')
    for old in baseline['songs']:
        external_before = [s for s in old.get('sections',[]) if s.get('source') != 'user']
        external_after = [s for s in by_id[old['id']].get('sections',[]) if s.get('source') != 'user']
        assert external_before == external_after, (old['id'],'external section changed')
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out/'data.candidate.js').write_text('window.BassSongReferenceData='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
    (args.out/'reconciliation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    (args.out/'document-entries.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n')
    (args.out/'document-paragraphs.json').write_text(json.dumps(paragraphs,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ('sourceHeadings','baselineSongs','candidateSongs','baselineWithProgressions','candidateWithProgressions','candidateNeedsProgression','existingSongsReconciled','newEntries','existingMissingFilled','newWithProgressions','exactSectionDuplicatesRemoved')},indent=2))

if __name__ == '__main__': main()
