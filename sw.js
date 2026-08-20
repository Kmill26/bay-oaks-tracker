const C='bayoaks-v22';
// v17.1: the app is no longer one file. Every split asset must be precached or the PWA
// breaks offline in a way that only shows up on the course with no signal.
const ASSETS=['./','./index.html','./styles.css','./manifest.json','./icon-192.png','./icon-512.png',
  './js/seed.js','./js/stats.js','./js/course.js','./js/player.js','./js/app.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(ASSETS))); self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{
    const cp=n.clone(); caches.open(C).then(c=>c.put(e.request,cp)); return n;
  }).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):undefined)));
});
