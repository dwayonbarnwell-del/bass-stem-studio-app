"""Select distinct uploaded MIDI grooves and render complete, circular drum loops.

Input is the extracted Fl Loops.rar directory. Requires mido, NumPy, SciPy,
ffmpeg, libfluidsynth and GeneralUser GS 2.0.3 (already credited in this repo).
The owner's MIDI timing, velocities and embedded tempo are retained.
"""
from pathlib import Path
import argparse, ctypes as ct, ctypes.util, hashlib, json, math, re, shutil, subprocess
from collections import Counter
import mido
import numpy as np

RATE = 32000
FONT_SHA256 = '9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe'
MAIN = {'worship', 'gospel', 'praise', 'soul', 'jazz', 'blues', 'fusion'}
PREFER = {
 'worship': ['Funk Loops', 'Hiphop Loops', 'Pop Loops', 'Rock Loops'],
 'soul': ['Funk Loops', 'Hiphop Loops', 'Pop Loops', 'Trip Hop Loops', 'Breakbeat Loops'],
 'gospel': ['Funk Loops', 'Pop Loops', 'Rock Loops', 'Breakbeat Loops', 'Hiphop Loops'],
 'praise': ['Funk Loops', 'Pop Loops', 'Rock Loops', 'Breakbeat Loops'],
 'jazz': ['Jazz Loops'], 'blues': ['Jazz Loops', 'Country Loops'], 'fusion': ['Funk Loops', 'Hiphop Loops', 'Breakbeat Loops'],
}
RANGE = {'worship': (85, 115), 'soul': (80, 125), 'gospel': (90, 145), 'praise': (112, 155), 'jazz': (75, 150), 'blues': (75, 160), 'fusion': (85, 140)}

def family(note):
 if note in [35, 36]: return 0
 if note in [37, 38, 39, 40]: return 1
 if note in [42, 44, 46, 51, 53, 59]: return 2
 if note in [41, 43, 45, 47, 48, 50]: return 3
 return note

def fingerprint(notes, beats):
 # Ignore velocity, crash accents and alternate kit voices when checking repeats.
 hits = {(round(at * 24), family(note)) for at, note, vel in notes if note not in [49, 52, 55, 57]}
 for period in [4, 8]:
  if beats <= period: break
  base = {(at, note) for at, note in hits if at < period * 24}
  if all((at % (period * 24), note) in base for at, note in hits) and len(hits) == len(base) * beats // period:
   hits = base; beats = period; break
 return (beats, tuple(sorted(hits)))

def candidates(root):
 result = []
 for path in sorted(root.rglob('*.mid')):
  relative = path.relative_to(root); group = relative.parts[0]
  if group not in {g for groups in PREFER.values() for g in groups}: continue
  if any(word in str(relative).lower() for word in ['metal', 'hard rock', 'disco', 'motown', 'fill']): continue
  midi = mido.MidiFile(path); notes = []; tempos = []; signatures = []
  for track in midi.tracks:
   tick = 0
   for message in track:
    tick += message.time
    if message.type == 'note_on' and message.velocity:
     notes.append([round(tick / midi.ticks_per_beat, 7), message.note, message.velocity])
    elif message.type == 'set_tempo': tempos.append(mido.tempo2bpm(message.tempo))
    elif message.type == 'time_signature': signatures.append((message.numerator, message.denominator))
  if not notes or not tempos or max(tempos) - min(tempos) > .01 or any(s != (4, 4) for s in signatures): continue
  # Note-off tails do not add bars to a percussion loop. Keep every actual hit.
  beats = math.ceil((max(n[0] for n in notes) + .0001) / 4) * 4
  if beats not in [4, 8] or any(not 27 <= n[1] <= 87 for n in notes): continue
  kick = [n for n in notes if n[1] in [35, 36]]
  snare = [n for n in notes if n[1] in [38, 40]]
  if len(kick) < beats / 2 or len(snare) < beats / 2: continue
  kick_velocity = float(np.mean([n[2] for n in kick])); snare_velocity = float(np.mean([n[2] for n in snare]))
  if kick_velocity < 82 or snare_velocity < 84: continue
  backbeats = sum(min(abs(n[0] % 4 - 1), abs(n[0] % 4 - 3)) <= .09 for n in snare)
  if group != 'Jazz Loops' and backbeats < beats / 2: continue
  notes.sort(key=lambda n: (n[0], n[1])); signature = fingerprint(notes, beats)
  result.append(dict(path=path, sourceName=str(relative), group=group, beats=beats, bpm=round(tempos[0], 3), notes=notes, signature=signature,
    punch=round(.5 * kick_velocity + .5 * snare_velocity, 3), kickVelocity=round(kick_velocity, 3), snareVelocity=round(snare_velocity, 3), backbeats=backbeats))
 return result

