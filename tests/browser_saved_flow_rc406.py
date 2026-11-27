"""A malformed saved chord must not replace the flow already on screen."""
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
    page.evaluate('openEarTraining.click(); earSectionFlow.click()')
    page.select_option('#flowGenre', 'woro')
    before = page.locator('#flowDegrees').input_value()
    page.evaluate("""() => {
      const flow = JSON.parse(localStorage.getItem('bass-ear-custom-flow-v1'));
      const prefix = 'bass-ear-flow-arrangement/';
      localStorage.setItem(prefix + 'valid', JSON.stringify({...flow, degrees: [1,4,6]}));
      localStorage.setItem(prefix + 'damaged', JSON.stringify({...flow, degrees: ['14',6,1]}));
      earSectionBasslines.click();
      earSectionFlow.click();
    }""")
    for name, expected in [('damaged', before), ('valid', '1 → 4 → 6')]:
        page.evaluate("name => { flowSaved.value=name; flowSaved.dispatchEvent(new Event('change')); }", name)
        page.evaluate('flowOpen.click()')
        assert page.locator('#flowDegrees').input_value() == expected
        message = page.locator('#flowStatus').inner_text()
        assert ('could not be opened' if name == 'damaged' else 'Opened valid') in message
    browser.close()
