# RC277: FretFlow layout corrections

Date: 16 November 2026
Baseline: production RC276, main 98c83e38afd58f4d113df3793121cf14d53ba50a.

## Changes

- Removed the explanatory caption, redundant fret-range text and lower tablature view.
- Added a coloured dotted connection between the exact active note on the neck and note map, plus a subtle link to the next displayed note.
- Deduplicated markers at the same string/fret; sized neighbouring markers to the available fret/string spacing.
- Widened the realistic neck with a clear gap between fretboards.
- Fixed part tabs, string selection, view selection and Hide/Show controls to fit without overlap. Button dimensions follow the existing Play control in both layouts.
- Removed the footer space when controls are hidden, while retaining playback, seeking, bass mute and Show controls. Repeat and string settings remain intact.
- Short screens use six accurately numbered frets at a time; taller screens use twelve. The window follows the current note without changing pitch or octave.
- Fixed bass mute being lost when changing analysis parts while using a prepared backing track.
- Preserved the existing Notes, Bass and Piano views and all 72 lesson recordings.

## Validation

14 browser cases passed at each of 360x800, 412x915, 844x390 and 1280x900 (56 total), using the production app with isolated synthetic test data and two analysis parts. Results and phone screenshots are alongside this document.

Tests cover exact 4/5/6-string note positions, rests, transposition, connectors, duplicate/adjacent markers, original views, horizontal and vertical fit, repeat strips and named sections, control visibility and dimensions, part switching, actual playback/half-speed/seek/repeat, audio-frequency checks for bass mute and restoration, saved-project round trips and cancellation.

The existing 459 pitch/fret assertions, playback timing, editing and African lesson regression tests passed. The lesson checks include 72 recordings and 4,512 combinations. All 34 inline JavaScript blocks and the revised renderer parse; git diff checks pass.

The browser tests exercise the app in Chromium at the four viewport sizes. Physical Android touch, background and screen-off behaviour have not been retested. Note accuracy still depends on the existing song analysis. The update does not reanalyse or alter saved song notes. No paid analysis jobs were submitted.

## Published and verified

Published 16 November 2026 at 05:52 UTC through merged PR 7:
https://github.com/dwayonbarnwell-del/bass-stem-studio-app/pull/7

Production commit: 71aac97a955d26db7345538e12d6f4e71475879f.
Render deployment: dep-dbt9k168bjmc73fcue4g, live at 05:52:16 UTC.
Live URL: https://bass-stem-studio-app-z5ja.onrender.com/

SHA-256 comparisons matched all seven checked live files: index.html, sw.js, all four FretFlow assets and the ear-training catalogue. The live browser loaded RC277 assets, opened FretFlow with five strings and showed no lower tablature or redundant caption. Screenshots and hashes are saved alongside this record.

No further publication is pending. This verification-only commit is kept on audit/rc277-live-verification to avoid an unnecessary production deployment.
