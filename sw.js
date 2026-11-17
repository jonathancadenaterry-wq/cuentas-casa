/* Guarda la app en el celular para que abra sin internet,
   y recibe el archivo que se comparte desde WhatsApp.
   Con internet siempre trae la versión nueva (pantalla y programa juntos);
   sin internet, o si la red tarda más de 4 segundos, usa la copia guardada. */
const VERSION = 'cc-v6';
const ARCHIVOS = ['./', './index.html', './app.js?v=6', './manifest.webmanifest', './icono-192.png', './icono-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(ARCHIVOS.map(u => new Request(u, {cache: 'reload'}))))
    .then(() => self.skipWaiting()));
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
  const nav = e.request.mode === 'navigate';
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const clave = nav ? './index.html' : e.request;
    const red = fetch(nav ? url.origin + url.pathname : e.request.url, {cache: 'no-cache', credentials: 'same-origin'})
      .then(r => { if (r && r.ok) c.put(clave, r.clone()); return r; })
      .catch(() => null);
    e.waitUntil(red);
    const espera = new Promise(r => setTimeout(() => r(null), 4000));
    const r = await Promise.race([red, espera]);
    if (r && r.ok) return r;
    const guardado = await c.match(clave);
    if (guardado) return guardado;
    return (await red) || new Response('Sin conexión', {status: 503});
  })());
});