def select(pool, uses):
 # Keep specialised regional rhythms, then keep one existing use of each other
 # source. Replace the repeated assignments rather than moving saved identities.
 seen = {u['base'] for u in uses if u['style'] not in MAIN}
 replace = []; retained = []
 for use in uses:
  if use['style'] not in MAIN: retained.append(use); continue
  if use['base'] in seen: replace.append(use)
  else: seen.add(use['base']); retained.append(use)
 selected = []; used = set(); signatures = set(); note_sets = []
 priority = ['blues', 'jazz', 'fusion', 'worship', 'soul', 'praise', 'gospel']
 for use in sorted(replace, key=lambda u: (priority.index(u['style']), u['key'])):
  style = use['style']; lower, upper = RANGE[style]; groups = PREFER[style]
  def suitable(row):
   if row['group'] not in groups or not lower <= row['bpm'] <= upper: return False
   swung = sum(abs(n[0] % 1 - 2/3) < .055 for n in row['notes'] if family(n[1]) in [0, 2]) >= row['beats'] / 2
   if style == 'blues' and not (re.search('shuffle|swing|blues', row['sourceName'], re.I) or swung): return False
   if style != 'jazz' and row['backbeats'] < row['beats'] / 2: return False
   if style == 'fusion' and row['group'] == 'Funk Loops' and 'shuffle' in row['sourceName'].lower(): return False
   return True
  ranked = sorted((r for r in pool if suitable(r)), key=lambda r: (groups.index(r['group']), -r['punch'], abs(r['bpm'] - use['bpm']), r['sourceName']))
  chosen = None
  for row in ranked:
   signature = row['signature']; hits = set(signature[1])
   if row['sourceName'] in used or signature in signatures: continue
   # A new filename or a velocity change alone does not make a new beat.
   if any(signature[0] == period and len(hits & prior) / max(1, len(hits | prior)) > .93 for period, prior in note_sets): continue
   chosen = row; break
  if not chosen:
   retained.append(use); continue
  used.add(chosen['sourceName']); signatures.add(chosen['signature']); note_sets.append((chosen['signature'][0], set(chosen['signature'][1])))
  selected.append((use, chosen))
 return selected, retained

class Synth:
 def __init__(self, font):
  if hashlib.sha256(font.read_bytes()).hexdigest() != FONT_SHA256: raise ValueError('Unexpected sound bank version')
  self.lib = ct.CDLL(ctypes.util.find_library('fluidsynth'))
  definitions = {
   'new_fluid_settings': ([], ct.c_void_p), 'new_fluid_synth': ([ct.c_void_p], ct.c_void_p),
   'fluid_settings_setnum': ([ct.c_void_p, ct.c_char_p, ct.c_double], ct.c_int), 'fluid_settings_setint': ([ct.c_void_p, ct.c_char_p, ct.c_int], ct.c_int),
   'fluid_synth_sfload': ([ct.c_void_p, ct.c_char_p, ct.c_int], ct.c_int),
   'fluid_synth_program_select': ([ct.c_void_p, ct.c_int, ct.c_int, ct.c_int, ct.c_int], ct.c_int),
   'fluid_synth_noteon': ([ct.c_void_p, ct.c_int, ct.c_int, ct.c_int], ct.c_int),
   'fluid_synth_all_sounds_off': ([ct.c_void_p, ct.c_int], ct.c_int),
   'fluid_synth_write_float': ([ct.c_void_p, ct.c_int, ct.c_void_p, ct.c_int, ct.c_int, ct.c_void_p, ct.c_int, ct.c_int], ct.c_int),
  }
  for name, (args, result) in definitions.items():
   function = getattr(self.lib, name); function.argtypes = args; function.restype = result
  settings = self.lib.new_fluid_settings()
  for key, value in [('synth.sample-rate', RATE), ('synth.gain', .7)]: self.lib.fluid_settings_setnum(settings, key.encode(), value)
  for key, value in [('synth.reverb.active', 0), ('synth.chorus.active', 0), ('synth.cpu-cores', 1)]: self.lib.fluid_settings_setint(settings, key.encode(), value)
  self.synth = self.lib.new_fluid_synth(settings); self.bank = self.lib.fluid_synth_sfload(self.synth, str(font).encode(), 1)
  if self.bank < 0: raise ValueError('Cannot load drum sound bank')
 def write(self, output, start, end):
  if end <= start: return
  pointer = output.ctypes.data + start * 8
  result = self.lib.fluid_synth_write_float(self.synth, end-start, pointer, 0, 2, pointer+4, 0, 2)
  if result: raise ValueError('Drum rendering failed')
 def render(self, row, style):
  program = 16 if style in ['gospel', 'praise'] else 0 if style in ['jazz', 'blues'] else 8
  self.lib.fluid_synth_all_sounds_off(self.synth, 9)
  assert self.lib.fluid_synth_program_select(self.synth, 9, self.bank, 128, program) == 0
  discard = np.zeros((256, 2), np.float32); self.write(discard, 0, len(discard))
  beat = round(RATE * 60 / row['bpm']); frames = beat * row['beats']
  output = np.zeros((frames * 4, 2), np.float32); position = 0
  for cycle in range(4):
   for at, note, velocity in row['notes']:
    target = cycle * frames + round(at * beat); self.write(output, position, target); position = target
    self.lib.fluid_synth_noteon(self.synth, 9, note, velocity)
  self.write(output, position, len(output)); pcm = output[-frames:].copy(); pcm -= pcm.mean(axis=0)
  peak = float(np.max(np.abs(pcm))); rms = float(np.sqrt(np.mean(pcm**2)))
  if peak < .01 or rms < .001 or not np.isfinite(pcm).all(): raise ValueError('Silent or invalid rendered rhythm')
  gain = min(.16 / rms, .88 / peak); pcm *= gain
  # Retain every hit and the exact number of beat frames. Only repair the last
  # half millisecond of the already circular waveform, if needed.
  fade = 16; pcm[-fade:] += np.linspace(0, 1, fade)[:, None] * (pcm[0] - pcm[-1])
  if float(np.max(np.abs(pcm))) > .95: raise ValueError('Unexpected output peak')
  return pcm, dict(frames=frames, sampleRate=RATE, peak=round(float(np.max(np.abs(pcm))), 5), rms=round(float(np.sqrt(np.mean(pcm**2))), 5), program=program)

