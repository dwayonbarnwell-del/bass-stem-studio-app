from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import threading,json,os,sys,re
from playwright.sync_api import sync_playwright
os.chdir(Path(__file__).resolve().parents[1])
probe='--probe' in sys.argv
song_count=1 if probe else json.loads(Path('tests/reggae_phrases_rc348.json').read_text())['activeSongs']
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BASS_TEST_BROWSER'),args=['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required'])
 page=browser.new_page(viewport={'width':390,'height':850});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(120000)
 if probe:
  rows=json.loads(Path('/tmp/rc348-probe.json').read_text())['rows'];phrases={r['id']:[[0,s['duration'],s['beats'],0,1,1] for s in r['sections']] for r in rows}
  body='window.BassReggaeRecordings='+json.dumps(rows)+';Object.assign(window.BassRecordedPhrases,'+json.dumps(phrases)+');'
  page.route(re.compile(r'.*/ear-source/reggae-recordings-rc(?:347|348)\.js.*'),lambda route:route.fulfill(status=200,content_type='application/javascript',body=body))
 page.goto('http://127.0.0.1:'+str(server.server_port),wait_until='domcontentloaded')
 page.locator('#openEarTraining').dispatch_event('click');page.locator('#earSectionFills').dispatch_event('click');page.locator('#earSectionBasslines').dispatch_event('click')
 page.locator('#fillCollection').select_option('reggae')
 assert page.locator('#fillIdea option').count()==song_count
 assert page.locator('#fillExcerpt').is_visible()
 assert page.locator('#fillExcerpt option').all_text_contents()==['Verse (est.)','Chorus (est.)']
 page.locator('#fillIdea').select_option('clip:reggae-128c286eeb70')
 verse_count=page.locator('#fillNotes button').count();assert verse_count>0
 assert not page.locator('#fillHarmony').is_visible()
 # Section selection is independent of the song selector; it uses the correct original audio.
 page.locator('#fillExcerpt').select_option('phrase-1')
 assert page.locator('#fillIdea').input_value()=='clip:reggae-128c286eeb70/1'
 chorus_count=page.locator('#fillNotes button').count();assert chorus_count>0
 page.locator('#fillExcerpt').select_option('phrase-0')
 assert page.locator('#fillIdea').input_value()=='clip:reggae-128c286eeb70'
 # Old entries cannot reappear through a previous restoration or through Deleted.
 page.evaluate("""()=>{for(const id of ['line-4','marley-0'])BassPracticeCatalogue.remove('basslines',id);BassPracticeCatalogue.remove('uploaded','reggae-58297e32b171');}""")
 page.locator('#fillRestore').dispatch_event('click')
 assert not page.locator('#fillDeletedList').inner_text().lower().count('action feat')
 assert not page.locator('#fillDeletedList').inner_text().lower().count('aston barrett')
 page.locator('#fillDeletedClose').click()
 # Exercise the continuous audio-clock loop for every available section.
 result=page.evaluate('''async()=>{
 const ctx=new AudioContext({sampleRate:32000});let rendered=0,worstFrameError=0;
 for(const clip of BassUploadedCore.items.filter(c=>c.collection==='recorded-reggae'))for(let i=0;i<clip.sections.length;i++){
  const plan=BassUploadedCore.practicePlan(clip.id,'phrase-'+i),r=await BassPracticeLoop.render(ctx,plan,{...BassAccompaniment.resolve(plan),recorded:true});
  if(!r?.stems.bass||r.stems.drums)throw Error('Original mix replaced');
  const expected=clip.sections[i].duration;worstFrameError=Math.max(worstFrameError,Math.abs(r.seconds-expected)*ctx.sampleRate);
  if(Math.abs(r.seconds-expected)>.002)throw Error('Phrase timing changed');
  const samples=r.stems.bass.getChannelData(0);if(!samples.every(Number.isFinite)||!samples.some(x=>Math.abs(x)>.01))throw Error('Invalid audio');
  const player=BassPracticeLoop.start(ctx,r,{repeat:true});player.stop();rendered++;
 }
 const clip=BassUploadedCore.items.find(c=>c.id==='reggae-128c286eeb70'),plan=BassUploadedCore.practicePlan(clip.id,'phrase-1',100);
 const changed=await BassPracticeLoop.render(ctx,plan,{...BassAccompaniment.resolve(plan),recorded:true});
 if(Math.abs(changed.seconds-plan.beats*.6)>.002)throw Error('Tempo change failed');
 return {rendered,worstFrameError,tempoChange:true};
 }''')
 # Dense complete phrases keep every note and paginate the visible cards.
 dense=page.evaluate("""()=>{for(const row of BassUploadedCore.items)for(let i=0;i<(row.sections?.length||0);i++)if(row.sections[i].notes.length>35)return {id:row.id,part:i,count:row.sections[i].notes.length};return null;}""")
 if dense:
  page.locator('#fillIdea').select_option('clip:'+dense['id'])
  page.locator('#fillExcerpt').select_option('phrase-'+str(dense['part']))
  assert page.locator('#fillNotes button').count()==dense['count']
  assert page.locator('#fillNotes button:visible').count()<=25
  assert page.locator('#fillNotePager').is_visible()
  page.locator('#fillNoteNext').click()
  assert page.locator('#fillNotes button:visible').count()==dense['count']-25
 page.locator('#fillIdea').select_option('clip:reggae-128c286eeb70')
 # Next advances Verse to Chorus before choosing the following song.
 page.locator('#fillNext').click()
 assert page.locator('#fillIdea').input_value()=='clip:reggae-128c286eeb70/1'
 page.wait_for_function("document.querySelector('#fillStatus').textContent.startsWith('Original mix')")
 page.locator('#fillPlay').click()
 page.locator('#fillExcerpt').select_option('phrase-0')
 # Actual UI playback and section changes must remain available without a pause.
 page.locator('#fillPlay').click();page.wait_for_function("document.querySelector('#fillStatus').textContent.startsWith('Original mix')")
 page.locator('#fillExcerpt').select_option('phrase-1');assert page.locator('#fillPlay').inner_text()=='Stop'
 page.locator('#fillPlay').click()
 assert not errors,errors
 if os.environ.get('BASS_TEST_SCREENSHOT'):page.screenshot(path=os.environ['BASS_TEST_SCREENSHOT'])
 print(json.dumps({'passed':True,'songCount':song_count,'verseNotes':verse_count,'chorusNotes':chorus_count,'noOldRestore':True,'sectionPicker':True,**result}),flush=True)
 browser.close()
server.shutdown()
