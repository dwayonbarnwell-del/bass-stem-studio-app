# Ear Training functional and recovery audit

25 November 2026. Baseline: RC362, commit `5addc53c2127bd1628e5a4a9222d052a4a7e12a1`.

## Outcome

The covered current functions pass. The audit found and fixed three faults, alongside the requested focus-layout correction. This is a functional, regression and failure-recovery audit. Destructive data cases used test storage or mocked storage, with no production song deletion or account changes.

1. The inner focus outline extended into the Start, End and BPM labels. Inputs now occupy their own 20px value row with a 2px gap. The complete 44px card has one inset focus outline; inner input outlines are removed. The 16px input font and centred values remain.
2. A failed pitch-module import left a rejected preparation promise cached. Retry now reloads the module and reuses the existing limiter graph. The regression test reproduced the failure before the fix and passes afterwards.
3. A manually entered BPM outside 40–220 could remain displayed while the beat grid used a different tempo. Invalid input now restores the previous valid tempo and gives a clear range message. Clearing the field still requests automatic tempo.
4. Rapid BPM updates could leave older background preparation timers alive. One could run after closing rehearsal and access a cleared song. Updating BPM now cancels the previous pending timer. The controller test exposed the exception before the fix and passes afterwards.

## Coverage and evidence

| Area | Result and evidence |
| --- | --- |
| Lessons | 18,000 independently checked examples, 7,000 advanced examples and 4,000 keyboard cases. Both sounds and all five levels covered by current core tests. |
| Browser lessons | 32 checks passed against the current full application with actual audio voices. Notes, intervals, chords and progressions score correctly; answers stay concealed during questions; answer replay, undo, clear, Repeat and New examples work. A temporary sound-preparation error can be retried. |
| Basslines, runs and fills | 118,884 generated arrangements checked, including note register, monophonic order, timing and target landings. Cultural checks cover all 42 directed degree changes, source preservation and the additional Woro, Highlife and Ariaria material. |
| Rehearsal alternatives | 20 populated genres, 60 full-song approaches and 3,024 key/quality cases checked. Exact transition endpoints, original harmony and timing are retained. These checks do not manually certify every recorded transcription. |
| Repeats and phrases | Complete chronological phrase coverage, fractional endings and the 475-second song case pass. Multiple non-adjacent sections repeat in order, adjacent cells merge, gaps are skipped and bass/backing share their clock. Pause, resume, page browsing and source changes retain the intended selections. |
| Notes and views | Main/chord/fill/run/passing roles, slash-bass landings, uncertain harmony and suppression of false same-degree movements pass. Phone focus measurements show a 20px value row, no input outline and a 2px gap below the label. Existing half-width selectors and tall fretboards are retained. |
| Audio and mixer | Independent four-part gain and zero-mute tests pass with the 100/21/7/21 defaults. Separation fallback keeps existing recordings playable. Twenty processed pitch waveforms retain stereo, source timing and original-key samples; measured pitch error stays within 21 cents in those cases. Quiet-source normalisation, silence and shared limiting pass. |
| Interrupted preparation | Cancellation releases the worker. Twelve simultaneous requests for one source share inference. Worker failure permits a fresh retry, and successful audio-module preparation is reused. |
| Saving and opening | The 4:10 project round-trip test passes: exact folder/device saves, cold reopening, interrupted preparation, failed commit and retry, both saved mutes and bass/melody data. Existing automatic-save status tests pass. Library practice opening and catalogue checks preserve original files and stable IDs. |
| Deleted items | Individual restoration, permanent empty-state persistence, preservation of other items and atomic storage-failure handling pass on disposable test data. |
| Assets and offline dependencies | 684 playback asset references resolve to tracked repository paths, 91 offline shell dependencies exist and all 90 piano sample sizes and SHA-256 hashes match their manifest. Retired audio stays hidden. This verifies references/hashes, not a complete offline download of every recording. |
| Naming and continuity | 736 short catalogue names and 526 rehearsal choices pass their current checks. Source provenance, previous deletions, genre choices and uninterrupted transport are retained. |

Twenty-five applicable automated suites passed: `ear_accuracy_rc258`, `ear_levels_rc261`, `ear_keyboard_rc266`, `sampled_piano_rc257`, `practice_audio_rc292`, `catalogue_rc347`, `cultural_changes_rc351`, `cultural_rehearsal_rc352`, `rehearsal_changes_rc354`, `rehearsal_display_rc359`, `rehearsal_labels_rc353`, `rehearsal_phrases_rc357`, `rehearsal_repeat_rc358`, `rehearsal_rc317`, `deleted_mix_rc350`, `fl_drums_rc349`, `practice_sections_rc308`, `ear_audio_rc361`, `ear_stems_rc361`, `project_save_status_rc303`, `project_roundtrip_rc303`, `library_fills_rc264`, `library_catalogues_rc255`, `ear_failures_rc363` and `ear_assets_rc363`. Changed JavaScript syntax and whitespace checks pass.

The two library fixtures were updated to the current unreadable-file status text. Product behaviour was not weakened to satisfy an old message assertion.

## Limits and historical tests

An initial survey attempted 40 historical scripts. It was not a 40-test pass: several expect retired release layouts, groups, tempos or version strings; some omit newly required catalogue dependencies. Missing sparse-checkout source/sample files were restored before the applicable checks. Two old browser launchers required an unavailable separate Playwright browser; browser checks instead used the supported live browser. No extra browser was installed.

The isolated browser test origin reached its storage quota. It correctly displayed a save failure and retry guidance. A successful browser save/reopen could not be confirmed in that full origin, so the successful save claim above is limited to the separate folder/device round-trip and save-status tests. No existing browser storage was purged to force a pass.

A physical Android keyboard was not available. Phone widths and reduced viewport space were checked in a browser; the inner focus-outline removal is confirmed by computed layout. Native keyboard and text-selection handles still need a device check. Automatically inferred notes, chords, vocal separation and section labels remain estimates; this audit does not claim human transcription accuracy for every recording or identical results on every device.
