# RC276: FretFlow

Date: 16 November 2026
Baseline: RC275, main 2e9b1d73f74686530ef4aebd6a7279c12b73ab1d.

## Delivered behaviour

Additional FretFlow view alongside Notes, Bass and Piano. Upright wood bass neck, coloured note map and scrolling tablature, standard 4/5/6-string tunings, 24 frets. Note pitches, octaves, starts and ends come from the existing analysed song and the existing audible playback clock. Transposition applies once. Suggested fingering is consistent between the neck, map and tab. Out-of-range notes are labelled, never octave-folded. Dashed notes identify low-confidence analysis or suggested fills.

Optional on-device vocal mute uses the existing SCNet model. Accompaniment (drums and other instruments) and bass remain independently controllable through the existing mixer. Preparation has progress and cancellation, runs in bounded chunks with context overlap, and is discarded when songs change. Saving includes the prepared audio, so reopening does not require separation again. Original vocals can be restored.

## Verification

- 459 exact pitch/range/fret assertions, plus rests, boundaries, overlaps and transposition: passed.
- Isolated browser tests: 10/10 at each of 360x800, 412x915, 844x390 and 1280x900.
- Actual media playback, half speed, seek, repeat, view switching and responsive overflow checks passed.
- Audio graph tested with distinct synthetic frequencies: original excluded while muted; accompaniment remains when bass is muted; save/reopen and cancellation/song replacement passed.
- Existing playback, editing, import/ZIP and lesson regression suites passed. All 72 lesson recordings are preserved.
- Actual SCNet extraction completed on a two-second synthetic audio sample: 4 channels, 44,100 Hz, exactly 2 seconds, non-silent output.
- Browser repeat assertions wait for a rendered frame: this cloud browser throttles animation frames in both the original Bass view and FretFlow. Physical Android background/screen-off behaviour has not been verified.

## Accuracy limits

Fingering is a playable suggestion, not a transcription of a performer's hand position. Display accuracy depends on the saved analysis; this view does not correct wrong source notes. Separation can leave voice residue and has not been objectively benchmarked on the user's complete songs. First preparation speed depends on the device; the initial model download is required. No paid analysis jobs were submitted.

## Continuation checkpoint

Implementation and validation complete. Automatic approval review rejected publication to main because it requires explicit approval for RC276. Production remains on RC275. The reviewed change is being preserved on feature/fretflow-rc276 as a draft PR. After the user approves publishing RC276, update main and verify Render's automatic deployment plus live file hashes. Do not repeat extraction, reimport lessons, or create a separate deployment if the automatic deployment is already running.
