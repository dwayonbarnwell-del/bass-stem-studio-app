# RC278: shared rehearsal controls

Date: 16 November 2026
Production baseline: RC277, main 71aac97a955d26db7345538e12d6f4e71475879f.

## Behaviour

Notes, Bass, Piano and FretFlow now share Hide/Show controls, Play, Pause, seeking, bass mute and vocal mute. Compact mode stays active when switching views, increases the visual workspace and retains repeat settings. Show controls stays visible. New songs show the controls again. Existing section repeats, repeat ranges, tempo, transposition, song parts and view-specific features remain available.

Bass mute preparation is available in every view. Bass and vocals can be muted independently or together. The existing SCNet extraction supplies three aligned stereo components: drums/other accompaniment, bass, vocals. They use the existing song clock, speed and pitch paths. Disabling both mutes returns to the original playback route. Existing no-bass assets remain usable without reprocessing.

Prepared backing is saved in the project as version 2, including vocals. Version 1 backing remains usable for bass mute; selecting vocal mute upgrades it. Vocal-first preparation retains bass. Changing views or song parts preserves mute choices. Cancellation and replacing a song discard unfinished preparation safely. Preparation runs on-device, may require downloading the existing model, pauses playback and can be cancelled from every view. Save the song after preparation to keep the audio for reopening.

All 72 lesson recordings and their deletion preferences are unchanged. This update does not modify saved transcription notes, chord analysis or the user's existing view choices.

## Verification

15 browser cases passed at 360x800, 412x915, 844x390 and 1280x900: 60 total. The isolated fixture uses a two-part song and synthetic audio. Checks cover all four views, control visibility and boundaries, increased compact workspace, equal header button dimensions, repeat preservation, note/fret accuracy, original views, actual playback/slow speed/seeking/repeats, independent and combined mute frequency measurements, part changes, saved-project reopening, version 1 upgrades, vocal-first preparation and cancellation from all views.

Existing suites passed: 459 pitch/range/fret checks; playback timing; note editing and repeat validation; 72 recordings and 4,512 lesson section/speed/transpose combinations. All 34 inline scripts and the three revised JavaScript modules parse. Git diff checks pass.

Screenshots show the isolated compact Piano and FretFlow layouts. Note accuracy still depends on the saved transcription. Model separation quality on individual user songs and physical Android background behaviour have not been newly benchmarked. No paid analysis jobs were submitted.

## Release checkpoint

Prepared for publication under the user's existing authorisation. Confirm the merged main commit, Render automatic deployment and live file hashes before reporting the update live. Save final evidence on a separate audit branch to avoid a duplicate production deployment.
