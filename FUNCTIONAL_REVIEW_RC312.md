# RC312 functional review

Reviewed 21 November 2026 against live RC312 and matching source.

## Result

27 targeted Node suites passed after updating old harnesses to current interfaces. 33 inline and 36 linked scripts compiled. All 53 service-worker shell paths exist. No new functional failure was found in the exercised live flows.

## Correction

The maintained piano source still used the old one-octave minimum while the shipped inline copy already used the approved two-octave minimum. Synchronised the source with the shipped code to prevent a future rebuild reverting the keyboard sizing. No user-facing behaviour change.

Updated older fixtures for the current bass register, transport, automatic preparation and asset versions. Transport tests retain exact scheduling and cancellation checks, and now verify differing drum/bass loop lengths and replacement at the matching beat.

## Live checks

- Opened a saved test song from Library and imported a complete saved project.
- Played/paused and switched through all six views without stopping playback.
- Restored saved mute audio; both mute buttons worked without separation.
- An older incomplete project started preparation; Cancel responded.
- Bass/Piano views restored notes, with 24 keys in the checked passage.
- Checked both fret layouts and four/five-string selection.
- Selected a verse to repeat, changed speed and restored 100%.
- Checked compact mode, direct Loop, Settings and their close controls.
- Opened chord review and correction, then cancelled without changing the chord.
- Started ear training, played a question and revealed its answer.
- Played a practice pattern; Next retained Stop while changing the pattern. Sound switching and Runs were available.
- Searched Song chords in Library and found Never Lost.
- Opened Live Audio controls; did not start microphone capture.

## Limits

The live test browser reported full device storage. Save ended with Retry save and an explicit error, rather than false success. Filesystem-backed round-trip tests passed for folder writes/reopens, embedded backing audio/melody and failed-write recovery. These do not verify the user's Android folder access or free space.

Offline shell files and cached piano behaviour passed code-level checks; a fully disconnected browser was not tested. Fresh paid cloud analysis, external service availability, real microphone recording and Android screen-locked/background playback remain unverified. UI checks do not establish transcription accuracy or perceived audio quality.

## Test suites

- accompaniment_rc293
- analysis_failures_rc250
- automatic_audio_rc247
- automatic_chords_rc254
- automatic_melody_rc245
- bass_roll_rc297
- ear_accuracy_rc258
- ear_keyboard_rc266
- ear_levels_rc261
- editing_rc275
- fretflow_rc276
- groups_rc290
- import_pipeline_rc249
- library_scan_rc295
- library_worker_rc305
- playback_polish_rc246
- playback_timing_rc256
- practice_audio_rc292
- practice_sections_rc308
- project_roundtrip_rc303
- project_save_status_rc303
- rhythm_practice_rc171
- sampled_piano_rc257
- saved_project_playback_rc234
- song_repeat_rc285
- song_review_rc287
- song_view_rc284
