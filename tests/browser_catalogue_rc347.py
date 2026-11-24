from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import threading,json,os,sys
from playwright.sync_api import sync_playwright
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
os.chdir(Path(__file__).resolve().parents[1])
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('BASS_TEST_BROWSER'),args=['--no-sandbox','--disable-gpu','--autoplay-policy=no-user-gesture-required'])
 page=browser.new_page(viewport={'width':390,'height':850});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(90000)
 page.goto('http://127.0.0.1:'+str(server.server_port),wait_until='domcontentloaded')
 page.locator('#openEarTraining').dispatch_event('click');page.locator('#earSectionFills').dispatch_event('click');page.locator('#earSectionBasslines').dispatch_event('click')
 groups=page.locator('#fillCollection option').all_text_contents()
 for name in ['Gospel','Soul','R&B','Jazz','Reggae']:assert name in groups,groups
 for name in ['Gospel & Soul','Afrobeat','Highlife','Makossa']:assert name not in groups,groups
 counts={}
 for group in ['gospel','soul','rnb','jazz','reggae']:
  page.locator('#fillCollection').select_option(group);counts[group]=page.locator('#fillIdea option').count();assert counts[group]>0
 assert counts['reggae']==53,counts
 assert page.locator('#fillDrums').is_hidden()
 # Delete twenty unrelated runs, restore one through the actual buttons, and reload.
 ids=page.evaluate('''()=>{const ids=BassPracticeCore.runs.slice(0,20).map(r=>r.id);for(const id of ids)BassPracticeCatalogue.remove('runs',id);return ids;}''')
 page.locator('#fillRestore').dispatch_event('click')
 assert page.locator('#fillDeletedPanel').is_visible()
 target=page.evaluate('''()=>BassCatalogueReview.removed().find(r=>r.kind==='runs'&&r.id===BassPracticeCore.runs[7].id).title''')
 page.get_by_role('button',name='Restore '+target,exact=True).click()
 assert page.evaluate('(ids)=>ids.every((id,i)=>BassPracticeCatalogue.visible("runs",id)===(i===7))',ids)
 page.reload(wait_until='domcontentloaded')
 page.locator('#openEarTraining').dispatch_event('click');page.locator('#earSectionFills').dispatch_event('click');page.locator('#earSectionBasslines').dispatch_event('click')
 assert page.evaluate('(ids)=>ids.every((id,i)=>BassPracticeCatalogue.visible("runs",id)===(i===7))',ids)
 page.locator('#fillCollection').select_option('reggae')
 # An older deleted recording restores by itself and stays restored after reload.
 page.evaluate("BassPracticeCatalogue.remove('uploaded','clip-23')")
 page.locator('#fillRestore').dispatch_event('click')
 legacy_title=page.evaluate("BassCatalogueReview.removed().find(r=>r.kind==='uploaded'&&r.id==='clip-23').title")
 page.get_by_role('button',name='Restore '+legacy_title,exact=True).click()
 page.locator('#fillCollection').select_option('bass-lady')
 assert 'clip:clip-23' in page.locator('#fillIdea option').evaluate_all('(rows)=>rows.map(r=>r.value)')
 page.reload(wait_until='domcontentloaded')
 page.locator('#openEarTraining').dispatch_event('click');page.locator('#earSectionFills').dispatch_event('click');page.locator('#earSectionBasslines').dispatch_event('click')
 page.locator('#fillCollection').select_option('bass-lady')
 assert 'clip:clip-23' in page.locator('#fillIdea option').evaluate_all('(rows)=>rows.map(r=>r.value)')
 page.locator('#fillCollection').select_option('reggae')
 # Render all original mixes with their actual native timing, and exercise tempo change.
 result=page.evaluate('''async()=>{
 const ctx=new AudioContext({sampleRate:32000});let n=0;
 for(const clip of BassUploadedCore.items.filter(c=>c.collection==='recorded-reggae')){
  const plan=BassUploadedCore.practicePlan(clip.id,'phrase-0');
  const rendered=await BassPracticeLoop.render(ctx,plan,{...BassAccompaniment.resolve(plan),recorded:true});
  if(!rendered||!rendered.stems.bass||rendered.stems.drums)throw Error('Original mix replaced');
  if(Math.abs(rendered.seconds-(plan.sourceEnd-plan.sourceStart))>.002)throw Error('Wrong loop timing');
  const data=rendered.stems.bass.getChannelData(0);if(!data.some(x=>Math.abs(x)>.01)||!data.every(Number.isFinite))throw Error('Silent or invalid mix');
  n++;
 }
 const clip=BassUploadedCore.items.find(c=>c.collection==='recorded-reggae'),plan=BassUploadedCore.practicePlan(clip.id,'phrase-0',100);
 const changed=await BassPracticeLoop.render(ctx,plan,{...BassAccompaniment.resolve(plan),recorded:true});
 if(Math.abs(changed.seconds-9.6)>.002)throw Error('Tempo change failed');
 const playing=BassPracticeLoop.start(ctx,changed,{repeat:true});playing.stop();
 return {rendered:n,tempoChange:true};
 }''')
 assert not errors,errors
 print(json.dumps({'groups':groups,'counts':counts,'singleRestore':True,'reload':True,**result}),flush=True)
 if os.environ.get('BASS_TEST_SCREENSHOT'):page.screenshot(path=os.environ['BASS_TEST_SCREENSHOT'])
 browser.close()
server.shutdown()
