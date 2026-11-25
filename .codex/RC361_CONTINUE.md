# RC361 Ear Training continuation checkpoint

Status: NOT implemented, tested or published. The execution environment became unavailable on 25 November 2026 during the first source edit. The attempted apply_patch was interrupted without a result. Check local git status if the original workspace returns. There may be uncommitted, unreferenced draft files, but main is unchanged. This checkpoint is on a separate branch so it does not trigger the main Render deployment.

## Verified baseline

- Repository: dwayonbarnwell-del/bass-stem-studio-app
- Main commit: b814b38d64f850fcc5e1936499b1f4adf0dc4b0b (RC360)
- Tree: 1239140937ccebcefd1adfa824ea7237a6b9e357
- Live URL: https://bass-stem-studio-app-z5ja.onrender.com/
- Render service: srv-db6eecrbc2fs73brimj0
- Render workspace: tea-db6e5hqd0e5s73adkrr0
- Successful live deploy at baseline: dep-dc3a9us9v7es73fqubsg, 25 Nov 2026 09:07:12.654711 UTC
- Auto-deploy main is enabled. Do not trigger a duplicate manual deployment.
- The owner has standing authorisation in AGENTS.md to publish completed Bass Stem changes. Do not ask again.
- Do not modify Acorns or its deferred automation as part of this work.

## Latest requested changes

Apply across Ear Training Basslines, Runs, My fills and Rehearsal:

1. Centre BPM and time values.
2. Independent Voice volume slider and mute. Vocals must actually be separated from Others, not merely renamed.
3. New default Bass 100%, Drums 21%, Others 7%. Voice default was not specified. The assistant stated it would use 21% while retaining adjustment.
4. Improve audible loudness for quiet recordings without clipping or defeating the user's chosen fader balance.
5. Equal Others, Drums and Voice mute controls in one row, using clear speaker/mute and instrument icons with full accessible names.
6. Remove visible Recorded mix, Recorded bass & backing, similar technical labels, and duplicate bottom BPM. Keep accuracy/confidence information in relevant tooltips rather than falsely implying manually verified separation.
7. Editable key in recorded Basslines as well as generated Runs/Fills/Basslines and Rehearsal. Transpose real pitched audio and displayed notes/chords together, keeping tempo, exact loop windows and harmony timings.
8. Short key label such as Key: Ab Maj, rather than Key: A♭ major (est.). Unknown keys should remain honest.
9. Key, BPM and Original/Reset should be three equal cards matching Play/Stop, Repeat and Next.
10. Preserve RC359/360 layouts, tall fretboards, independent source provenance, names <=12, deletions, musical fit, whole-song alternatives, pause/resume and timeline repeat selection.

Keep progress and final messages brief, British English. No extra permission request.

## Main implementation findings

### ear-source/study-ui-rc267.js

- Current defaults bassVolume=1, drumVolume=.5, keyVolume=.5; saved settings bass-practice-accompaniment-v4. Migrate once to v5 defaults, preserving sound choices and subsequent edits.
- backing and drums booleans and level(part,value) route current transport gains; add voice boolean/level.
- clipControls currently hides fillKey for imported recordings and shows fillRecordedKey output.
- draw imported branch uses U.practicePlan; displays a long estimated key string. Need a per-source target tonic and immutable transposed plan, carrying semitones for actual recording audio.
- Generated settings already support tonic key selection; keep source mode.
- init HTML currently nests BPM and Original/Reset into fillTempoWrap and places key as another half-width cell. Make a separate 3-card row.
- fillPlayer has Play/Repeat/Next plus Other/Chords and Drums only; split transport row and 3 equal mute controls, adding Voice.
- Mixer currently has Drum/Key/Bass sliders; add Voice, shorten labels to Drums/Others/Bass/Voice.
- soundSettings shows Recorded bass & backing and Estimated instrument separation. Remove visible implementation labels; keep tooltip honesty.
- tick status currently repeatedly appends Recorded mix / Original mix / Suggested chords / Playing and BPM. Remove duplicate persistent technical/BPM text while retaining useful loading/error feedback.
- updatePlayback renders replacement before switching on the audio clock; preserve continuity. Add separate voice level and actual recording pitch processing.
- Streaming fallback playRecording uses Audio.preservesPitch for tempo but currently cannot transpose and treats recording as bass. Do not silently claim full mixer/transposition if a fallback cannot provide it.

### ear-source/practice-loop-rc292.js

