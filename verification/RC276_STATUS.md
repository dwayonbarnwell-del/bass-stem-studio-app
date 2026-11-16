# RC276: FretFlow rehearsal view

Date: 16 November 2026
Production baseline: RC275, main 2e9b1d73f74686530ef4aebd6a7279c12b73ab1d.
Draft PR: https://github.com/dwayonbarnwell-del/bass-stem-studio-app/pull/6

## Delivered behaviour

FretFlow is an additional view alongside Notes, Bass and Piano. Upright wood bass neck, coloured note map and scrolling tablature support standard 4/5/6-string tunings and 24 frets. Five strings is the default for each newly opened song; an explicitly saved FretFlow choice is restored. The existing Bass view keeps its own string preference. Both the FretFlow selector and the shared Settings selector adjust the active view correctly.

Note pitches, octaves, starts and ends come from the existing analysed song and audible playback clock. Transposition applies once. Suggested fingering is consistent between neck, map and tab. Out-of-range notes are labelled, never octave-folded. Dashed notes identify low-confidence analysis or suggested fills.

The existing Bass mute control retains vocals and other backing instruments. Existing no-bass stems are reused. Songs lacking them can prepare a no-bass backing track on-device with progress and cancellation. Preparation uses the existing SCNet model, combining drums, other instruments and vocals, while excluding bass. The backing is saved with the project and restored without another separation run. Original bass can be restored with the same button. Song replacement safely cancels/discards unfinished preparation.

FretFlow uses the same repeat strip, named sections, typed repeat ranges, speed and transpose controls as the other views. Hide controls removes setup and adjustment controls but retains Play, Pause, Bass mute, seeking and Show controls. Existing repeat and tuning settings continue unchanged. A newly opened song shows controls again. Other views retain their controls.

## Verification

- 459 exact pitch/range/fret assertions, plus rests, boundaries, overlaps and transposition passed.
- 12/12 browser cases passed at each of 360x800, 412x915, 844x390 and 1280x900: 48 cases total.
- Actual media playback, half speed, seeking and repeat checks passed.
- Repeat-strip selection, named-section chooser, control hiding/restoration, existing view restoration, default tuning and saved string-choice restoration passed.
- Frequency-based audio tests confirmed retained backing channels, suppression of the original/bass signal, restoration of the original track, save/reopen, cancellation and song replacement.
- Existing playback, editing, import/ZIP and lesson regression suites passed. All 72 lesson recordings are preserved.
- The underlying SCNet extraction pipeline previously completed a real two-second synthetic sample: four channels at 44,100 Hz with exactly two seconds of non-silent output. The revised no-bass routing was verified with controlled audio signals; user-song separation quality is not objectively benchmarked.
- Repeat assertions wait for a rendered frame because this cloud browser throttles animation frames in both the original Bass view and FretFlow. Physical Android background/screen-off behaviour remains unverified.

## Accuracy limits

Fingering is a playable suggestion, not a transcription of a performer's hand position. Display accuracy depends on the saved analysis; FretFlow does not correct wrong source notes. Some bass residue or separation artefacts may remain in a prepared backing track. First preparation speed depends on the device and requires the model download. No paid analysis jobs were submitted.

## Continuation checkpoint

The user corrected the original request from vocal mute to bass mute and requested a five-string default and hide/show controls. Those changes are complete and tested. Automatic approval review previously rejected publication to main because it requires explicit approval for RC276. Production remains RC275. Keep PR 6 as a draft until that approval arrives. After approval, publish the current PR head, verify Render's automatic deployment and live file hashes. Do not reimport lesson recordings or trigger a duplicate deployment.
