"""Build a disposable browser test site. Requires ffmpeg on PATH."""
from pathlib import Path
import argparse
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('output', help='New directory for the isolated test site')
args = parser.parse_args()
target = Path(args.output)
target.mkdir(parents=True, exist_ok=False)
fixtures = target / 'fixtures'
fixtures.mkdir()
tests = Path(__file__).resolve().parent
html = (tests.parent / 'index.html').read_text()
isolation = (tests / 'isolate_rc179.js').read_text().replace('audit179:', 'media180:')
html = html.replace('<head>', '<head><script>' + isolation + '</script>', 1)
marker = "  setPracticeVisualMode('timeline');\n  rebuildNoteSidebar();"
assert marker in html
html = html.replace(marker, (tests / 'media_import_rc180.js').read_text() + '\n' + marker, 1)
(target / 'index.html').write_text(html)

def ffmpeg(*arguments):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *map(str, arguments)], check=True)

audio = [('wav', 'pcm_s16le'), ('mp3', 'libmp3lame'), ('m4a', 'aac'),
         ('aac', 'aac'), ('aiff', 'pcm_s16be'), ('caf', 'alac'),
         ('flac', 'flac'), ('ogg', 'libvorbis'), ('opus', 'libopus'), ('wma', 'wmav2')]
for extension, codec in audio:
    ffmpeg('-f', 'lavfi', '-i', 'aevalsrc=0.1*sin(2*PI*110*t)|0.1*sin(2*PI*220*t):s=44100:d=3',
           '-c:a', codec, fixtures / ('tone.' + extension))
for extension, codec in [('mp4', 'aac'), ('mov', 'aac'), ('mkv', 'libopus'),
                         ('avi', 'pcm_s16le'), ('webm', 'libopus')]:
    ffmpeg('-f', 'lavfi', '-i', 'color=c=blue:s=64x64:r=10:d=3',
           '-i', fixtures / 'tone.wav', '-c:v', 'libvpx' if extension == 'webm' else 'mpeg4',
           '-c:a', codec, '-shortest', fixtures / ('movie.' + extension))
ffmpeg('-f', 'lavfi', '-i', 'color=c=blue:s=64x64:r=10:d=3', '-an', '-c:v', 'mpeg4',
       fixtures / 'silent.mp4')
ffmpeg('-f', 'lavfi', '-i', 'aevalsrc=0|0|0.1*sin(2*PI*330*t)|0|0|0:s=44100:d=3:c=5.1',
       '-c:a', 'pcm_s16le', fixtures / 'surround.wav')
print('Serve this directory locally and click Test media import:', target.resolve())
