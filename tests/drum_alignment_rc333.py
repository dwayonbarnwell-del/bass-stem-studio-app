"""Check the real musical phrases in 45 supplied drum tracks at three tempi.
Run from the repository root with Node, ffmpeg, NumPy and SciPy installed.
"""
import json
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
from scipy.signal import correlate


def phrase_offset(samples, beat_frames):
    # Spectral flux tracks new attacks across frequencies, including quiet
    # percussion. A single amplitude envelope can mistake a ringing cymbal for a hit.
    hop = 20
    windows = np.lib.stride_tricks.sliding_window_view(samples, 200)[::hop]
    spectrum = np.abs(np.fft.rfft(windows * np.hanning(200), axis=1))
    flux = np.maximum(0, np.diff(np.log1p(spectrum), axis=0)).sum(axis=1)
    flux -= flux.mean()
    similarity = correlate(flux, flux, method='fft')[len(flux)-1:]
    similarity /= similarity[0]
    matches = []
    for beats in [4, 8, 16]:
        expected = beat_frames * beats / hop
        radius = round(.12 * beat_frames / hop)
        begin = round(expected) - radius
        region = similarity[begin:round(expected) + radius + 1]
        peak = np.argmax(region)
        matches.append((region[peak], abs(begin + peak - expected) * hop / 10000))
    return max(matches)


if __name__ == '__main__':
    loops = json.loads(Path('audio/drums-rc294/manifest.json').read_text())['samples']
    largest = 0
    with TemporaryDirectory() as folder:
        subprocess.run(['node', 'tests/drum_alignment_rc333.mjs', folder], check=True)
        for loop in loops:
            for bpm in [77, 113, 150]:
                beat = round(10000 * 60 / bpm)
                samples = np.fromfile(Path(folder) / f"{loop['id']}-{bpm}.raw", '<f4')
                assert len(samples) == beat * loop['beats']
                strength, offset = phrase_offset(samples, beat)
                assert strength > .14 and offset < .015, (loop['title'], bpm, strength, offset)
                largest = max(largest, offset)
    print(f'Passed {len(loops)} original drum tracks at 77, 113 and 150 BPM. '
          f'Largest measured phrase offset {1000 * largest:.1f} ms.')
