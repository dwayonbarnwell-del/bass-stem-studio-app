Bass Stem Studio RC163

Upload index.html, sw.js, manifest.webmanifest and icons/ to the frontend root.
The existing RC155 song-structure backend remains compatible. No backend
change is required for RC163.

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
Landscape keeps playback controls beside the timeline. Time bars have one
consistent width based on the longest chord name plus a small margin, with
room for readable note cards. Bars do not stretch to fill the screen.
Chords appear one per row, reading from top to bottom. The current chord is
highlighted at its detected start/end time. Nothing is hidden behind +more.
The visible group of bars fits its notes and chords within the viewport.
A crowded passage elsewhere does not reserve empty space or reduce the text
size on the current page. Very crowded passages can fit notation smaller;
the chosen control font size is preserved. Note cards remain equal-sized
within the visible group, including single notes. Whole bars follow playback.
Six bass strings and eight frets stay within the practice area.

Saved projects
Import replaces the open song. Old imports and analysis responses cannot
overwrite the replacement. Invalid original audio leaves the current song
intact; missing optional backing audio does not block a valid import.

Validation (Node.js, Playwright, Chromium)
  node tests/uniform_bars.cjs
  node tests/practice_controls.cjs
  node tests/song_sections.cjs
  node tests/project_import.cjs
  node tests/analysis_tools.cjs
  node tests/corrections_layout.cjs
PLAYWRIGHT_MODULE and CHROMIUM_PATH can point to existing installations.
The tests use local fixtures and block external paid analysis requests.
