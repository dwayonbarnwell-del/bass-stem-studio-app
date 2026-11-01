# Bass Stem Studio RC184 audit

1 November 2026. Baseline: RC183, GitHub main 2609b2a. Scope: current frontend, its saved projects, isolated browser workflows, and read-only review of the RunPod handler and section builder. No real user work was deleted. No paid GPU jobs, GitHub Actions builds, extra Render services or backend image builds were requested. One combined frontend release is planned.

## Assessment

The tested workflows pass after the fixes below. This is not a certification that every feature works on every device. The app has 154 static buttons, 45 inputs, 37 selects and 18 dialogs; generated controls add to that inventory. All 14 navigation tools were opened, but every combination of every control has not been exhausted.

## Confirmed faults fixed

| Fault | Fix and evidence |
| --- | --- |
| A lost submission reply left no durable indication that a paid job might exist. Reopening or retrying could submit it again. | Persist an unconfirmed marker before submitting bass parts or sections. Block further submission until explicit review. Storage failure blocks submission. Simulated network failure, reopening and cancelled review tests pass. |
| Rapid selected-passage clicks could pass the busy check before an asynchronous save finished. | Set the busy state before the first asynchronous operation. Concurrent-call regression confirms one submission. |
| Opening another song discarded the pending bass job and replaced its recovery audio. | Preserve the outstanding job and its audio while allowing another song to open. Isolated browser regression passes. |
| A failed or expired bass part could remain stuck, or recovery could discard the whole group. | Keep completed parts and mark the failed part for explicit review. Retrying unlocks only failed/unconfirmed parts. No automatic paid retry. |
| Bass status requests could wait without a deadline; service replies could expose raw technical details. | Bound reads to 30 seconds and submissions to 180 seconds, never automatically retry POST, and use plain error messages. Timeouts do not cancel a paid server job. |
| Offline cache fallback did not cover an HTTP server error. | Serve the cached shell for unsuccessful shell responses when available. Network-offline, HTTP 503, missing assets, storage quota and cache-unavailable tests pass. |
| No visible way to remove the saved analysis key. | Add Forget analysis key under the existing collapsed Analysis options. Saved songs remain unchanged. Add a no-referrer page policy. |
| Three packaged regression tests referenced an obsolete pwa subdirectory. | Resolve files relative to each test. All three now run from the repository. |

## Test evidence

| Checks | Result | Limits |
| --- | --- | --- |
| Runnable Node regression suites | 19 passed, zero failures | Six older standalone Playwright suites cannot launch because that runner has no browser executable. They are not counted as passes. The supported cloud browser was used for the checks below. |
| Destructive browser regression | 34 passed, zero failures, repeated after fixes | Disposable storage and generated audio. Covers invalid projects, rapid imports, failed saves, recording storage failure, denial of microphone access, missing stems, edits, recovery, MP3/WAV export and loop boundaries. |
| RC183 saved sections and feedback | 19 passed | Synthetic low-B and solo-note audio; includes saved boundary/label/selection round trips and no cloud request on restore. |
| Media import regression | 27 passed | Synthetic WAV, MP3, M4A, AAC, AIFF, CAF, FLAC, OGG, Opus, WMA, MP4, MOV, MKV, AVI, WebM and surround WAV. Includes silent video, corrupt files, cancelled/failed conversion, HTML-link rejection and oversized metadata boundary checks. |
| Mobile interface and network audit | 27 passed at 360-pixel frame width and desktop width; 26 passed at 800 pixels before the larger-file check was added | All 14 tools opened; keyboard note editing, visible control names, unique IDs, page overflow at 11/14/22 px text and four/five/six-string views checked. Frame widths are not physical phone tests. |
| Larger real byte allocation | 180-second synthetic WAV, 7,938,044 bytes, decoded with correct duration | Observed 204 ms decode in this cloud browser. This is not an S25 performance prediction or a test of maximum-duration recordings. |
| Musical pattern calculation | 224,448 checks passed | 25 chord types, 12 roots, four/five/six-string layouts. Tests fret/note arithmetic, not musical taste or real-song transcription accuracy. |
| Backend section builder | Seven unit tests passed | Exact coverage, distinct labels, uncertainty, invalid durations and boundary handling. Source tests only; the live GPU worker was not exercised. |

The final browser failure tests deliberately log errors for corrupt input. Those expected errors are not production crashes. Browser-extension diagnostics are separate from app errors.

## Security, privacy and deployment review

- No duplicate static element IDs, embedded RunPod-key pattern or direct eval call found in the frontend scan. This is not a full dependency vulnerability or penetration assessment.
- Live site returned HTTPS, HSTS and nosniff headers. No Content-Security-Policy header was present. A strict policy needs separate compatibility testing because the app uses embedded scripts, worker blobs and downloaded models.
- The RunPod API key is still stored in browser local storage by the existing design. Forget analysis key removes it. Same-origin scripts and anyone with access to that browser profile remain within the trust boundary.
- Audio for cloud analysis goes to RunPod. Device storage holds recovery data. Offline shell support does not guarantee that a never-downloaded model or converter can run without the internet.
- Handler source validates public download destinations and redirects, limits downloads/base64 input, checks quality values and cleans temporary files. Live worker configuration, DNS-rebinding resistance and account permissions were not independently verified.
- Render is a static site with an empty build command and automatic deployment from main. No other service uses the Bass Stem Studio repository in the returned workspace inventory. Publish one combined commit; do not trigger an additional manual deployment.

## Not yet verified or still needing work

1. Real recordings with independently labelled bass notes, chords, sections, lyrics, slides, octave changes and tempo/key changes. Synthetic checks do not establish live AI musical accuracy.
2. Physical Galaxy S25, iPhone, Safari/Mac, microphone, Bluetooth delay, casting and installed-PWA behaviour. Browser layout checks cannot certify those devices.
3. Stopping a live paid cloud job. Cancelling a local operation or polling is not evidence that GPU billing stopped. No live cancellation was attempted.
4. Cross-tab/device submission races and server-side idempotency. The new persistent guard protects the tested same-browser retry paths; it is not a provider-wide exactly-once guarantee. If an upload reply is lost, check RunPod job history before allowing another submission.
5. Full screen-reader, contrast, touch-target and browser compatibility conformance; maximum-size decoded audio memory pressure; long-duration background operation.
6. Earlier planned capabilities remain incomplete: provisional sections, shared backend uploads, wider separated-instrument exports and measured replacement-model improvements. This release does not claim to implement them.

## Reproduction

Run Node .cjs suites that do not launch Playwright. Run `node tests/network_safety_rc184.cjs` for the added submission and timeout cases. Build disposable browser copies with `python3 tests/prepare_audit_rc184.py qa`, serve qa through the supported preview, and click the audit button. Use `tests/prepare_media_rc180.py` for generated media fixtures. Never insert test harnesses into the production page.
