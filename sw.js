const CACHE_NAME = 'bass-stem-studio-rc298-practice';
const APP_SHELL = ['./library-source/scan-worker-rc295.js','./ear-source/bass-register-rc292.js?v=rc292','./ear-source/practice-audio-rc292.js?v=rc292','./ear-source/drum-loops-data-rc294.js?v=rc294','./ear-source/supplied-drums-rc294.js?v=rc294','./ear-source/study-display-rc294.js?v=rc294','./ear-source/drum-stretch-worker-rc294.js','./ear-source/drum-stretch-rc294.mjs','./ear-source/practice-loop-rc292.js?v=rc294','./ear-source/practice-keys-rc293.js?v=rc293','./ear-source/accompaniment-rc293.js?v=rc294','./ear-source/groups-rc290.js?v=rc290','./ear-source/curated-rc289.js?v=rc294','./song-view/core.js?v=rc288','./song-view/view.js?v=rc288','./song-view/view.css?v=rc288','./fretflow-source/controls.js?v=rc278','./fretflow-source/controls.css?v=rc278','./fretflow-source/core.js?v=rc277','./fretflow-source/view.js?v=rc278','./fretflow-source/backing.js?v=rc298','./fretflow-source/view.css?v=rc278','./ear-source/african-data-rc274.js?v=rc274','./ear-source/reggae-data-rc273.js?v=rc273','./ear-source/lesson-data-rc272.js?v=rc272','./ear-source/catalogue-rc269.js?v=rc291','./ear-source/uploaded-data-rc267.js?v=rc267','./ear-source/uploaded-core-rc267.js?v=rc294','./ear-source/practice-rc264b.js?v=rc294','./ear-source/study-ui-rc267.js?v=rc294','./ear-source/fills-rc264.js?v=rc294','./library-source/practice-icons.js?v=rc259','./ear-source/core-rc261.js?v=rc292','./ear-source/trainer-rc266.js?v=rc294','./ear-source/trainer-rc267.css?v=rc294','./ai-source/sampled-piano.js?v=rc257','./vendor/lamejs/lame.min.js','./','./index.html','./guide.html','./manifest.webmanifest','./ai-assets-rc201.js','./song-reference/data.js?v=rc282','./song-reference/chords.js?v=rc283','./song-reference/chords.css','./chord-source/recovery.js?v=rc254','./ai-source/lyrics-ux.css','./library-source/saved-audio-match.css','./library-source/tools-layout.js?v=rc258','./library-source/navigation.js','./library-source/tools-layout.css?v=rc258','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
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
      const response=await fetch(event.request);
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



