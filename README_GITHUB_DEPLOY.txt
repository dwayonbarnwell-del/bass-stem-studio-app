Bass Stem Studio RC162

Upload index.html, sw.js, manifest.webmanifest and icons/ to the frontend root.
The existing RC155 song-structure backend remains compatible. No backend
change is required for RC162.

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
Landscape keeps playback controls beside the timeline. Every time bar has the
same width throughout the song, including bars with longer chord names or
more notes. The layout chooses the narrowest equal-width grid that fits the
contents at the selected font size. It does not stretch individual bars or
leave gaps between them. Whole bars move into view during playback.
Compact note cards retain equal sizes and use additional columns when needed.
All notes and chords in a bar fit together without vertical timeline scrolling.
Unusually dense intervals or very large text can scale notation down to fit;
the control font preference is preserved. Six bass strings and eight frets
stay within the practice area. Notes and chords read left to right, then down
when a bar needs more than one column.

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
