# Additional RC312 checks

21 November 2026. Extends FUNCTIONAL_REVIEW_RC312.md.

## Passed

- Downloaded the existing Library playback check portable file in the live browser, then reopened that exported file through Open saved file. Saved mute controls became ready; bass/vocal mute toggled immediately. Bass and Piano views displayed their saved lines with 24 keys. Original file was not overwritten.
- An older Background playback check project had no backing payload and correctly started preparation. Cancel responded. This is distinct from the complete project above.
- Filesystem-backed 4:10 JSON test passed: interrupted separation recovery, exact same-folder file save, device save, failed commit/retry, cold backing restore and both mutes without separation.
- All 53 service-worker shell files returned content under simulated total network loss. Navigation with a release query and a different path fell back to cached index.html. Private songs were not intercepted; online recovery passed. Tests use production worker code with simulated network/cache APIs.
- Cached piano sound reload, rendering/export scheduling, retries and cancellation passed the existing sample engine harness. This is not a listening assessment of timbre.
- Hidden-page transport handler passed loop boundaries, selected sections/timeframes, stem sync and pause/seek guards. The main audio element repeated a 24-second song while another cloud tab was open, but the app document remained visible, so that observation does not prove hidden-tab or screen-lock behaviour.
- Default screen wake-lock acquisition/release/reacquisition and fade scheduling passed.
- Long-song upload sizing passed cases up to 19 minutes; oversized unsafe cases were rejected.
- 14 real MP3 encode/decode cases passed using the distributed LameJS encoder and FFmpeg for decoding/resampling, checking stereo audibility and excerpt duration.

## Correction

The guide still directed users to More tools for Song chords. Changed it to Library. An older offline test omitted AbortController/timer globals and was exercising its own ReferenceError fallback; added the missing harness globals and reran successfully. Added complete offline-shell and hidden-transport tests.

## Still requires another environment or the device

A browser with network-offline control for a fully disconnected live UI check; Android screen lock and app switching; microphone hardware/permission/recording; portrait/landscape viewport testing; fresh paid external cloud analysis; listening-based bass timbre and transcription accuracy; long-session device memory endurance. No new paid job was submitted. The user's real folder, files and device storage were not changed.
