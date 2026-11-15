# RC275 platform review

Baseline: RC274, ec5744a8e547813c7d7c89454037cc11cadf5165.

## Fixes

- Replaying a correction after moving a bass note no longer duplicates the moved note. Successive pitch/timing corrections and undo retain the expected notes.
- Blank correction start/end fields are rejected before changing the song.
- Repeat fields reject incomplete, negative and non-numeric input. Compact MMSS entry, natural digit carry and fractional clock seconds remain supported.
- Song Chords uses singular wording for one match and Back for navigation to filtered results.
- RC275 application and service worker versions refresh the changed assets.

## Verification, 15 November 2026

The isolated browser build passed 42 checks at each viewport: 360×800, 412×915, 844×390, 800×1000 and 1280×900. Total: 210 passing checks, no failures. The checks cover saved settings, key/transposition restoration, invalid imports preserving the current song, edits and undo, failed saves unlocking controls, import races, actual audio playback/pause/seek, playback speeds, responsive views/dialogs/font sizes, all 72 lesson listings and library duplicate prevention.

Sixteen targeted Node suites passed, including editing, automatic audio/chord/melody flows, import and failure handling, timing, navigation, saved audio matching, sections, bulk song selection, catalogue, African, reggae and lesson data. All 37 script blocks/files checked for syntax passed. The saved audio matching test was updated to accept the existing additional import option; its matching behaviour assertions were retained.

The older standalone Playwright project-import runner could not launch because its expected browser binary is absent. Equivalent import, damaged-file and round-trip scenarios passed in the supported browser audit. A previous broad historical test run had 25 failures among 79 old suites, including obsolete UI/version fixtures and unavailable historical commits. This is not a claim that every historical test passes.

## Limits

This review uses synthetic audio and an isolated library. It does not establish musical transcription accuracy for arbitrary songs. Paid RunPod analysis, real microphone capture, Android background behaviour, real device folder permissions and full live ZIP analysis were not repeated in this review. No new paid analysis was started.
