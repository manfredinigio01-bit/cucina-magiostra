'use strict';
/* ===================== BLOCCO / PRIMO AVVIO ===================== */
let lockT=null;
function armLock(){ clearTimeout(lockT); if(RICORDATO) return; lockT=setTimeout(lockNow,LOCK_MIN*60000); }
['pointerdown','keydown','wheel','touchstart'].forEach(ev=>addEventListener(ev,()=>{ if(KEY) armLock(); },{passive:true}));
async function lockNow(){ if(dirty){ try{ await saveLocal(); }catch(e){} } KEY=null; CFG=null; S=null; location.reload(); }
function failDelay(){ const f=+(localStorage.getItem(PFX+'cuc_fail')||0); return f<3?0:Math.min(300,2**(f-2)); }

const RICORDA_GG=30; let RICORDATO=false;
async function ricordaSalva(){ if($('#rem')&&$('#rem').checked){ await kvSet('ricorda',{key:KEY,scade:now()+RICORDA_GG*864e5}); RICORDATO=true; } }
async function ricordaApri(vault){ // apertura senza password con la chiave conservata (non esportabile) di questo computer
  const r=await kvGet('ricorda'); if(!r||!r.key||!(r.scade>now())){ if(r) await kvDel('ricorda'); return false; }
  try{ CFG=await unseal(r.key,vault.box); KEY=r.key; }catch(e){ await kvDel('ricorda'); CFG=null; return false; }
  RICORDATO=true; const c=await kvGet('cache');
  try{ S=c?sanitize(await unseal(KEY,c)):emptyData(); }catch(e){ S=emptyData(); }
  reindex(); await start(); return true;
}
async function showLock(){
  const vault=await kvGet('vault');
  if(vault&&await ricordaApri(vault)) return;
  const box=$('#lockbox');
  if(!vault){
    box.innerHTML=`<img src="icons/icon-192.png" alt=""><h2>Cucina La Magiostra</h2>
    <p class="mut small">Primo avvio su questo computer. Scegli la password per aprire l'app (la stessa su tutti i computer) e incolla la chiave GitHub "Cucina". La chiave viene salvata qui <b>cifrata con la password</b>: senza password nessuno può leggerla.</p>
    <label class="f">Password (almeno 10 caratteri)<input class="i" id="pw1" type="password" autocomplete="new-password"></label>
    <label class="f">Ripeti la password<input class="i" id="pw2" type="password" autocomplete="new-password"></label>
    <label class="f">Chiave GitHub "Cucina"<input class="i" id="tok" type="password" placeholder="github_pat_…" autocomplete="off"></label>
    <label class="f">Archivio della cucina<input class="i" id="repo" value="${esc(DEF_REPO)}"></label>
    <label class="f">Nome di questo computer<input class="i" id="nome" placeholder="es. Mac Giovanni"></label>
    <div class="row"><button class="b p" data-act="setup">Collega e apri</button></div><div id="lmsg"></div>`;
    $('#pw1').focus();
  } else {
    box.innerHTML=`<img src="icons/icon-192.png" alt=""><h2>Cucina La Magiostra</h2><p class="mut small">App protetta. Inserisci la password.</p>
    <label class="f">Password<input class="i" id="pw" type="password" autocomplete="current-password"></label>
    <label class="row small" style="margin-top:10px;gap:8px;align-items:flex-start"><input type="checkbox" id="rem"> <span><b>Ricorda questo computer per ${RICORDA_GG} giorni</b>: non chiede più la password. Solo sul tuo computer personale, protetto dal suo accesso (Touch ID / password del Mac). Mai sui PC del negozio.</span></label>
    <div class="row"><button class="b p" data-act="unlock">Apri</button></div><div id="lmsg"></div>
    <p class="small mut" style="margin-top:18px">Password dimenticata? Su questo computer si può solo <a href="#" data-act="reset">cancellare l'accesso</a> e ricollegarlo con la chiave GitHub: i dati restano al sicuro nell'archivio online.</p>`;
    $('#pw').focus();
  }
}
function lmsg(t,cl='err'){ const e=$('#lmsg'); if(e) e.innerHTML=t?`<div class="${cl}">${esc(t)}</div>`:''; }
async function doSetup(){
  const p1=$('#pw1').value, p2=$('#pw2').value, tok=$('#tok').value.trim(), repo=$('#repo').value.trim().replace(/^https?:\/\/github\.com\//,'').replace(/\/$/,''), nome=$('#nome').value.trim().slice(0,40);
  if(p1.length<10) return lmsg('La password deve avere almeno 10 caratteri.');
  if(p1!==p2) return lmsg('Le due password non sono uguali.');
  if(!/^[A-Za-z0-9_]{20,255}$/.test(tok)) return lmsg('Incolla la chiave GitHub (inizia con github_pat_).');
  if(!REPO_OK.test(repo)) return lmsg('Archivio non valido: scrivilo come utente/nome.');
  lmsg('Controllo la chiave…','good');
  CFG={token:tok,repo,etiRepo:ETI_REPO,nome};
  try{
    const r=await gh('GET',`/repos/${repo}`); if(!r.ok) { CFG=null; return lmsg('Collegamento non riuscito: '+ghErr(r)); }
    const j=await r.json(); if(!j.private){ CFG=null; return lmsg('Questo archivio è PUBBLICO: costi e ricette sarebbero visibili a tutti. Rendilo privato su GitHub.'); }
    if(j.permissions&&!j.permissions.push){ CFG=null; return lmsg('La chiave può solo leggere: serve Contents "Read and write".'); }
  }catch(e){ CFG=null; return lmsg('Nessuna connessione: per il primo collegamento serve internet.'); }
  lmsg('Cifro e salvo…','good');
  const salt=crypto.getRandomValues(new Uint8Array(16));
  KEY=await deriveKey(p1,salt,PBKDF2_ITER);
  await kvSet('vault',{v:1,salt:b64(salt),iter:PBKDF2_ITER,box:await seal(KEY,CFG)});
  S=emptyData(); reindex(); await saveLocal();
  await start();
}
async function doUnlock(){
  const d=failDelay(); const last=+(localStorage.getItem(PFX+'cuc_failt')||0);
  if(d&&now()-last<d*1000) return lmsg(`Troppi tentativi: riprova tra ${Math.ceil((d*1000-(now()-last))/1000)} secondi.`);
  const pw=$('#pw').value; if(!pw) return;
  lmsg('Apro…','good');
  const v=await kvGet('vault');
  try{
    const k=await deriveKey(pw,unb64(v.salt),v.iter);
    CFG=await unseal(k,v.box); KEY=k;
  }catch(e){
    localStorage.setItem(PFX+'cuc_fail',String(+(localStorage.getItem(PFX+'cuc_fail')||0)+1)); localStorage.setItem(PFX+'cuc_failt',String(now()));
    return lmsg('Password sbagliata.');
  }
  localStorage.removeItem(PFX+'cuc_fail');
  await ricordaSalva();
  const c=await kvGet('cache');
  try{ S=c?sanitize(await unseal(KEY,c)):emptyData(); }catch(e){ S=emptyData(); }
  reindex();
  await start();
}
async function doReset(){
  if(!confirm('Cancello da questo computer la chiave e la copia locale dei dati. I dati online NON vengono toccati. Poi potrai ricollegarti con la chiave GitHub e una nuova password. Procedo?')) return;
  await kvDel('vault'); await kvDel('cache'); await kvDel('dir'); await kvDel('ricorda'); location.reload();
}
async function start(){
  $('#lock').classList.add('hidden'); $('#hdr').classList.remove('hidden'); $('#main').classList.remove('hidden');
  armLock(); render(); setStatus('Sincronizzo…');
  await sync(); loadEti().then(()=>{ etiAvvisoNuove(); etiModAvviso(); if(!EDIT) render(); });
  setInterval(()=>{ if(KEY&&!EDIT) sync(); },30000);
  addEventListener('online',()=>sync());
  dirInit();
}

