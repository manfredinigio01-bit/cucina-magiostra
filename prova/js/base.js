/* Cucina La Magiostra — ricettario, food cost, prezzi d'acquisto.
   Dati: repository GitHub PRIVATO (ricettario.json), copia locale CIFRATA con la password (AES-GCM 256, chiave PBKDF2-SHA256).
   Nessuna dipendenza esterna a runtime: lib/ contiene fflate (zip) ed ExcelJS (xlsx), caricate da questo stesso sito. */
'use strict';
// Versione di PROVA (cartella prova/): stesso codice, dati separati (prefisso "prova_" per IndexedDB e localStorage),
// GitHub in SOLA LETTURA (nessuna scrittura né sui dati della Cucina né su quelli delle Etichette), niente file nella cartella Drive.
const PROVA=/\/prova\//.test(location.pathname);
const PFX=PROVA?'prova_':'';
if(PROVA){ // ben riconoscibile e non installabile come app
  document.title='PROVA – '+document.title;
  document.querySelector('link[rel="manifest"]')?.remove();
  document.body.insertAdjacentHTML('afterbegin','<div id="provabar" style="background:#ffd54a;color:#3a2a00;padding:6px 20px;font-weight:600;font-size:13px;text-align:center">VERSIONE DI PROVA — dati separati da quelli veri; GitHub si legge ma non si modifica. Per il lavoro vero usa la versione normale.</div>');
}
const APP_VERSION='1.5.2';
const DEF_REPO='manfredinigio01-bit/magiostra-cucina-dati';
const ETI_REPO='manfredinigio01-bit/etichette-magiostra-dati';
const DATA_FILE='ricettario.json';
const GH_API='https://api.github.com';
const PBKDF2_ITER=600000;
const LOCK_MIN=30;
const REPO_OK=/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const ID_OK=/^[A-Za-z0-9_-]{1,80}$/;

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=()=>Date.now();
const uid=p=>p+now().toString(36)+Math.random().toString(36).slice(2,6);
const num=v=>{ if(v===''||v==null) return null; const n=typeof v==='number'?v:parseFloat(String(v).replace(',','.')); return Number.isFinite(n)?n:null; };
const eur=v=>v==null||!Number.isFinite(v)?'–':v.toLocaleString('it-IT',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
const banco=r=>r.prezzoBanco==null?'–':r.prezzoBanco.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+(r.unitaBanco||'€');
const eur3=v=>v==null||!Number.isFinite(v)?'–':v.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:3})+' €';
const pct=v=>v==null||!Number.isFinite(v)?'–':Math.round(v*100)+'%';
const fmt=(v,d=3)=>v==null||!Number.isFinite(v)?'':(+v.toFixed(d)).toLocaleString('it-IT',{maximumFractionDigits:d});
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const dIT=s=>{ if(!s) return ''; const d=new Date(s); return isNaN(d)?String(s):d.toLocaleDateString('it-IT'); };
function toast(t,ms=2200){ const e=$('#toast'); e.textContent=t; e.classList.add('on'); clearTimeout(toast.t); toast.t=setTimeout(()=>e.classList.remove('on'),ms); }

/* ===================== CIFRATURA ===================== */
const TE=new TextEncoder(), TD=new TextDecoder();
function b64(u8){ let s=''; for(let i=0;i<u8.length;i+=0x8000) s+=String.fromCharCode.apply(null,u8.subarray(i,i+0x8000)); return btoa(s); }
function unb64(s){ const b=atob(s); const u=new Uint8Array(b.length); for(let i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u; }
async function deriveKey(pw,salt,iter){
  const base=await crypto.subtle.importKey('raw',TE.encode(pw),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function seal(key,obj){ const iv=crypto.getRandomValues(new Uint8Array(12)); const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,TE.encode(JSON.stringify(obj))); return {iv:b64(iv),ct:b64(new Uint8Array(ct))}; }
async function unseal(key,box){ const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(box.iv)},key,unb64(box.ct)); return JSON.parse(TD.decode(pt)); }

/* ===================== IndexedDB (chiave/valore) ===================== */
const IDB={db:null};
function idb(){ return IDB.db||(IDB.db=new Promise((res,rej)=>{ const r=indexedDB.open(PFX+'cucina-magiostra',1); r.onupgradeneeded=()=>r.result.createObjectStore('kv'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); })); }
async function kvGet(k){ const db=await idb(); return new Promise((res,rej)=>{ const r=db.transaction('kv').objectStore('kv').get(k); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function kvSet(k,v){ const db=await idb(); return new Promise((res,rej)=>{ const t=db.transaction('kv','readwrite'); t.objectStore('kv').put(v,k); t.oncomplete=()=>res(); t.onerror=()=>rej(t.error); }); }
async function kvDel(k){ const db=await idb(); return new Promise((res,rej)=>{ const t=db.transaction('kv','readwrite'); t.objectStore('kv').delete(k); t.oncomplete=()=>res(); t.onerror=()=>rej(t.error); }); }

