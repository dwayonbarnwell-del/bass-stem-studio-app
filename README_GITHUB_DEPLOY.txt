Bass Stem Studio RC156

Upload index.html, sw.js, manifest.webmanifest and icons/ to the frontend root.
Requires the RC155 backend with song-structure-v1-allinone enabled.
Deploy and verify the backend before publishing this frontend.

The existing Scale card transposes audio and notes. Corrections contains
key-label fixes, note/chord edits, selected-passage reanalysis and history.
Choose time cells or an existing repeat range before reanalysing a passage.
Close Corrections or tap Done editing to return to normal repeat selection.

Import replaces the open song with the saved audio, notes, chords and settings.
The new song is shown before optional backing audio loads. Old imports,
recovery reads and analysis responses cannot overwrite the replacement.
A damaged original audio file leaves the current song intact with an error.
Missing optional backing audio is reported without blocking the new song.

All chord changes appear under their timestamp, in order from top to bottom.
The current chord is highlighted during playback. Purple ? means uncertain.
Tap a chord only if you want exact times or need to edit it. No names are
hidden behind a count. The display does not delete or alter analysis.

The editable 14 px default, eight-fret paging and restricted practice-octave
display are unchanged. See RELEASE_RC156.txt for changes and verification.

Regression checks (requires Node.js, Playwright and a Chromium installation):
Serve this folder on http://127.0.0.1:8151, then run:
  node tests/analysis_tools.cjs
  node tests/corrections_layout.cjs
  node tests/project_import.cjs
PLAYWRIGHT_MODULE and CHROMIUM_PATH can point to existing installations.
These checks use local fixtures and block external analysis requests.

Tap Repeat to choose Current section, Verse, Chorus, Bridge or a numbered
section. Tapping a name starts playback and repeats it; tap Repeat again
to stop repeating. Analysis finds sections separately from bass and chords.
For older saved songs, Repeat finds sections once without bass reanalysis.
Use Adjust a section for one-beat boundary changes; no time entry is needed.
Save the project after sections finish to include them in the saved file.

Additional offline fixture check:
  node tests/song_sections.cjs

RC156 clarifies section detection while it runs. The chooser shows the
current stage, elapsed time and a Keep practising button. Unavailable
Current section controls stay hidden. When detection finishes outside the
chooser, the existing Repeat card says Sections ready until opened.
Interrupted status checks can resume the same saved job with Check progress.

Section jobs and the latest completed result also match the audio content,
so reimporting the same older saved project can reuse its section analysis
even though the browser gives the imported audio a new file timestamp.
