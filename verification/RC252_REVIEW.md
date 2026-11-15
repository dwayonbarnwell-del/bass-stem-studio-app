# RC252 verification, 12 November 2026

## Confirmed faults and changes

- An uncertain local section (or a failed local key calculation) cleared the valid whole-song key returned by the analysis worker. Key selection now uses manual correction, then a confident section key, then the detected song key. Unknown songs remain unknown; previous songs and sections cannot supply a guessed key.
- Both project exports now preserve the original song key instead of the key of the section currently playing. Import recovers a valid saved base key when the legacy display scale is blank, and restores transposition only once.
- A stylesheet and a script shared the `rc206-settings-rows` ID. The stylesheet now has its own ID. No layout changes.
- Updated two legacy browser assertions to reflect RC250's intentionally false return for an empty recovery and the current device-library save path. The checks still require deleted notes to stay deleted, genuine write failures to be shown, and controls to unlock.

## Automated checks

43 Node regression files passed, including 19 new key checks and 14 real MP3 encode/decode combinations at 44.1/48 kHz and seven bitrates. FFmpeg supplies the Web Audio resampling stub for the latter. Online requests in the batch/analysis regression tests are mocked.

Covered: automatic bass and melody sequencing; saved-result reuse; single-song and ZIP import pipelines; interrupted job recovery and duplicate-charge protection; batch sizes and stop/retry behaviour; library identity and melody updates; playback timing, loop boundaries, speed, volume normalisation; chord labels, chord uncertainty, low bass, piano rendering/audio/MIDI, long melody coverage, lyrics controls, navigation, ear training, sound checks, pattern generation, device recovery and offline cache fallback.

All 34 JavaScript modules and every inline script also parse successfully.

The original historical suite also contains 19 failing test files. Inspection identified obsolete literal/version/layout expectations, missing VM globals/stubs, changed sync/async function extraction, and one malformed synthetic frame fixture. These are not reported as passing. Six older standalone Playwright files were not run because this executor cannot launch its isolated browser. Browser tests instead run on the existing HTTPS staging site with generated audio and no production credentials or library data.

Passed files:

- `tests/analysis_failures_rc250.cjs`
- `tests/auto_level_rc186.cjs`
- `tests/automatic_audio_rc247.cjs`
- `tests/automatic_melody_rc245.cjs`
- `tests/batch_rc196.cjs`
- `tests/batch_rc197.cjs`
- `tests/batch_rc203.cjs`
- `tests/batch_repair_rc209.cjs`
- `tests/chord_labels_rc235.cjs`
- `tests/comfort_rc176.cjs`
- `tests/controls_rc188.cjs`
- `tests/ear_training_rc174.cjs`
- `tests/empty_library_rc251.cjs`
- `tests/encoder_timeout_rc248.cjs`
- `tests/feedback_rc183.cjs`
- `tests/ideas_rc170.cjs`
- `tests/import_pipeline_rc249.cjs`
- `tests/library_melody_rc245.cjs`
- `tests/links_coach_rc172.cjs`
- `tests/live_audio_rc167.cjs`
- `tests/long_sections_rc244.cjs`
- `tests/lrclib_rc225.cjs`
- `tests/lyrics_recording_rc244.cjs`
- `tests/lyrics_ux_rc226.cjs`
- `tests/navigation_rc243.cjs`
- `tests/network_safety_rc184.cjs`
- `tests/offline_rc179.cjs`
- `tests/piano_audio_rc238.cjs`
- `tests/piano_cloud_rc237.cjs`
- `tests/piano_full_song_rc241.cjs`
- `tests/piano_view_rc237.cjs`
- `tests/playback_polish_rc246.cjs`
- `tests/responsive_live_rc209.cjs`
- `tests/rhythm_practice_rc171.cjs`
- `tests/saved_audio_match_rc227.cjs`
- `tests/section_speed_rc165.cjs`
- `tests/share_rc177.cjs`
- `tests/song_bulk_rc221.cjs`
- `tests/songbook_pack_rc220.cjs`
- `tests/study_tools_rc173.cjs`
- `tests/voice_ai_rc168.cjs`
- `tests/low_bitrate_audio_rc244.cjs`
- `tests/song_key_rc252.cjs`

## Browser checks

58 passed, 0 failed at each of 360px, 430px, 800px and 1363px: 232 browser checks in total. Final staging commit: `1770068fcf1f3f6124148b6f7a9629b03b948bd2`. Staging deploy `dep-dbqsivpsrm7s73dr53tg` was live. The two simulated save failures use unique batch names; repeated recorder tests explicitly accept replacement only inside the isolated synthetic test. The test site uses a separate origin and blocks external requests. The audit exercises real Web Audio decoding, MP3/WAV exports, IndexedDB persistence, imports, edit/recovery flows and UI controls. Recording input and microphone refusal are simulated, not hardware tests.

## Limits

This is not a guarantee of perfect musical transcription or every device/browser combination. No new paid audio analysis was needed for this display fix. The RC251 evidence remains the live backend evidence: full Psalm 23 plus bass/chords and melody from the supplied Miracles extract. A complete five-song user ZIP, Android background behaviour, real microphone capture, external lyrics availability and real linked-folder permission persistence remain unverified end to end in this environment.
