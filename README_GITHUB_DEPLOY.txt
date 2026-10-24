Bass Stem Studio RC150

Upload index.html, sw.js, manifest.webmanifest and icons/ to the frontend root. Deploy the matching updated backend and re-analyse songs to obtain new chord and bass results.

The existing Notes card offers Notes, Key 1 and Maj 1. A ? on a chord means tentative. The restricted-octave practice display is unchanged.

Bass Stem Studio RC150 — accuracy-rule review
24 October 2026

Changed
- Chord vocabulary expanded from 9 to 25 qualities, including sixths, added ninths, ninths, elevenths, thirteenths, altered dominants, half-diminished and diminished sevenths.
- Supported inversions display slash bass only when a sustained, confident non-fill bass tone supports them. A running fill does not redefine the chord.
- Tentative chord candidates have a purple dotted label and ?. Silence, lone notes and insufficient evidence still show no chord. Fit scores are not calibrated probabilities.
- Prefer an audible separated piano stem. Otherwise use harmonic accompaniment, then full mix if separation stems are unavailable. Event provenance survives save/import and appears in chord tooltips.
- Preserve strong 35–75 ms pitch events, confident short neighbour notes and supported same-pitch reattacks. Keep onset and confidence safeguards against noise.
- Separate raw analysis/recovery range (Bb0–C5) from the unchanged practice display range. Higher-register quiet notes and fills are no longer blocked by a display-range rule.
- The existing Notes control now offers Notes, Key 1 (minor tonic=1), or Maj 1 (relative major; minor tonic=6). Save the choice. Older saved number-view projects retain their relative-major convention.
- Remove the 1,200 px note-lane cap. Dense passages grow vertically; timestamp alignment and equal-sized note cards are preserved.
- Accept saved rehearsal stems from backend versions 9 and 10, and retain attack/chord evidence across project and segment boundaries.

Explicitly unchanged
The requested restricted-octave practice display is unchanged. songBassRegister, practiceDisplayRange and practiceDisplayMidi were compared against RC149 and are byte-identical. No original-octave toggle was added. Raw note pitches remain separate from display folding. Eight-fret automatic following, colours, editable 14 px default and approved layout are retained.

Verification
- All inline JavaScript parses; all changed Python files compile.
- 300 pitch-class fixtures across 25 qualities and all 12 roots passed. Equivalent chord spellings can tie; they are marked tentative in audio results.
- Synthetic audio checks covered 12 chord types, omitted-fifth voicings, weak extension rejection, silence, a lone pitch, silence gaps and slash bass. This is controlled regression testing, not a real-song accuracy score.
- High-register and low-register recovery tests passed, including fast-note preservation, weak-artifact rejection, reattacks, 48 confident octave-fill cases and Bb0/B0 fundamentals.
- Separated-piano selection, silent-piano fallback and failed-job cleanup passed.
- Chromium at 360, 412 and 800 px widths with 11, 14 and 22 px fonts: equal note-card dimensions, aligned timestamp/chord columns, complete chord labels and no page errors. A 64-note interval exceeds 1,200 px with all cards inside the lane. Numbering selector tested; 360 px layout inspected visually.
- Save/ingest fields, segmented offsets, tentative/slash chord transposition and both minor-number conventions checked.
- 24 twelve-second excerpts from the 8 provided recordings (288 seconds total) processed without timing/overlap errors. Before: 23 seconds of chord labels. After: 77.25 seconds, of which 48 seconds are explicitly tentative. More coverage is NOT proof of greater accuracy; many uploads are bass-heavy and lack clear keyboard evidence.

Limits and rollout
No labelled reference transcriptions were supplied. These recordings were used for evaluation, not model training. No claim of perfect transcription or parity with Moises, LANDR or LALAL.AI is established. TorchCREPE/GPU separation was not runnable in this workspace; pure processing functions and CPU chord analysis were tested. The published RunPod worker must load the updated backend, then songs must be re-analysed. A successful GitHub release workflow does not prove the serving RunPod worker has updated.

Versions
Frontend RC150; analysis cloud-bass-v16-range-and-articulation;
metadata song-context-v4-extended-chords; chord-timeline-v3;
rehearsal-v10-keyboard-chord-evidence.
