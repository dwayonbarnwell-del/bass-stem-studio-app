# Keyboard accompaniment samples

## Wurlitzer electric piano

Wurlitzer EP200 by **Greg Sullivan**, SFZ mapping and tuning corrections by **kinwie**. Selected from https://github.com/sfzinstruments/GregSullivan.E-Pianos under **Creative Commons Attribution 3.0 Unported**: https://creativecommons.org/licenses/by/3.0/ . The complete licence is included. This is a recording of an electromechanical reed electric piano, not a Rhodes.

The author's current homepage, https://www.sullivang.net/ , also grants CC BY 4.0 for the instruments hosted there; this pack uses the pinned repository distribution under its explicit CC BY 3.0 licence.

## Drawbar organ

Drawbar Organ Emulation (2019-07-12), sampled from **setBfree** by **Roberto for the FreePats project**, under **CC0 1.0 Universal**. https://freepats.zenvoid.org/Organ/electric-organ.html . The original source readme and licence are included. This is a sampled software emulation, not recordings of a physical Hammond.

## Preparation and playback

The samples were converted to mono PCM16 WAV at 32 kHz, with the original electric-piano tuning/gain corrections. Relative dynamics were retained using one peak-normalisation factor per instrument. A short loop seam crossfade was applied after resampling. These are edited subsets; see manifest.json for exact upstream paths, immutable source commit or archive hash, changes and SHA-256 checksums.

Use the supplied loopStart/loopEnd (seconds) for held notes. Source loops preserve natural attacks and sustain rather than synthesising a replacement tone. Some upper Wurlitzer recordings have short bodies because the upstream instrument uses sustain loops; they are not supposed to stop after their file duration. Apply a release envelope of approximately 0.25–0.4 seconds for electric piano and 0.35–0.7 seconds for organ. Chords require moderate polyphonic gain to prevent clipping.

Electric piano has two genuinely recorded dynamic layers. Select the layer first, then the root closest to the requested note (or use optional keyMin/keyMax to match the upstream mapping). Organ samples occur every four semitones; electric piano keeps the original non-uniform recorded roots, rather than creating synthetic extra roots.

No uploaded installer or commercial reference content was used. jRhodes samples were excluded because their sample redistribution licence is non-commercial.