def main():
 parser = argparse.ArgumentParser(); parser.add_argument('--source', type=Path, required=True); parser.add_argument('--baseline', type=Path, required=True)
 parser.add_argument('--soundfont', type=Path); parser.add_argument('--select-only', action='store_true'); args = parser.parse_args()
 baseline = json.loads(args.baseline.read_text()); pool = candidates(args.source); selected, retained = select(pool, baseline['uses'])
 print(json.dumps(dict(candidates=len(pool), replacements=len(selected), styles=dict(Counter(u['style'] for u, r in selected)))), flush=True)
 if args.select_only: return
 if not args.soundfont: raise ValueError('Provide the verified GeneralUser GS sound bank')
 folder = Path('audio/drums-rc349'); folder.mkdir(exist_ok=True); (folder/'midi').mkdir(exist_ok=True)
 synth = Synth(args.soundfont); loops = []; assignments = {}; audit = []
 for use, source in selected:
  digest = hashlib.sha256(source['path'].read_bytes()).hexdigest(); uid = 'fl-' + digest[:12]; target = folder/(uid+'.flac')
  pcm, audio = synth.render(source, use['style'])
  subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(RATE),'-ac','2','-i','pipe:0','-c:a','flac','-sample_fmt','s16',str(target)],input=pcm.astype('<f4').tobytes(),check=True)
  midi = folder/'midi'/(uid+'.mid'); shutil.copyfile(source['path'], midi)
  label = re.sub(r'^fpc_', '', source['path'].stem, flags=re.I).replace('_',' ').strip().title()
  genre = {'worship':'soul','gospel':'soul','fusion':'funk'}.get(use['style'], use['style'])
  loop = dict(id=uid,title='FL '+label,bpm=source['bpm'],beats=source['beats'],genre=genre,url='./'+str(target),tempoSource='MIDI',sourceName=source['sourceName'],sourceMidi='./'+str(midi),sourceSha256=digest,**audio)
  loops.append(loop); assignments[use['key']] = [uid, 0]
  audit.append(dict(key=use['key'],kind=use['kind'],study=use['title'],style=use['style'],previous=use['loop'],loop=uid,signature=source['signature'],kickVelocity=source['kickVelocity'],snareVelocity=source['snareVelocity'],notes=source['notes']))
 active = {row['id'] for row in loops}
 for path in list(folder.glob('fl-*.flac')) + list((folder/'midi').glob('fl-*.mid')):
  if path.stem not in active: path.unlink()
 Path('ear-source/fl-drums-rc349.js').write_text('/* Distinct patterns from the owner\'s Fl Loops.rar; original MIDI timing and tempo. */\nwindow.BassFlDrums='+json.dumps(dict(loops=loops,assignments=assignments),separators=(',',':'))+';\n')
 counts = Counter(u['base'] for u in retained)
 report = dict(version='RC349',audited=len(baseline['uses']),replacements=len(selected),distinctNewPatterns=len(loops),beforeDistinctSources=len(baseline['counts']),afterDistinctSources=len(counts)+len(loops),remainingSharedSources={key:value for key,value in counts.items() if value>1},remainingSharedAssignments=sum(value-1 for value in counts.values()),loops=loops,changes=audit)
 (folder/'manifest.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({k:v for k,v in report.items() if k not in ['loops','changes']}),flush=True)

if __name__ == '__main__': main()
