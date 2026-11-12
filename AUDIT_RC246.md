# RC246 quality review · 12 November 2026

Baseline: RC245 (185cd5f). Existing approved features and stored data preserved.

## Fixed
- Notes view selects its active cell directly instead of querying every cell each animation frame; unchanged highlights are not repeatedly removed and recreated.
- Hidden legacy waveform/roll canvases are not redrawn.
- Piano chord strip highlights the exact active chord, including changes within the same visible page. Gaps clear the highlight.
- Tempo card shows a short beat cue from detected beat times, with a tempo-based fallback. Notes and chords retain their original timings; no forced quantisation.
- Library toolbar uses equal grid cells and row heights; close action has a distinct colour. Mobile retains two columns.
- A disconnected Library no longer claims the folder is empty. Empty and scanning messages are shorter.
- An outer batch interruption marks the active song Needs review instead of leaving it Analysing; pending job records are preserved.

## Validation
- Dedicated regression checks cover note/chord boundaries, reverse seeking, beat timing, pause clearing, invalid tempo, indexed cell access and embedded/source consistency.
- Existing tests cover synthetic chord recognition in all keys, silence/noise rejection, saved imports, full-song melody, saved melody reuse, automatic sequencing, cloud recovery and duplicate-charge safeguards.
- Live desktop inspection: main controls, More tools, Library, Song chords and return navigation. Catalogue reports 856 songs; unverified progressions remain labelled as such.
- Automated browser launch was blocked by this environment's process/socket policy. An escalation attempt was rejected by policy. Live browser inspection was used for the available visual checks.

## Limits and remaining work
This is not a claim that every feature is perfect. Real-device Android rendering, microphone capture, device folder permissions, long-song listening tests and musical accuracy against a human-verified reference remain unverified. No paid RunPod jobs were submitted for this review. The user's phone Library is not accessible here.

Older test suites contain stale expectations, missing mock APIs or missing dependencies. They were not silently changed to report success. Their baseline failures are listed below for follow-up; current coverage was run separately. Browser-only suites could not launch in this environment.

- tests/batch_rc198.cjs
- tests/batch_rc200.cjs
- tests/batch_rc203.cjs
- tests/chord_recovery_rc236.cjs
- tests/chorus_guard_rc182.cjs
- tests/delay_recovery_patterns_rc178.cjs
- tests/library_rc195.cjs
- tests/library_settings_rc232.cjs
- tests/live_church_rc208.cjs
- tests/low_bitrate_audio_rc244.cjs
- tests/lyrics_rc169.cjs
- tests/recovery_search_rc183.cjs
- tests/retry_controls_rc189.cjs
- tests/save_import_rc164.cjs
- tests/saved_project_numbers_rc219.cjs
- tests/song_reference_curation_rc218.cjs
- tests/song_reference_overview_rc217.cjs
- tests/song_reference_upgrade_rc216.cjs
- tests/sound_review_rc175.cjs
- tests/tools_settings_rc233.cjs
