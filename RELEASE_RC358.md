# RC358: timeline repeats and automatic song-wide alternatives

Rehearsal Note View timestamp columns can be selected individually with touch, mouse, Enter or Space. Selected columns have a purple outline and pressed state. Adjacent selections merge; separated selections play in song order, skip their gaps and return to the first selection. Back and Next browse other timestamp pages, Now resumes following playback, and Clear restores the full selected passage. These controls share the existing view-selector row. Selections survive pause/resume and genre/view changes; choosing a different passage or song clears them.

For separated selections, the backing's selected samples form one temporary audio loop. Guide notes use the same range mapping and audio-clock duration, including notes crossing a selection edge and the exact partial ending. Short edge fades avoid clicks without adding time. The original audio, chord timeline and saved phrase plan are unchanged. Original and bass-removed backing use their respective source offsets.

The chord-movement/occurrence dropdown is removed following the owner's clarification. A chosen bassline, run or fill approach is automatically fitted throughout the song at musically suitable changes. Repeating selected timestamps does not narrow that fitting scope. Guide changes take effect during the current playback loop while the backing continues, and an already sounding guide note can resume at its current age. Very short or unsuitable chord windows retain the musical fit checks instead of forcing a dense run into them.

The readout beside rehearsal time now shows the song's key and mode, or Key unknown, rather than flashing the currently sounding note. Timeline note, chord and current-time highlights remain.

Chord movements share each timestamp's compact header, with one shown at a time, rather than using extra note rows. The visible page adapts note size and, when necessary, uses two note lanes per second. The playing layout gives the remaining height to the note area without vertical scrolling. Music and Guide bass sliders hide as soon as Play loop is selected and return on pause. Rehearsal starts with Music at 21% and Guide bass at 100%; later manual changes remain adjustable. Dense source fills can use more of the existing source chord's time when needed, retaining the original landing rather than silently failing a fixed short window.

Both fret views also use the full height below the compact controls. The 390-pixel phone check measured about 499 pixels for each board instead of the earlier short panel. Note-column sizing is scoped to Note View.

Timing & chords is removed. The passage selector uses the full row, and Start, End and BPM remain editable when paused. Saved song harmony and chord recovery still drive the alternatives.

Validation includes actual stereo sample ordering, adjacent/disconnected ranges, note clipping and source-position mapping, fractional endings, original/separated offsets, controller clicks and keyboard input, page selection, pause/resume, clearing and uninterrupted source changes. The existing 120-case phrase partition suite and harmony checks remain. A further 60 genre/type combinations confirm alternatives across both the beginning and ending of a multi-change song. Browser QA uses the real app in a 390-pixel frame.

Application, rehearsal scripts, stylesheet and offline-cache versions are RC358. Publishing follows the owner's standing authorisation.
