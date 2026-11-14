# Salamander piano for Bass Stem Studio

These stereo piano recordings are adapted from **Salamander Grand Piano v3** by
**Alexander Holm**, licensed under **Creative Commons Attribution 3.0 Unported**.

- Original recording: <https://archive.org/details/SalamanderGrandPianoV3>
- Source repository: <https://github.com/sfzinstruments/SalamanderGrandPiano>
- Pinned source commit: `3382bf9496bba2486f5ab0de55a264d1dfc38404`
- Licence: <https://creativecommons.org/licenses/by/3.0/>
- Full licence text: [LICENSE.txt](LICENSE.txt)
- Upstream description: [SOURCE_README.md](SOURCE_README.md)

The upstream SFZ mapping was prepared by kinwie. The source's retuned mapping and
fast-response sample offsets are used here; the latter derive from the offset
work credited to Jeff Learman in the upstream README.

## Adaptation

The browser version selects three of the original 16 velocity layers: layers 4,
8 and 12. Each layer retains all 30 original pitch anchors, from MIDI 21 to 108.
These are spaced by three semitones, so the nearest-root playback method shifts
each recording by at most one semitone between neighbouring anchors.

The upstream retuning corrections are baked into the audio. The manifest records
the original and applied corrections; playback must **not apply them a second
time**. Leading silence is shortened using the upstream per-note/per-layer
offsets, retaining a 3 ms lead. The encoded MP3 files are decoded again to check
attack alignment, stereo channels, finite samples and clipping.

Natural tails are limited to 8 seconds in the low register, 6 seconds in the
middle register and 5 seconds in the high register, with a final 250 ms fade.
The samples are encoded to 44.1 kHz stereo MP3 using LAME quality 2. No per-file
peak normalisation is applied: relative loudness between notes and layers is
preserved. Separate pedal, hammer and sympathetic-resonance samples are omitted
to keep the browser download small. This is a compact adaptation, not the full
original SFZ instrument.

`manifest.json` gives each file's pitch root, velocity range, length, compressed
size, SHA-256, source hashes and preparation details. File URLs are relative to
the manifest. The player should fetch and decode only the notes/layers it needs
and cache successful downloads. No remote synthesis or paid analysis is needed
for playback.

## Rebuild

Run from the repository root, with Python, numpy, ffmpeg and ffprobe installed:

```sh
python3 scripts/build_salamander_assets.py --cache /path/outside/repo/salamander-original
```

The builder downloads the pinned upstream files, validates their Git blob hashes,
and refuses packages exceeding 15 MB or decoded samples with clipping or an
attack later than 20 ms. The original recordings remain in the chosen external
cache; only the prepared MP3 files and attribution ship with the app.

Required credit: **Salamander Grand Piano v3 by Alexander Holm, CC BY 3.0.
Adapted for Bass Stem Studio from the sfzinstruments/SalamanderGrandPiano mapping.**
