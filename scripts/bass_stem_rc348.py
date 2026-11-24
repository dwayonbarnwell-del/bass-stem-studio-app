"""Offline bass analysis compatibility entry point.

The verified local MDX bass model now uses OpenCV's built-in CPU backend.
No ONNX Runtime or telemetry client is imported. Model weights stay outside git.
Spectrum layout: https://github.com/nomadkaraoke/python-audio-separator
"""
import time
import librosa,numpy as np
from bass_stem_opencv_rc352 import BassSeparator

if __name__=='__main__':
 import argparse,json
 ap=argparse.ArgumentParser();ap.add_argument('--model',required=True);ap.add_argument('--file',required=True);ap.add_argument('--output',required=True);args=ap.parse_args()
 start=time.monotonic();separator=BassSeparator(args.model);bass=separator.mono8k(args.file);np.save(args.output,bass)
 f0,voiced,prob=librosa.pyin(bass,sr=8000,fmin=librosa.note_to_hz('B0'),fmax=librosa.note_to_hz('B3'),frame_length=2048,hop_length=160)
 pitches=np.rint(librosa.hz_to_midi(f0[np.isfinite(f0)]));values,counts=np.unique(pitches,return_counts=True)
 print(json.dumps(dict(seconds=round(time.monotonic()-start,2),voiced=int(sum(voiced)),highConfidence=int(sum(prob>.72)),pitches=list(zip(values.astype(int).tolist(),counts.tolist())))),flush=True)
