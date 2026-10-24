Bass Stem Studio RC153

Upload index.html, sw.js, manifest.webmanifest and icons/ to the frontend root.
This release uses the existing backend. No backend rebuild is needed.

The existing Scale card transposes audio and notes. Corrections contains
key-label fixes, note/chord edits, selected-passage reanalysis and history.
Choose time cells or an existing repeat range before reanalysing a passage.
Close Corrections or tap Done editing to return to normal repeat selection.

All chord changes appear under their timestamp, in order from top to bottom.
The current chord is highlighted during playback. Purple ? means uncertain.
Tap a chord only if you want exact times or need to edit it. No names are
hidden behind a count. The display does not delete or alter analysis.

The editable 14 px default, eight-fret paging and restricted practice-octave
display are unchanged. See RELEASE_RC153.txt for changes and verification.

Regression checks (requires Node.js, Playwright and a Chromium installation):
Serve this folder on http://127.0.0.1:8151, then run:
  node tests/analysis_tools.cjs
  node tests/corrections_layout.cjs
PLAYWRIGHT_MODULE and CHROMIUM_PATH can point to existing installations.
These checks use local fixtures and block external analysis requests.
