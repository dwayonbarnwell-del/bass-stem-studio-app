# Separate test environment

Production: branch `main`, https://bass-stem-studio-app-z5ja.onrender.com/.
Test: branch `staging-test`, proposed Render static site `bass-stem-studio-test-only`.
Render workspace and URL are pending confirmation. No hosted test site exists yet.

Build command: `BASS_ENVIRONMENT=test python3 scripts/build_test_site.py`
Publish directory: `test-dist`
Automatic deployment: disabled. Never change the production service's branch or build settings.

The build generates a permanent purple TEST ONLY banner, a TEST app name, and noindex metadata. A different hostname gives test its own browser storage. Do not link the real song folder to test; use copied sample files. No production credentials or user library are copied.

This first environment supports layout, import, save and local playback checks. Its content security policy blocks external connections, including online analysis, external model downloads and external lookups. It does not validate paid analysis. A later isolated analysis comparison needs explicit configuration and a spending limit.

On Render, set the same response headers recorded in generated `_headers` using the dashboard if `_headers` is not consumed: `X-Robots-Tag: noindex, nofollow` and `Content-Security-Policy: connect-src 'self' blob: data:; form-action 'none'; worker-src 'none'`. Confirm these headers before enabling worker-based tests.

Promote only reviewed application changes to main. Do not point the live service at staging-test or its test build. Check the live URL and release after each deliberate production deployment.
