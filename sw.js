const CACHE_NAME = 'bass-stem-studio-rc188-v1';
const APP_SHELL = ['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
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
