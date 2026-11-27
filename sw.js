// Service worker app Cucina: prima la rete, poi la cache (funziona offline). Non tocca mai le richieste verso GitHub.
// Lo stesso file serve la versione normale e quella di prova (cartella prova/): le cache hanno nomi diversi.
const PROVA=self.registration.scope.includes('/prova/');
const CACHE=(PROVA?'prova-':'')+'cucina-v16';
const PREFISSO=PROVA?'prova-cucina-':'cucina-';
// tutti i file dell'app: servono per funzionare senza internet (stesso ordine di index.html)
const FILES=['./','index.html','stile.css',...['base','dati','foodcost','github','blocco-e-primo-avvio','schermata-quadro','schermata-ricette','schermata-ingredienti-archivio-impostazioni','cartella-drive','excel','fatture','etichette','stampa','azioni-e-avvio'].map(n=>`js/${n}.js`),'manifest.webmanifest','lib/exceljs.min.js','lib/fflate.min.js','icons/icon-192.png','icons/icon-512.png','icons/favicon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith(PREFISSO)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||!e.request.url.startsWith(self.registration.scope)) return;
  if(!PROVA&&u.pathname.includes('/prova/')) return; // la versione normale non tocca la prova
  if(u.pathname.endsWith('version.json')) return;
  e.respondWith(fetch(e.request).then(r=>{ if(r.ok){const c=r.clone(); caches.open(CACHE).then(x=>x.put(e.request,c));} return r; }).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
});
