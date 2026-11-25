# Bass Stem Studio final audit · RC364

25 November 2026. Baseline: RC363, commit `ebb49e3803339e0d40d7821729060f6c144faefa`.

## Outcome

47 applicable automated suites passed. Browser checks covered the seven main practice views, playback and repeats, key and tempo changes, mute controls, settings, library search, invalid-file protection and actual MIDI/WAV/MP3 generation. The audit used disposable fixtures and did not submit new paid analysis jobs.

The main Studio was the focus. Ear Training's earlier audit remains in `AUDIT_EAR_RC363.md`. Existing music, source provenance, saved deletions and approved layouts were retained.

## Corrections

| Area | Reproduced issue | Correction and evidence |
| --- | --- | --- |
| Project reading | Small generic project reads ignored cancellation and could stall indefinitely. A stalled large stream also ignored cancellation and retained its reader. | Apply the existing 45-second inactivity deadline and abort signal to generic reads. Request cancellation and release the stream reader without waiting for an unresponsive source. Six recovery scenarios include stalled reads, a stalled cancellation and a successful retry. |
| Piano sound cache | A malformed cached manifest or undecodable cached sample failed on every retry. Fresh invalid responses could also be cached before validation. | Validate cached and fresh data. Evict only the damaged asset, request a fresh copy, and store only validated data. Healthy samples retain their existing reuse and offline behaviour. |
| Repeat accessibility | A timeline rebuild, such as a key change, retained selected cells visually but omitted their `aria-pressed` state. | Recreate the selected and unselected accessibility states with each timestamp and note cell. Both selected timestamps remained announced after a browser key change. Repeat times and playback were not altered. |
| Bass flow exports | Exports were deliberately disabled for Bass View. The owner explicitly requested enabling them during this audit. | Enable MIDI, WAV, MP3 and Print/PDF for the bass line. Use whole-song or selected repeat windows, concatenate separated windows in order, clip crossing notes and apply the displayed transposition. Use distinct bass-flow filenames and a separate export sound choice. Vocal melody exports retain their own notes and sound setting. |
| Transposed bass exports | The piano-range filter could drop low bass pitches after a downward key change. | Permit low MIDI bass pitches in the bass export path while retaining the existing vocal-piano bounds. A bass note below A0 survived MIDI and actual WAV/MP3 rendering; decoded MP3 retained its measured pitch and audible level. |

The update versions the affected project reader, dependent library worker and piano cache module and refreshes the application shell cache. Embedded instrument sample data is unchanged.

## Automated verification

Every suite below returned success on the final source. Service responses, paid analysis jobs, browser permissions and failure conditions were mocked where indicated by the tests. No live analysis submission or billable CI was required.

| Coverage | Passing suites |
| --- | --- |
| Import, uploads and failure recovery | `analysis_failures_rc250`, `import_pipeline_rc249`, `encoder_timeout_rc248`, `saved_project_playback_rc234`, `session_restore_rc254`, `studio_recovery_rc364` |
| Analysis sequencing, long songs and reuse | `section_speed_rc165`, `long_sections_rc244`, `automatic_melody_rc245`, `automatic_chords_rc254`, `piano_full_song_rc241`, `piano_cloud_rc237` |
| Chords, key, bass evidence and edits | `chord_labels_rc235`, `chord_recovery_rc236`, `music_accuracy_rc313`, `bass_source_rc315`, `song_key_rc252`, `editing_rc275`, `song_review_rc287` |
| Playback and views | `playback_timing_rc256`, `playback_polish_rc246`, `song_repeat_rc285`, `background_transport_rc312`, `bass_roll_rc297`, `fretflow_rc276`, `piano_view_rc237`, `timeline_accessibility_rc364` |
| Library, saved files and batch | `library_scan_rc295`, `library_worker_rc305`, `empty_library_rc251`, `library_melody_rc245`, `project_roundtrip_rc303`, `batch_rc203`, `batch_repair_rc209`, `song_bulk_rc221` |
| Audio formats, levels and exports | `low_bitrate_audio_rc244`, `stem_formats_rc329`, `auto_level_rc186`, `piano_audio_rc238`, `sampled_piano_rc257`, `bass_flow_exports_rc364`, `bass_flow_audio_rc364` |
| Navigation, controls, network and offline shell | `navigation_rc243`, `controls_rc188`, `network_safety_rc184`, `offline_rc179`, `offline_complete_rc312` |

