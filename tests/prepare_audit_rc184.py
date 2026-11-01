"""Prepare isolated UI/failure test copies; never modify the release page."""
from pathlib import Path
import sys
root=Path(__file__).resolve().parent.parent
target=Path(sys.argv[1]);target.mkdir(parents=True,exist_ok=True)
html=(root/'index.html').read_text().replace('<head>','<head><script>'+(root/'tests/isolate_rc179.js').read_text()+'</script>',1)
for name,fixture,marker in [('interface.html','interface_rc184.js','  initAnalysisTools();\n  renderBassFretboard();'),('destructive.html','destructive_browser_rc179.js',"  setPracticeVisualMode('timeline');\n  rebuildNoteSidebar();")]:
    assert marker in html
    (target/name).write_text(html.replace(marker,(root/'tests'/fixture).read_text()+'\n'+marker))
for width in [360,430,800,1280]:
    (target/f'mobile{width}.html').write_text(f'<!doctype html><title>Audit {width}</title><iframe title="Isolated audit" src="interface.html" style="width:{width}px;height:900px;border:0"></iframe>')
print(target.resolve())
