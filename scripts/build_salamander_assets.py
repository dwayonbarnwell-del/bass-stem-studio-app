"""Build the attributed, three-layer browser piano from pinned public source audio.

Requires Python/numpy and ffmpeg/ffprobe. No installer content is used.
The cache lives outside the repository; only the compressed, verified assets ship.
"""
from __future__ import annotations
import argparse
import concurrent.futures
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import urllib.parse
import urllib.request

import numpy as np

SOURCE_REPOSITORY = 'https://github.com/sfzinstruments/SalamanderGrandPiano'
SOURCE_COMMIT = '3382bf9496bba2486f5ab0de55a264d1dfc38404'
BASE = 'https://raw.githubusercontent.com/sfzinstruments/SalamanderGrandPiano/' + SOURCE_COMMIT + '/'
LAYERS = [(4, 'soft', 1, 50), (8, 'medium', 51, 95), (12, 'strong', 96, 127)]
RATE = 44100


def fetch(path: str, cache: Path, expected_sha: str | None = None) -> bytes:
    target = cache / path
    if target.exists():
        content = target.read_bytes()
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(BASE + urllib.parse.quote(path, safe='/'), timeout=120) as response:
            content = response.read()
        target.write_bytes(content)
    if expected_sha:
        actual = hashlib.sha1(b'blob ' + str(len(content)).encode() + b'\0' + content).hexdigest()
        if actual != expected_sha:
            raise ValueError('Source content hash mismatch: ' + path)
    return content


def decode(path: Path, rate: int | None = None) -> tuple[np.ndarray, int]:
    meta = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(path)]))['streams'][0]
    sample_rate = rate or int(meta['sample_rate'])
    if int(meta['channels']) != 2:
        raise ValueError('Piano source is not stereo: ' + str(path))
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '2', '-ar', str(sample_rate), 'pipe:1'])
    pcm = np.frombuffer(raw, dtype='<f4').reshape(-1, 2).copy()
    if not np.isfinite(pcm).all() or not len(pcm):
        raise ValueError('Invalid decoded audio: ' + str(path))
    return pcm, sample_rate


def onset(pcm: np.ndarray, rate: int) -> float:
    """First 1 ms RMS block above −40 dB relative to the note's peak RMS.

    This diagnostic checks decoded MP3 attack timing; source-author offsets drive
    trimming, so low-level room noise cannot shift the selected start position.
    """
    width = max(1, round(rate / 1000))
    blocks = len(pcm) // width
    energy = np.sqrt(np.mean(np.square(pcm[:blocks * width].reshape(blocks, width, 2).astype(np.float64)), axis=(1, 2)))
    threshold = max(1e-6, float(energy.max()) * .01)
    found = np.flatnonzero(energy > threshold)
    return float(found[0] * width / rate) if len(found) else 0


