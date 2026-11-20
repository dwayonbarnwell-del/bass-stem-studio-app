# RC295

Library recovery and faster repeat visits.

- Folder changes and in-app storage stay available during checks. Stop checking cancels the active scan. Late results cannot replace a newly selected folder.
- Cached songs appear immediately; newly checked songs appear progressively. Metadata is saved after each new file so interrupted checks resume without starting again.
- Large project parsing and audio identity hashing use a worker. Unchanged files reuse their cached identity. Downloads load the selected file only when requested.
- Stalled file reads, folder enumeration, permission checks and device storage operations have a 15-second timeout. Existing song files are never changed by scanning.
- Kept saved audio identity, duplicate handling, melody, sections and chord catalogue rules.

Validation: cancellation and stale-result regression tests, stalled file and permission tests, cache reuse, unchanged song files, catalogue exclusion, melody/deduplication, saved-audio matching, practice library and settings tests passed. Worker validation covered a 12 MB audio field, invalid projects and chord catalogues. Browser automation was unavailable in this environment; the user's Android storage provider was not directly tested. An older RC219 catalogue-count test already assumes a superseded catalogue size.
