var CACHE = 'globe-v3';
var PRECACHE = ['/webgl-sphere'];

self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(PRECACHE); }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

function addCors(res) {
  var h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', '*');
  return new Response(res.body, {status: res.status, statusText: res.statusText, headers: h});
}

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var isEarth = e.request.url.indexOf('/earth.jpg') !== -1;
  var isSphere = e.request.url.indexOf('/webgl-sphere') !== -1;
  if (!isEarth && !isSphere) return;
  e.respondWith(
    caches.match(e.request).then(function(r) {
      if (r) return isEarth ? addCors(r) : r;
      return fetch(e.request).then(function(res) {
        if (res.ok) {
          var toStore = isEarth ? addCors(res.clone()) : res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, toStore); });
        }
        return isEarth ? addCors(res) : res;
      });
    })
  );
});
