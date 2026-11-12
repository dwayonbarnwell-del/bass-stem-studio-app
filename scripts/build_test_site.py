"""Build the isolated UI test site. Never use this build for production."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-dist'
if os.environ.get('BASS_ENVIRONMENT') != 'test':
    raise SystemExit('Refusing build: BASS_ENVIRONMENT must be test')
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()
folders = {'icons', 'licenses', 'ai-source', 'batch-source', 'billing-source',
           'chord-source', 'library-source', 'media-source', 'song-reference'}
files = {'index.html', 'guide.html', 'manifest.webmanifest', 'sw.js', 'ai-assets-rc201.js', 'SOUND_CREDITS.txt'}
for name in subprocess.check_output(['git', 'ls-files'], cwd=ROOT, text=True).splitlines():
    p = Path(name)
    if name in files or p.parts[0] in folders:
        dest = OUT / p
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / p, dest)
html = (OUT / 'index.html').read_text()
# Header CSP is authoritative; this meta also protects local static previews.
policy = "connect-src 'self' blob: data:; form-action 'none'; worker-src 'none'"
html = html.replace('<head>', '<head>\n<meta name="robots" content="noindex,nofollow">\n'
                    + '<meta http-equiv="Content-Security-Policy" content="' + policy + '">', 1)
html = re.sub(r'<title>.*?</title>', '<title>TEST ONLY | Bass Stem Studio</title>', html, count=1, flags=re.S)
html = re.sub(r'<link rel="canonical"[^>]*>', '', html)
html = re.sub(r'<meta property="og:url"[^>]*>', '', html)
banner = '''<style>html{border-top:44px solid #7c3aed!important}#test-environment-banner{position:fixed;top:0;left:0;right:0;z-index:2147483647;min-height:44px;box-sizing:border-box;background:#7c3aed;color:white;text-align:center;font:700 14px/20px system-ui;padding:2px 8px}#test-environment-banner small{display:block;font-size:11px;line-height:16px}</style><aside id="test-environment-banner" role="status">TEST ONLY · Bass Stem Studio<small>Separate library · Online analysis disabled</small></aside>'''
html = re.sub(r'(<body\b[^>]*>)', lambda m: m[0] + banner, html, count=1)
(OUT / 'index.html').write_text(html)
manifest_path = OUT / 'manifest.webmanifest'
manifest = json.loads(manifest_path.read_text())
manifest.update(name='TEST ONLY | Bass Stem Studio', short_name='Bass TEST', id='/bass-test', theme_color='#7c3aed')
manifest_path.write_text(json.dumps(manifest, indent=2))
(OUT / 'robots.txt').write_text('User-agent: *\nDisallow: /\n')
# Render static site headers also apply to workers; prevent outbound API jobs.
(OUT / '_headers').write_text('/*\n  X-Robots-Tag: noindex, nofollow\n  Content-Security-Policy: ' + policy + '\n')
print('Built isolated TEST ONLY site in test-dist; online analysis disabled.')