def build_one(item, cache: Path, output: Path, tree: dict, offsets: dict, tuning: dict) -> dict:
    midi, name, region, velocity, label, low, high = item
    path = 'Samples/' + name + 'v' + str(velocity) + '.flac'
    original = fetch(path, cache, tree[path]['sha'])
    pcm, source_rate = decode(cache / path)
    original_duration = len(pcm) / source_rate
    cents = tuning[region]
    retuned_rate = round(source_rate * 2 ** (cents / 1200))
    ratio = retuned_rate / source_rate
    # Keep a 3 ms lead before the upstream fast-response offset.
    source_start = max(0, offsets[velocity][region] - round(source_rate * .003))
    maximum_seconds = 8 if midi <= 54 else 6 if midi <= 84 else 5
    kept = min(len(pcm) - source_start, math.ceil(maximum_seconds * retuned_rate))
    pcm = pcm[source_start:source_start + kept]
    # Smooth only the final tail, leaving attack and relative gain untouched.
    fade = min(round(retuned_rate * .25), len(pcm))
    pcm[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)[:, None]
    filename = f'{midi}-{label}.mp3'
    target = output / filename
    command = ['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(retuned_rate), '-ac', '2', '-i', 'pipe:0',
               '-ar', str(RATE), '-ac', '2', '-c:a', 'libmp3lame', '-q:a', '2', '-write_xing', '1',
               '-map_metadata', '-1', '-y', str(target)]
    subprocess.run(command, input=pcm.astype('<f4').tobytes(), check=True)
    decoded, final_rate = decode(target)
    payload = target.read_bytes()
    attack = onset(decoded, final_rate)
    if attack > .02:
        raise ValueError(f'Decoded attack exceeds 20 ms: {filename}: {attack}')
    if np.max(np.abs(decoded)) >= .9999:
        raise ValueError('Clipped sample: ' + filename)
    return {
        'rootMidi': midi, 'layer': label, 'sourceVelocityLayer': velocity,
        'velocityMin': low, 'velocityMax': high, 'url': filename,
        'bytes': len(payload), 'duration': round(len(decoded) / final_rate, 6),
        'sampleRate': final_rate, 'channels': 2, 'trimStartSeconds': round(source_start / source_rate, 6),
        'decodedAttackSeconds': round(attack, 6), 'sourceTuneCents': cents,
        'appliedTuneCents': round(1200 * math.log2(ratio), 4),
        'tuningBakedIn': True, 'peak': round(float(np.max(np.abs(decoded))), 6),
        'sha256': hashlib.sha256(payload).hexdigest(),
        'source': {'path': path, 'gitBlobSha': tree[path]['sha'], 'sha256': hashlib.sha256(original).hexdigest(),
                   'sampleRate': source_rate, 'duration': round(original_duration, 6)},
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'ai-source/salamander')
    parser.add_argument('--workers', type=int, default=6)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    args.cache.mkdir(parents=True, exist_ok=True)
    tree_path = args.cache / 'tree.json'
    if tree_path.exists():
        listing = json.loads(tree_path.read_text())
    else:
        with urllib.request.urlopen('https://api.github.com/repos/sfzinstruments/SalamanderGrandPiano/git/trees/' + SOURCE_COMMIT + '?recursive=1', timeout=120) as response:
            listing = json.load(response)
        tree_path.write_text(json.dumps(listing))
    tree = {entry['path']: entry for entry in listing['tree']}
    original_license = fetch('LICENSE', args.cache, tree['LICENSE']['sha'])
    (args.output / 'LICENSE.txt').write_bytes(original_license)
    (args.output / 'SOURCE_README.md').write_bytes(fetch('README.md', args.cache, tree['README.md']['sha']))
    region_text = fetch('Data/region.txt', args.cache, tree['Data/region.txt']['sha']).decode()
    region_rows = re.findall(r'region_label=(\d+).*?pitch_keycenter=(\d+) sample=(.*?)\$VEL', region_text)
    tuning_text = fetch('Data/tune_ret.txt', args.cache, tree['Data/tune_ret.txt']['sha']).decode()
    tuning = {int(a): int(b) for a, b in re.findall(r'\$TUNE(\d+) (-?\d+)', tuning_text)}
    offsets = {}
    for velocity, _, _, _ in LAYERS:
        path = f'Data/vel_{velocity:02}.txt'
        text = fetch(path, args.cache, tree[path]['sha']).decode()
        offsets[velocity] = {int(a): int(b) for a, b in re.findall(r'\$OFF(\d+) (\d+)', text)}
    items = [(int(midi), name, int(region), velocity, label, low, high)
             for region, midi, name in region_rows for velocity, label, low, high in LAYERS]
    if len(items) != 90:
        raise ValueError('Expected 30 original pitch anchors in each of three layers')
    samples = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(build_one, item, args.cache, args.output, tree, offsets, tuning) for item in items]
        for future in concurrent.futures.as_completed(futures):
            samples.append(future.result())
            if len(samples) % 15 == 0:
                print(f'Prepared {len(samples)} / 90 samples', flush=True)
    samples.sort(key=lambda row: (row['rootMidi'], row['sourceVelocityLayer']))
    total = sum(row['bytes'] for row in samples)
    if total > 15_000_000:
        raise ValueError('Piano sample package exceeds 15 MB target')
    manifest = {
        'version': 1, 'id': 'salamander-grand-v3-rc257', 'name': 'Salamander Grand Piano',
        'author': 'Alexander Holm', 'sourceRepository': SOURCE_REPOSITORY, 'sourceCommit': SOURCE_COMMIT,
        'sourceRecording': 'https://archive.org/details/SalamanderGrandPianoV3',
        'licence': 'CC BY 3.0', 'licenceUrl': 'https://creativecommons.org/licenses/by/3.0/',
        'attribution': 'Salamander Grand Piano v3 by Alexander Holm, CC BY 3.0. Adapted for Bass Stem Studio from the sfzinstruments/SalamanderGrandPiano mapping.',
        'adaptation': 'Three of 16 velocity layers selected. Source retuned mapping baked in. Leading silence shortened using upstream offsets with 3 ms lead. Tails limited to 5–8 seconds with 250 ms fade. Converted to 44.1 kHz stereo MP3, preserving relative sample levels.',
        'format': 'audio/mpeg', 'sampleRate': RATE, 'channels': 2, 'rootMidiMin': 21, 'rootMidiMax': 108,
        'layers': [{'id': label, 'sourceVelocityLayer': velocity, 'velocityMin': low, 'velocityMax': high} for velocity, label, low, high in LAYERS],
        'sampleCount': len(samples), 'totalBytes': total, 'samples': samples,
    }
    (args.output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'samples': len(samples), 'bytes': total, 'maxDecodedAttackSeconds': max(row['decodedAttackSeconds'] for row in samples)}), flush=True)


if __name__ == '__main__':
    main()
