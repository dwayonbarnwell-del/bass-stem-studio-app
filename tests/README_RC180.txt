Media import browser regression (27 checks)

From the project root, run:
  python3 tests/prepare_media_rc180.py /path/to/new-test-directory
Requires ffmpeg on PATH. Serve that disposable directory locally, open its
index.html in a browser and click Test media import. The generator creates
all required synthetic media and injects tests into an isolated application
copy. Never instrument the deployed copy.

The converter downloads from the pinned official @ffmpeg/core npm package
via jsDelivr. Other external fetch requests are blocked by the test harness.
The 34-check RC179 destructive browser audit also passed against RC180.
