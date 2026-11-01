From the PWA root, run Node tests individually, e.g.:
node tests/offline_rc179.cjs
node tests/delay_recovery_patterns_rc178.cjs

For destructive browser checks, use a disposable preview copy of index.html.
Insert isolate_rc179.js in an inline script immediately after <head>.
Insert destructive_browser_rc179.js inside the main closure immediately before:
  setPracticeVisualMode('timeline');
  rebuildNoteSidebar();
Serve this copy locally and click Run destructive audit. Tests use synthetic
audio and separate storage names. Do not inject tests into the deployed app.
The final line must show DONE 34 passed; 0 failed. AI and microphone permission
are deliberately simulated in the recorder test, using a generated audio stream.
The test needs browser access to the app's pinned lamejs encoder script for MP3.
