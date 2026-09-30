Bass Stem Studio RC128 - GitHub / Render PWA package

Upload the CONTENTS of this folder to the root of the GitHub repository main branch.
The live site entry file is index.html.

Included:
- index.html                         Hosted PWA entry point based on RC128
- manifest.webmanifest              PWA manifest
- sw.js                             Service worker / offline app-shell cache
- icons/icon-192.png                PWA icon
- icons/icon-512.png                PWA icon
- Bass_Stem_Studio_RC128_Top_Packed_Notes_Release_Candidate.html
                                     Exact standalone RC128 file for reference

For the existing Render Static Site, pushing these files to main should trigger the normal automatic deployment.
After deployment, refresh once so the updated service worker can take control.
