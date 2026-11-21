# Recorded transcription benchmark

Compared RC313 and RC314 using the app's on-device chord, bass and melody code. Audio was decoded with FFmpeg at its native sample rate. The recordings and annotations stayed outside the repository.

| Reference | Measure | RC313 | RC314 |
| --- | --- | ---: | ---: |
| GuitarSet, 7 development performances | Correct label during annotated major/minor triads | 42.2% | 76.6% |
| GuitarSet, 7 additional performances | Correct label during annotated major/minor triads | 42.5% | 69.5% |
| GuitarSet, all 14 | Correct root during annotated chord time | 32.7% | 59.8% |
| IDMT bass, 17 recordings | Labelled notes matched within 50 ms | 444 of 920 | 666 of 920 |
| IDMT bass, 17 recordings | Detected notes matched within 50 ms | 79.0% | 78.8% |
| Vocadito, 40 recordings, annotator 1 | Labelled notes matched within 50 ms | 37.8% | 51.1% |
| Vocadito, 40 recordings, annotator 2 | Labelled notes matched within 50 ms | 39.4% | 53.9% |
| Vocadito, annotators 1 and 2 | Detected notes matched within 50 ms | 56.8%, 49.8% | 50.9%, 45.0% |

The chord estimator now pools nearby frames with greater weight on the current frame. It remains limited to major/minor suggestions. On the seven additional performances, 35 of 87 reference root changes matched the same transition within 250 ms, up from 9. That timing metric allows gaps between successive predictions. The controlled 500 ms chord changes still pass.

The bass and melody estimators now sample every 20 ms and allow shorter notes. Note scores require a one-to-one match with the same rounded MIDI pitch. The bass reference excludes dead notes, which have no stable pitch. For bass notes matched within 100 ms, median absolute onset error fell from 28 to 21 ms and median absolute release error fell from 73 to 64 ms. Vocal onset errors among those matches stayed around 22–24 ms. Vocal release errors increased from roughly 31 to 47–48 ms. The vocal change catches more notes and produces more extras.

These figures cover separately recorded singing, bass and guitar. Vocal and bass comparisons are development measurements on the same recordings used to evaluate alternatives. Chord measurements against the additional tracks were run after choosing the settings on the first seven. Full-band results, advanced chord qualities, beat detection by the cloud service and fresh paid cloud transcription were outside this benchmark.

Sources

- [Vocadito v3](https://zenodo.org/records/5578807) audio and both note annotation sets, all 40 tracks.
- [IDMT-SMT-Bass-Single-Track](https://zenodo.org/records/7544099) audio and XML note labels, tracks 001–017.
- [GuitarSet v1.1.0](https://zenodo.org/records/3371780), microphone audio and performed chord annotations via the [dataset conversion](https://huggingface.co/datasets/jhartquist/guitarset). Development row indices 0, 8, 12, 24, 36, 48 and 72, and additional rows 62, 76, 94, 102, 138, 178 and 268, from the default train split.
