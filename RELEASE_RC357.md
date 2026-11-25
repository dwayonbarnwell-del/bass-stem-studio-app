# RC357: saved rehearsal phrases in song order

The Rehearsal passage menu retains Full song. Its remaining normal options are one numbered set of chronological phrase ranges. This replaces the overlapping two-bar excerpts from sections, suggested passages and the full recording. Custom passage appears only after a manual timing edit.

Every range joins the next exactly, from zero to the original recording's precise duration. Introductions, quiet gaps and endings are retained. Planning aims for 10–15 seconds, scores measured bar lines, known section edges, harmonic returns and bass releases, and allows nearby longer or shorter boundaries where appropriate. The ranges remain automatic estimates, with precise times and section context in their option titles; they are not manually audited transcriptions. Without trustworthy timing, balanced estimated ranges still cover the complete recording.

The plan saves automatically to device analysis recovery and the normal song project, including portable JSON imports/exports. A signature invalidates a plan when the relevant timing, sections, chords or bass notes change. New songs clear the previous plan. Saved phrase playback preserves its exact endpoints rather than shortening the first or final phrase to the available interior beat grid. Full song also preserves its unrounded end. Existing movement alternatives, source choices, harmony, views, mixer settings and playback are retained.

Validation: 120 combinations of song duration, BPM and meter; a 475.544-second song with pickup, variable beats, duplicate/out-of-order section metadata and fractional ending; silent/unanalysed fallback coverage; natural 16-second returns for a repeating progression; stale/corrupt plan rejection; serialised plan reuse; real rehearsal controller tests for automatic save, reopening, fractional full-song/final-phrase playback, manual edits and continuous genre changes. The existing harmony suite checks 3,024 directed changes across keys and modes and 60 alternatives retaining exact 1:02–1:05 endpoints.

Browser checks at a 390-pixel phone width confirmed the compact labels, all 33 phrases plus Full song for a 7:55 fixture, the exact final time, automatic project saving and restoration of the saved phrase list.

The application and service-worker versions are RC357. Publishing follows the owner's standing authorisation.