- originalMix decodes cached original asset and time-stretches to frame count using loop-tempo-worker.js.
- Existing stored originalMix has 6 channels: stereo bass, stereo drums, stereo others INCLUDING vocals.
- Current render unpacks bass/drums/chords and applies gain=min(1,.88/sumOfAllStemPeakBounds), causing low output with default reduced faders.
- start uses per-stem gains and a shared master connected directly to destination. Extend with voice, 100/21/7 defaults, sensible per-stem normalisation and peak limiting.
- Existing phrase packs have 3 mono bass/drum/backing channels; generated studies have no vocals. Do not fabricate a vocal track; disable the Voice control with an explanatory accessible tooltip where absent.
- Preserve loop sample count, odd progression drums phase and crossfade changes.

### fretflow-source/practice-stems.js

Existing browser neural separation worker provides four actual stems:
0 drums, 1 bass, 2 other, 3 vocals.
Model URL already in index.html:
https://huggingface.co/t4t2k1m/yt-precount-scnet-tran-onnx/resolve/main/scnet-tran-core-2.75s-v1.onnx

Current mode mapping:
- rehearsal => [[0,2],[1],[3]], 6 channels music/bass/vocals.
- practice => [[0,2,3],[1]], 4 channels.
Add a new mixer mode [[1],[0],[2],[3]] for 8 channels bass/drums/other/voice; preserve old modes and common timing/weighting. Exclude mixer mode from individual peak normalisation, so stems retain relative source amplitude.

Use this existing approved browser model/runtime, caching results by asset/source identity. Do not import Python onnxruntime: AGENTS.md specifically records a telemetry rejection for that Python runtime. Existing browser inference is a separate, already-used code path.

For 6-channel practice recordings reconstruct the stereo original by summing 3 stem pairs. Run 4-stem separation. Preserve the high-quality stored isolated bass, use new separated drums and voice, and derive Others = original - stored bass - drums - voice. All sources must remain on the same sample clock. Cache and cancel/serialise appropriately. Do not merely assign the former Others to Voice.

### fretflow-source/backing.js and rehearsal stems

Main song mute cache already separates vocals from music:
availableBlobs[0] = drums+other
availableBlobs[1] = bass
availableBlobs[2] = vocals

Saved format version2 holds these 3 stereo WAV/FLAC blobs.
bandExcerpt(start,end) currently sums music+vocals into stereo.
rehearsalBand uses 10-second blocks, shares cached 20-second preparation parts, otherwise calls api.extract returning 6 channels.
Main api.extract hook at index.html ~21361 calls separatePracticeStem(...,'rehearsal').

Add an independent rehearsal stems API preserving compatibility with existing saved project format:
- Reuse saved separate vocal/bass data rather than rerunning all vocal inference unnecessarily.
- Split remaining instrumental music into drums/other with an honest estimated method, or use new mixer neural mode when no saved stems are available.
- Keep cancellation, same-song checks and cache behaviour.
- Account for full songs (7:55): do not allocate multiple redundant 8-channel full-song copies or require a whole-song offline pitch render on every key change.

### ear-source/rehearsal.js

- Current Music21 slider controls one combined stereo band; Guide100 independent synth.
- New request supersedes previous band defaults. Need Drums21/Others7/Voice (21 chosen) plus Bass/Guide100. Preserve original bass mute and guide mute.
- Current original bass toggle changes combined source between full song and no-bass stereo. With separate stems toggle its bass gain without reintroducing vocals through the original source.
- prepareBand/mix/startBand manage extracted band. startBand currently one source->Music gain->destination.
- Must route stem gains independently; R.pack supports arbitrary channel counts but full-song memory needs care.
- Current rehearsalCue output shows stable Key · C major. Make it an accessible tonic selector or button, short label, carrying actual mode. Do not claim changing a major recording into minor merely by shifting pitch.
- Fit alternatives against original song harmony, then transpose guide notes, chord display and actual pitched backing consistently. Never mutate saved original analysis.
- Key change during playback must retain clock, phase, selected repeat sections and view.
- Existing C.repeat PCM helpers handle merged neighbours/disconnected gaps, original song offsets.
- Compact mode hides setup/sliders immediately on Play, pause keeps compact view, gear shows setup explicitly.
- Keep both 550px fretboard views, adaptive Note View notes and equal 4-button rehearsal transport.

### Shared loudness and pitch

