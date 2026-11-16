# RC279: 1,000 additional song progressions

Date: 16 November 2026. Production baseline: RC278, main f93b941ad76d970e9b786348d4500a1025863d9c.

Exactly 1,000 missing songs from Psalmnote are appended to Song Chords in the existing numbered section layout. The new songs contain 6,318 section progressions and cover 256 artists. Catalogue totals are 2,944 songs, 2,809 with progressions and 135 existing entries still needing progressions. All 1,944 earlier records are preserved byte-for-byte after JSON normalisation, including IDs and reference history.

The public English catalogue contained 3,485 records. Available Yoruba charts were also compared. The import compares titles and existing aliases independently of artist, removes recording suffixes and punctuation, and conservatively excludes close title variants. Only source-marked verified charts with explicit supported keys and fully recognised chord symbols qualify. Unclear chords, unsupported minor-key charts and declared key changes are excluded. 1,330 unique candidates qualified; 1,000 were selected across artists. The source manifest records each URL, key, source-page hash, section count and exclusion reasons.

These are condensed harmonic references. Repeated chords and exact repeated cycles are condensed; long sections are explicitly labelled opening progressions. Unsupported section names receive neutral section numbers. No lyrics or audio are imported. Source verification is Psalmnote's designation, not independent comparison with recordings. Recording arrangements can differ.

The existing New additions filter now follows the catalogue version and shows these 1,000 additions. Psalmnote charts are honestly labelled as community references and included under Sourced progressions. Existing layout, playback, lessons, personal edits, favourites and removal storage are unchanged. The app and service worker advance to RC279 with revised asset URLs.

Validation: dedicated catalogue tests pass for all added titles, IDs, keys, number syntax, section counts, source URLs, old-record preservation, filters, edited chart merging, favourites and persisted removals. All 34 inline scripts and changed JavaScript parse. Existing RC275 editing/repeat and RC256 timing tests pass. Git diff checks pass. Old RC216/RC217 DOM fixture suites predate current UI controls and did not complete; the dedicated current tests cover the changed behaviour. Pre-publication graphical testing was unavailable in this environment. Verify the actual live list and progression layout after automatic deployment.

Publication is authorised by the user's existing instruction. Confirm the merged commit, Render automatic deployment and live asset hashes before reporting completion. Store final verification separately to avoid triggering a second production deployment.

## Live verification completed

PR #9 merged as ba04cfcbc27a0a22f00ef550653815e3068a1083. Render deployment dep-dbtb38tbedkc73d2prt0 became live at 07:33:02 UTC on 16 November 2026. The live index, catalogue, chord interface and service worker all match the tested local SHA-256 hashes.

The production browser confirms 2,944 songs and 2,809 progressions. New additions displays exactly 1,000 matching songs. A new chart opens in the unchanged section overview with the correct artist, key, numbered verses, chorus and source link. Editing and returning to the overview succeeds and saves the unchanged chart on the device. Returning to the list retains the New additions filter and all 1,000 matches. Screenshots record both the list and chart. No paid song analysis was run.
