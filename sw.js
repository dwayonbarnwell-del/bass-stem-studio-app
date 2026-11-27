const CACHE_NAME = 'bass-stem-studio-rc385-transitions';
const APP_SHELL = ['./ear-source/transitions-rc385.js?v=rc385','./ear-source/recording-voice-worker.js?v=rc383','./ear-source/genre-scores-rc382.js?v=rc385','./ear-source/practice-series-rc373.js?v=rc385','./audio/bass-rc346/backup-b1.wav','./ear-source/expressive-studies-rc365.js?v=rc385',"./ear-source/audio-dsp-rc361.js?v=rc365", "./ear-source/ear-audio-rc361.js?v=rc384", "./ear-source/pitch-engine-rc361.mjs", "./ear-source/pitch-worklet-rc361.js?v=rc368", "./ear-source/band-split-worker-rc361.js", "./ear-source/vendor/soundtouch/core/CircularSampleBuffer.js", "./ear-source/vendor/soundtouch/core/SoundTouch.js", "./ear-source/vendor/soundtouch/core/SampleBufferAdapter.js", "./ear-source/vendor/soundtouch/core/RateTransposer.js", "./ear-source/vendor/soundtouch/core/SampleBuffer.js", "./ear-source/vendor/soundtouch/core/interpolationStrategyRegistry.js", "./ear-source/vendor/soundtouch/core/StretchPipe.js", "./ear-source/vendor/soundtouch/core/AbstractSamplePipe.js", "./ear-source/vendor/soundtouch/core/FifoSampleBuffer.js", "./ear-source/vendor/soundtouch/core/Stretch.js", "./ear-source/vendor/soundtouch/core/testFloatEqual.js", "./ear-source/vendor/soundtouch/core/index.js", "./ear-source/vendor/soundtouch/lanczos/index.js",'./ear-source/original-studies.js?v=rc347','./ear-source/world-methods-rc350.js?v=rc350','./ear-source/practice-mix-data-rc350.js?v=rc350','./ear-source/loop-tempo-worker.js','./ear-source/groove-library.js?v=rc345','./ear-source/fl-drums-rc349.js?v=rc349','./ear-source/practice-drums-rc292.js?v=rc336','./ear-source/recording-phrases.js?v=rc334','./ear-source/drum-stretch-worker-rc294.js?v=rc334','./ear-source/drum-stretch-rc294.mjs?v=rc334','./fretflow-source/stem-encoder.js?v=rc329','./vendor/libflac/libflac.min.wasm.js','./vendor/libflac/libflac.min.wasm.wasm','./library-source/scan-worker-rc295.js?v=rc364','./library-source/project-json.js?v=rc364','./ear-source/bass-register-rc292.js?v=rc365','./ear-source/fingered-bass-rc346.js?v=rc366','./ear-source/practice-audio-rc292.js?v=rc369','./ear-source/drum-loops-data-rc294.js?v=rc294','./ear-source/supplied-drums-rc294.js?v=rc352','./ear-source/study-display-rc294.js?v=rc380','./ear-source/drum-stretch-worker-rc294.js','./ear-source/drum-stretch-rc294.mjs','./ear-source/practice-loop-rc292.js?v=rc384','./ear-source/practice-keys-rc293.js?v=rc293','./ear-source/accompaniment-rc293.js?v=rc381','./ear-source/groups-rc290.js?v=rc366','./ear-source/curated-rc289.js?v=rc385','./song-view/core.js?v=rc308','./song-view/view.js?v=rc324','./song-view/view.css?v=rc325','./fretflow-source/controls.js?v=rc303','./fretflow-source/controls.css?v=rc325','./fretflow-source/core.js?v=rc277','./fretflow-source/view.js?v=rc325','./fretflow-source/practice-stems.js?v=rc361','./fretflow-source/backing.js?v=rc361','./fretflow-source/bass-evidence.js?v=rc315','./fretflow-source/view.css?v=rc320','./ear-source/african-data-rc274.js?v=rc274','./ear-source/lesson-data-rc272.js?v=rc272','./ear-source/catalogue-rc269.js?v=rc381','./ear-source/uploaded-data-rc267.js?v=rc267','./ear-source/recording-grids.js?v=rc334','./ear-source/reggae-recordings-rc348.js?v=rc348','./ear-source/uploaded-core-rc267.js?v=rc381','./ear-source/catalogue-review-rc347.js?v=rc351','./ear-source/practice-rc264b.js?v=rc371','./ear-source/study-ui-rc267.js?v=rc384','./ear-source/fills-rc264.js?v=rc336','./library-source/practice-icons.js?v=rc312','./ear-source/core-rc261.js?v=rc292','./ear-source/rehearsal-core.js?v=rc365','./ear-source/phrase-view.js?v=rc343','./ear-source/rehearsal.js?v=rc367','./ear-source/trainer-rc266.js?v=rc378','./ear-source/trainer-rc267.css?v=rc366','./ai-source/sampled-piano.js?v=rc364','./vendor/lamejs/lame.min.js','./','./index.html','./guide.html','./manifest.webmanifest','./ai-assets-rc201.js','./song-reference/data.js?v=rc282','./song-reference/chords.js?v=rc312','./song-reference/chords.css','./chord-source/recovery.js?v=rc318','./ai-source/lyrics-ux.css','./library-source/saved-audio-match.css','./library-source/navigation.js','./icons/icon-192.png','./icons/icon-512.png'];
APP_SHELL.push('./ear-source/rehearsal-harmony-rc354.js?v=rc365','./ear-source/cultural-studies-rc351.js?v=rc380','./ear-source/cultural-recordings-rc352.js?v=rc352','./ear-source/rehearsal-ideas-rc352.js?v=rc382');
async function installShell() {
  const cache = await caches.open(CACHE_NAME);
  const catalogue = APP_SHELL.find(path => path.startsWith('./song-reference/data.js?'));
  await cache.addAll(APP_SHELL.filter(path => path !== catalogue));
  // Some browsers download this large script but reject its network stream in Cache.addAll.
  const response = await fetch(catalogue, {cache: 'reload'});
  if (!response.ok || response.status === 206) throw new Error('Incomplete offline chord catalogue');
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength) throw new Error('Empty offline chord catalogue');
  await cache.put(catalogue, new Response(bytes, {
    headers: {'Content-Type': response.headers.get('Content-Type') || 'application/javascript'}
  }));
  await self.skipWaiting();
}