index.html lines48–82 define window.BassAutoLevel:
- LevelEngine 10ms look-ahead limiter, -1dB ceiling, 120ms release.
- Also has automatic post-fader loudness gain1..4 to RMS .15849; this would partly undo chosen low faders.
- Add optional normalise:false / limiter-only mode for new Ear Training bus, preserving all existing main-player defaults and worklet/fallback behaviour.
- Include processing latency in visual clock so note highlighting matches heard audio.
- Prefer fixed per-stem active-RMS normalisation (bounded boost, no amplification of silence) plus a shared limiter. Test actual RMS/peaks and independent zero/mute values.

Main index also has an existing RehearsalPitchShift class (~17105) using modulated delays, but empirical mappings may not accurately match semitone steps.
Draft approach under investigation: a shared deterministic real-time pitch processor, two complementary crossfaded read heads with pitch ratio 2^(semitones/12), fixed average delay. Route pitched bass/other/voice together, drums through an equal fixed delay; generated guide is already transposed and uses that fixed delay. AudioWorklet preferred with compatible fallback. Test measured sine frequencies, stereo phase, tempo/onset drift, zero-shift transparency and abrupt key changes. Do not ship an untested algorithm just because the environment is down.

The interrupted patch attempted to create audio-dsp-rc361.js, pitch-worklet-rc361.js and ear-audio-rc361.js. They were only scaffolding, unreferenced, and are not a verified implementation. Check carefully before reusing.

## Styling

ear-source/trainer-rc267.css uses @layer bass-ear-267 with important overrides.
- fill-actions currently 6 columns, first3 span2, final2 span3. Make 3 equal transport and 3 equal mute controls.
- fillTempoWrap currently flex; fillTempo width62 and left aligned. Flatten/centre.
- imported section settings currently six columns, key/tempo eachspan3. Replace with explicit full-width 3-card row.
- RC360 rehearsal times already flat44px cards, centred values; keep them.
- Key captions <=12; abbreviated Maj/Min, ASCII flats.
- Existing Orig/Guide word+speaker icons below words pattern can be reused.
- Keep 320/390/430px phone layouts and adaptive note height.

## Checks to complete before publishing

- Actual spectral key transposition, exact recording duration, drums timing unchanged, display notes/key/chords agree.
- Voice fader/mute zero changes actual isolated vocals; Others mute retains vocals and vice versa.
- Active-RMS normalisation raises quiet recordings, silence stays silent, limiter prevents clipping, user volume balance remains meaningful.
- Defaults at actual gain nodes: Bass100/Drums21/Others7/Voice21. Later edits persist.
- Both synthetic studies and recorded Reggae/Bass Lady/Bassmatics/World/cultural clips.
- Rehearsal full song and phrase loops; pause/resume, changing keys/styles while playing, timeline multi-repeat and gap skipping.
- Existing tests: deleted_mix_rc350.cjs (old default assertions require update), practice_mix_audio_rc350.py, recording_practice_rc331.cjs, practice_sections_rc308.cjs, rehearsal_rc317.cjs, rehearsal_repeat_rc358.cjs, rehearsal_changes_rc354.cjs, rehearsal_display_rc359.cjs, rehearsal_labels_rc353.cjs.
- Phone equal-card/centre alignment, no visible technical duplicate labels or overflow, both tall fretboards.
- Update APP_VERSION, asset queries, SW cache and release notes only after functionality verified.

## Preview/publish workflow when workspace returns

Original checkout: /workspace/scratch/583d01d0ce7b/bass-stem-studio-app
Preview helper: tests/prepare_rehearsal_preview_rc357.py <preview-root>
Use sites-preview CLI and CUA if available; no Playwright CLI.
Earlier preview root: /workspace/scratch/583d01d0ce7b/bass-rc358-preview
Phone wrapper mobile.html gives390/320/430px iframe.
Close Ear modal before choosing external QA fixture controls.
Existing live browser tab was4, but browser tools were removed when environment became unavailable.

Git CLI has no push credentials. Use GitHub create_tree/create_commit/update_ref with expected_sha, and verify tree SHA against local git write-tree before moving main. Index is2.9MB: raw contents API may reject, but git/blobs/<known-local-blob-SHA> fetch returns UTF8 HTML and works. Do not print large source payloads.
Publishing main auto-triggers Render. Observe exact commit until successful live deployment. Never publish incomplete checkpoint code or claim audio/browser checks passed when they were not run.
