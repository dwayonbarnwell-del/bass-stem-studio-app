"""Exercise corrupt drum downloads and cached audio in a disposable browser."""
import os
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


os.chdir(Path(__file__).resolve().parents[1])
with ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler) as server, sync_playwright() as pw:
    threading.Thread(target=server.serve_forever, daemon=True).start()
    browser = pw.chromium.launch(executable_path=os.environ.get('BASS_TEST_BROWSER'))
    page = browser.new_page(service_workers='block')
    page.goto(f'http://127.0.0.1:{server.server_port}', wait_until='domcontentloaded')
    report = page.evaluate("""async () => {
      const drums = BassSuppliedDrums, cache = await caches.open('bass-supplied-drums-rc294');
      const [first, second] = drums.available.filter(row => row.genre === 'ariaria' && row.instrumentalRecording);
      const ctx = new AudioContext(), fetchAudio = window.fetch.bind(window);
      let requests = 0, fail = true;
      window.fetch = (url, options) => {
        if (url === first.url || url === second.url) requests++;
        if (url === second.url && fail) return Promise.resolve(new Response('truncated'));
        return fetchAudio(url,options);
      };
      const render = async row => {
        const buffer = await drums.render(ctx,row,Math.round(ctx.sampleRate*60/row.bpm));
        return buffer.getChannelData(0).some(x=>Math.abs(x)>.01);
      };
      await cache.put(first.url,new Response('damaged'));
      const recovered = await render(first);
      let rejected = false;
      try { await render(second); } catch { rejected = true; }
      const clean = !(await cache.match(second.url));
      fail = false;
      const retry = await render(second);
      return {recovered,rejected,clean,retry,requests};
    }""")
    assert report == dict(recovered=True, rejected=True, clean=True, retry=True, requests=3), report
    browser.close()
