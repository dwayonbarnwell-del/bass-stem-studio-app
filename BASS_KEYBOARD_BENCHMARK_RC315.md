# Low keyboard and bass attribution

Unanalysed songs no longer turn low pitches from the original audio into bass notes during analysis or playback. The app checks the separated bass returned by the existing mute preparation or restored from a saved project, then screens each candidate for bass-like harmonics and detuning. For an old project that contains only automatic mix estimates, the update keeps the previous notes in song history before replacing them. Manually changed notes and existing cloud transcriptions are preserved.

## Recorded tests

Created nine controlled ten-second mixes from annotated IDMT electric bass recordings. The first three seconds contain only keyboard. The rest contains real bass with overlapping low keyboard notes. Six clips use Salamander acoustic piano. The other three use two electric piano sounds and a separate acoustic piano sound. The model and overlap processing used for mute preparation were also run on these clips.

| Result | Prior whole-mix estimates | Separated audio alone | Separated audio and tone check |
| --- | ---: | ---: | ---: |
| False bass detections in keyboard-only openings | 64 | 59 | 24 |
| Bass notes matched at the correct pitch within 80 ms, of 161 labels | 27 | 49 | 43 |
| Notes that did not match the bass reference, across all nine clips | 181 | 163 | 69 |

Across the corresponding clean bass excerpts, the pitch tracker matched 136 reference notes before the tone check and 132 after it. Dead notes do not form part of the pitch score. The new check is deliberately selective. Electric piano and bass can still be confused, and the results do not establish accuracy on finished song mixes or through the cloud analyser.

## Material

- [IDMT-SMT-Bass-Single-Track](https://zenodo.org/records/7544099) was used for evaluation. Track IDs 002, 005, 008, 011, 014 and 017 for the grand piano mixes, and 003, 009 and 016 for the other keyboard mixes.
- The tone model uses a linear score over harmonic levels and detuning. It was fitted on selected [NSynth](https://magenta.tensorflow.org/datasets/nsynth) bass and keyboard samples, the app's credited Salamander samples, and TimGM6mb MIDI tones. IDMT recordings were not used to fit the model. No reference audio was added to the app.