self.addEventListener('install', event => {
  event.waitUntil(installShell());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('bass-stem-studio-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const shell=APP_SHELL.some(path=>new URL(path,self.registration.scope).pathname===url.pathname);
  const navigation=event.request.mode==='navigate';
  if(!shell&&!navigation)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME).catch(()=>null);
    try{
      const savedPage=navigation&&cache?await cache.match(new URL('./index.html',self.registration.scope).href):null;
      let timer;
      const request=savedPage?new AbortController():null;
      if(request)timer=setTimeout(()=>request.abort(),3500);
      let response;
      try{response=await fetch(event.request,request?{signal:request.signal}:undefined);}
      finally{clearTimeout(timer);}
      if(shell&&response.ok&&response.type==='basic'&&cache){
        const copy=response.clone();event.waitUntil(cache.put(event.request,copy).catch(()=>{}));
      }
      if(!response.ok&&cache){
        const saved=await cache.match(event.request).catch(()=>null);
        if(saved)return saved;
        if(navigation){const page=await cache.match(new URL('./index.html',self.registration.scope).href).catch(()=>null);if(page)return page;}
      }
      return response;
    }catch{
      const hit=cache?await cache.match(event.request).catch(()=>null):null;
      if(hit)return hit;
      if(navigation&&cache){const page=await cache.match(new URL('./index.html',self.registration.scope).href).catch(()=>null);if(page)return page;}
      return new Response('Unavailable offline.',{status:503,headers:{'Content-Type':'text/plain'}});
    }
  })());
});



