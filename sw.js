/* Guarda la app en el celular para que abra sin internet,
   y recibe el archivo que se comparte desde WhatsApp. */
const VERSION = 'cc-v4';
const ARCHIVOS = ['./', './index.html', './app.js', './manifest.webmanifest', './icono-192.png', './icono-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k !== VERSION && k !== 'cc-compartido').map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/recibir')) {
    e.respondWith((async () => {
      try {
        const datos = await e.request.formData();
        const f = datos.get('archivo');
        if (f && typeof f.text === 'function') {
          const c = await caches.open('cc-compartido');
          await c.put('archivo-recibido', new Response(await f.text()));
        }
      } catch (err) {}
      return Response.redirect(new URL('./?recibido=1', self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Responde con lo guardado y, por detrás, trae la versión nueva para la próxima vez
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const guardado = await c.match(e.request, {ignoreSearch: true});
    const red = fetch(e.request).then(r => { if (r && r.ok) c.put(e.request, r.clone()); return r; }).catch(() => null);
    if (guardado) { e.waitUntil(red); return guardado; }
    const r = await red;
    return r || (await c.match('./index.html')) || new Response('Sin conexión', {status: 503});
  })());
});
