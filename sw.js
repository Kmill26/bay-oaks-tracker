const C='bayoaks-v54';
// v17.1: the app is no longer one file. Every split asset must be precached or the PWA
// breaks offline in a way that only shows up on the course with no signal.
const ASSETS=['./','./index.html','./styles.css','./manifest.json','./icon-192.png','./icon-512.png',
  './js/seed.js','./js/stats.js','./js/course.js','./js/player.js','./js/app.js'];
// v54: a new shell waits until this one is closed. Activating it under an open
// round reloads the hole when the signal blips, which is the failure mode on the back nine.
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(ASSETS)));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(n=>{
    // A 404 written into the cache becomes the offline app until the next generation.
    if(n&&n.ok){const cp=n.clone(); caches.open(C).then(c=>c.put(e.request,cp));}
    return n;
  }).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):undefined)));
});
