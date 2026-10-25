Bass Stem Studio RC161

Upload index.html, sw.js, manifest.webmanifest and icons/ to the frontend root.
The existing RC155 song-structure backend remains compatible. No backend
change is required for RC161.

Repeat
Importing audio or an older project starts section detection in the background
using the saved analysis connection. Saved/cached sections are reused.
Tap Repeat, choose parts, then Repeat selected. Parts play in song order.
The two time cards show the current part. Edit them directly to adjust that
repeat range. Editing pauses playback; press Play when ready. X clears the
whole repeat set. Repeat again stops repeating and keeps the selected parts.

Editing
Tap a bass note inside its bar, enter the note and octave (e.g. C#2), then Save.
The editor uses the original pitch before transposition. Note timing and the
restricted practice range are preserved. Cancel closes the editor. Undo is
available in the editor and under Source & Stem. Tap a chord to correct it.
The existing Scale card transposes audio and displayed notes/chords.
Select neighbouring time cells to reanalyse a passage.

Screen
14px remains the editable font default. New songs use 1-second time cells.
An explicit interval in a saved project is preserved on import.
The app follows the device's orientation. No rotation button or orientation lock
is used. On phones, enable the device's Auto rotate setting if needed.
Font, strings, speed, BPM and interval now sit above Source & Stem.
The practice workspace fits the available viewport, including browser bars.
Landscape keeps playback controls beside the timeline. Ordinary time bars stay
narrow; a crowded bar widens only as needed for extra note/chord columns.
The layout fits all notes and chords in each bar at the same time. Compact
note cards have the same size, including single notes. Whole bars move into
view automatically during playback. No vertical scrolling is required to read
a bar. In unusually dense intervals or at a very large text setting, notation
can scale down to fit; the control font setting is preserved. Six bass strings
and eight frets stay within the practice area. Notes and chords read left to
right, then down when a bar needs more than one column.

Saved projects
Import replaces the open song. Old imports and analysis responses cannot
overwrite the replacement. Invalid original audio leaves the current song
intact; missing optional backing audio does not block a valid import.

Validation (Node.js, Playwright, Chromium)
  node tests/practice_controls.cjs
  node tests/song_sections.cjs
  node tests/project_import.cjs
  node tests/analysis_tools.cjs
  node tests/corrections_layout.cjs
PLAYWRIGHT_MODULE and CHROMIUM_PATH can point to existing installations.
The tests use local fixtures and block external paid analysis requests.
