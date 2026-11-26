# Expressive bass study review

26 November 2026. Baseline: RC364, `522be99083c29740095aef5b39f3b2cd68c09016`.

## Assessment

The previous bank contained useful note exercises and recorded performances, but the generated studies did not consistently support the expressive chord connections requested. A shared routine replaced composed rhythms with generic timing. Rehearsal sometimes began with a fixed 1→4 template, and generated accompaniment could reduce a bassline to its first bar. These behaviours weakened phrasing and made different choices sound too similar.

RC365 improves that foundation. It is a bank of original technique studies, not transcriptions of Tasha Cobbs songs or a promise of professional mastery.

## Changes

| Area | Result |
| --- | --- |
| Repertoire | 40 new original studies: four runs and four fills for each of Worship, Gospel, R&B, Soul and Jazz. Ten accompanying bassline loops. |
| Rhythm | Composed rests, held anchors, paired figures, triplets and changing note lengths survive rendering and rehearsal fitting. Existing curated target-style studies retain their authored timing. |
| Chord connections | Pentatonic answers, soft approaches to the third, chromatic enclosures, octave answers, guide-tone colours and the fifth of the destination. The destination stays at the original chord-change time. |
| Harmony | Use the actual source chord, its quality and slash bass. Retain the known parent scale, including its sixth and seventh; distinguish G7 from Gmaj7. Unknown keys do not become an assumed C-major scale. |
| Expression | Preserve note velocities through rehearsal. Add restrained sampled slides and softened legato attacks, with different note endings and clear, stronger landings. Limited R&B/Soul offbeat placement is intentional and repeatable, not random jitter. |
| Basslines | Give each style its own groove and two distinct variants. Alternate the steady motif with an answer in practice; retain the groove across the song in rehearsal. Avoid a dense run in every accompaniment bar. |
| Access | Separate Worship, R&B and Soul practice groups; concise names; new studies near the top. Avoid creating extra derivatives of the new loops under duplicated names. |

Very short chord windows skip an unplayable figure instead of cramming it in. Quiet sections, original song harmony, source recordings, cultural performances, stable identifiers and saved deletions remain respected. Normalisation, mixer defaults and the audio-clock repeat mechanism are retained.

## Reference recording and research

The supplied **How to play Worship Licks and Fill like a Pro Bassist.mp3** lasts 19:15.27. Local FFmpeg and spectral/harmonic analysis screened the recording and examined six candidate six-second passages. Strong bass-dominant candidates include 4:30–4:36, 11:16–11:22 and 14:06–14:12. Their non-uniform estimated attack spacing supports using short bursts with longer gaps.

This was automated analysis, not a verified note-for-note transcription or a manual listening review. Bass dominance does not prove the absence of speech or backing. Estimated attacks can include fret noise or octave errors and cannot establish exact tempo, note lengths, articulation or a human timing formula. No lesson audio has been republished.

Primary teaching references used for the design:

- [Ryan Madora: building a groove with rhythm, chord tones, space and call/response](https://www.notreble.com/buzz/2026/07/29/how-to-build-a-killer-bass-groove-with-only-two-chords/).
- [Andrew Pouska: approaching the next chord from its fifth](https://www.studybass.com/lessons/harmony/the-fifth-approach/).
- [Mark Smith: single and double approach notes](https://www.talkingbass.net/using-double-approach-notes-in-your-bass-lines/).
- [Jon Burr: melodic line construction, arpeggios and chromatic connections](https://www.notreble.com/buzz/2010/01/11/lesson-basic-line-construction-types/).

These sources inform techniques. They do not endorse these studies. This review does not claim to cover every bass blog or the top 100 worship songs.

## Verification

- `tests/expressive_rc365.cjs`: all 40 new studies across 42 directed changes and 12 keys, 20,160 practice plans; 40,320 major/minor rehearsal fits; 2,430 sampled existing target-style plans; all ten new bassline loops in every key; ten distinct rehearsal grooves.
- Independent checks cover the fifth of F resolving through C, F as the seventh of G7, F natural in A minor within C major, slash-bass landings, suspended/diminished/altered source qualities, 1:02–1:05 phrase fitting, three- and six-beat meters, uneven grids, quiet passages, short-window rejection and slide transposition.
- Recorded/cultural plans compare unchanged against the same dependency graph without the new module. Deletion and reload checks pass.
- Existing rehearsal harmony, cultural transitions, FL drum assignments, register/audio-clock, timeline repeat, note-role, pitched-audio and failure-recovery suites pass. Asset checks resolve 684 playback references, 92 offline dependencies and 90 piano sample hashes against the staged release.
- The browser renders all 50 additions through the real sampled bass engine and OfflineAudioContext at 32 kHz. Minimum whole-loop RMS is 0.1056 and maximum sample peak is 0.585. Independent waveform differences are 0.09988 for the two played velocity layers and 0.21993 for a slide versus a straight note, confirming that expression reaches the sound engine. These are functional signal checks, not listening scores.
- Browser interaction checks cover Worship fills for 2→6, R&B runs and key changes, the new Prayer bed loop with backing, song-wide alternatives, pause, non-adjacent timeline repeats and transposition with repeat selections retained. Phone widths 390 and 320 pixels keep the controls inside the dialog.

Two historical harnesses, `curated_rc289.cjs` and `accompaniment_rc293.cjs`, also fail on unchanged RC364: the first assumes the superseded note count, and the second omits a recording dependency. They are not counted as passing tests. Current integration coverage uses the actual dependency graph.

The QA browser already had full device storage. The app reported the failed device save; no stored songs were cleared. Successful device-library saving is not claimed by this review. Sampled playback and automated checks establish functionality and harmonic/timing constraints, not a professional musician's subjective judgement of every lick.

## Practising the changes

Start with Worship **Gentle fold** and **Triplet sigh**. Use 1→4, 1→5 and 2→6 slowly. Sing the landing, keep the low anchor steady, then imitate the accents, gaps and note endings before increasing tempo. Use the quieter fills between vocal lines; keep the dense runs for moments where the arrangement leaves room. The recorded cultural studies remain the reference for their performers' original feel.