Specific evidence included:

- A 4:10 portable project with more than 175 MB of embedded audio, real temporary folder writes, device-store saves, interrupted preparation, a delayed commit, failed-write retry, cold reopen, bass and melody data, saved mute audio and both mute controls.
- Real LameJS MP3 encoding and FFmpeg decoding, FLAC round trips, stereo sample handling, output bounds and quiet-audio normalisation.
- Cached job reuse, ambiguous upload protection, storage failure before submission, stale-session cancellation and bounded network retry. These tests did not contact the analysis service.
- Actual library analysis worker processing with a fake model, independent picker/scan cancellation and timeout protection.
- Synthetic musical checks for 144 chord voicings, timed changes, low bass pitches, melody pitches and rejection of silence or unsupported single-note harmony. These are controlled accuracy tests, not an accuracy percentage for arbitrary recordings.
- All 95 application shell assets reproduced exactly when offline, including the two legitimate empty type-only SoundTouch modules. Private song paths stayed outside the shell cache.

## Browser verification

The real application ran through the managed preview with local-only disposable song controls. Fixture controls are generated outside the production site by `tests/prepare_studio_preview_rc364.py`; none are included in the production HTML.

- Notes, Phrase, Bass, Piano, Fret, Fret 2 and Song views opened on desktop and at iframe widths of 320, 390 and 430 pixels. At each width the document remained within its viewport. Scrollbar-adjusted content widths were 305, 375 and 415 pixels.
- With controls hidden, both fret presentations retained the tall 12-fret layout. The two-board view measured approximately 628/593 pixels high at the 390-pixel fixture width; the single board retained approximately 593 pixels.
- Non-adjacent timeline selections, play/pause, bass/vocal mutes, key selection and BPM editing responded. Changing the key retained both selected cells and their repaired accessibility state.
- Phrase selection started its existing phrase-repeat behaviour. This audit did not redesign it into a new multi-phrase selection feature.
- Changing the timeline breakdown from one to two seconds produced 17 cells for the 32.137-second fixture, then returned to one-second cells.
- Settings and Library opened and closed, library scanning completed and search returned its empty-result message without freezing.
- A malformed saved project was rejected while the open song, notes and session remained intact.
- Vocal melody MIDI, WAV and MP3 and bass-flow MIDI, WAV and MP3 were generated through the actual UI. Files had the appropriate MIDI/RIFF/MP3 signatures and distinct filenames. The file contents were captured locally instead of being sent to a service.
- A phone-width Bass View export also accepted a downward key change and separated repeat ranges.
- Fixture data checks reported intact bass and melody notes and no uncaught application errors. Browser-extension metadata errors were excluded from application results.

## Limits and legacy fixtures

The QA browser's device store was full. Its real Save action correctly reported failure and offered Retry save rather than claiming success. No existing browser data was purged. Successful file save/reopen evidence comes from the separate temporary-file/device-store round-trip suite, not from a successful browser-store write.

A physical Android keyboard, OS screen lock, microphone hardware, real printer/PDF dialogue and every possible recording were not tested. Print/PDF verification checks the generated bass/melody note table and print dispatch. Live paid cloud jobs were not rerun; their sequencing and failure paths used controlled responses. Automatic musical transcription and source separation remain estimates.

Nine historical fixtures in the initial survey refer to retired controls, old catalogue totals or superseded source strings. They are **not counted as passes**: `automatic_audio_rc247`, `saved_audio_match_rc227`, `saved_project_numbers_rc219`, `song_view_rc284`, `song_progressions_rc282`, `library_settings_rc232`, `tools_settings_rc233`, `lyrics_ux_rc226`, `retry_controls_rc189`. Current import, library, settings, retry and view behaviour was checked by the applicable suites and browser actions above. Removed UI and retired music were not restored to satisfy old assertions.

Three maintained fixtures were refreshed: missing recovery-context dependencies were supplied to the analysis/session tests, and the offline test now compares exact asset bytes while permitting only the two known empty type-only modules. Product behaviour was not changed to satisfy obsolete tests.

Production target: [Bass Stem Studio](https://bass-stem-studio-app-z5ja.onrender.com/), existing Render static service `srv-db6eecrbc2fs73brimj0`, main-branch automatic deployment. No Acorns service was changed.
