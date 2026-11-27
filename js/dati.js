'use strict';
/* ===================== STATO ===================== */
let KEY=null;      // chiave AES in memoria, solo a app sbloccata
let CFG=null;      // {token, repo, etiRepo, nome}
let S=null;        // dati
let ETI=null;      // archivio etichette (sola lettura salvo azioni esplicite)
let TAB='quadro', SEL=null, EDIT=null, Q='', FILT={};
let dirty=false, syncing=false, pending=false, lastSync=null;

function emptyData(){ return {version:1,updatedAt:0,parametri:{costoOrario:18,energiaOra:5,affittoMese:400,settimaneMese:4,giorniSettimana:5,oreGiorno:6,quotaAffitto:.5,iva:.1,ricaricoDef:.7,packagingDef:.5,altriFissiMese:230,note:{},updatedAt:0},ingredienti:[],packaging:[],ricette:[],archivio:[],stagionalita:[],mappaFatture:[],importati:[],fornitori:[],etiNoRic:[]}; }

/* ===================== PULIZIA DATI ===================== */
const str=(v,max=4000)=>String(v??'').slice(0,max);
const nn=(v,min=-1e9,max=1e9)=>{ const n=num(v); return n==null?null:Math.min(max,Math.max(min,n)); };
const okid=(v,p)=>ID_OK.test(String(v||''))?String(v):uid(p);
function sanitize(D){
  const o=emptyData(); if(!D||typeof D!=='object') return o;
  const P=D.parametri||{}; const po=o.parametri;
  for(const k of ['costoOrario','energiaOra','affittoMese','settimaneMese','giorniSettimana','oreGiorno','quotaAffitto','iva','ricaricoDef','packagingDef','altriFissiMese']){ const v=nn(P[k],0,100000); if(v!=null) po[k]=v; }
  po.note={}; if(P.note&&typeof P.note==='object') for(const k in P.note) if(/^[a-zA-Z]{1,30}$/.test(k)) po.note[k]=str(P.note[k],1500);
  po.updatedAt=nn(P.updatedAt,0)||0;
  o.ingredienti=(Array.isArray(D.ingredienti)?D.ingredienti:[]).slice(0,3000).map(i=>({id:okid(i.id,'i-'),nome:str(i.nome,120).trim(),fornitore:str(i.fornitore,80),prezzo:nn(i.prezzo,0,1e6),formato:nn(i.formato,0,1e5),unita:['kg','l','pz'].includes(i.unita)?i.unita:'kg',pesoPezzo:nn(i.pesoPezzo,0,1000),note:str(i.note,1500),fornitoreFisso:!!i.fornitoreFisso,surgelato:!!i.surgelato,nomeEtichetta:str(i.nomeEtichetta,120).trim(),composizione:str(i.composizione,2000).trim(),
    storico:(Array.isArray(i.storico)?i.storico:[]).slice(-60).map(s=>({data:str(s.data,20),prezzoUnit:nn(s.prezzoUnit,0,1e6),prima:nn(s.prima,0,1e6),fornitore:str(s.fornitore,80),fattura:str(s.fattura,40),voce:str(s.voce,200)})),
    updatedAt:nn(i.updatedAt,0)||0,deleted:!!i.deleted})).filter(i=>i.nome);
  o.packaging=(Array.isArray(D.packaging)?D.packaging:[]).slice(0,300).map(p=>({id:okid(p.id,'p-'),nome:str(p.nome,120),fornitore:str(p.fornitore,80),prezzo:nn(p.prezzo,0,1e6),pezzi:nn(p.pezzi,0,1e6)||1,updatedAt:nn(p.updatedAt,0)||0,deleted:!!p.deleted})).filter(p=>p.nome);
  o.ricette=(Array.isArray(D.ricette)?D.ricette:[]).slice(0,3000).map(r=>({id:okid(r.id,'r-'),nome:str(r.nome,140).trim(),foglio:str(r.foglio,40),categoria:str(r.categoria,60),unita:str(r.unita,80),allergeni:str(r.allergeni,300),note:str(r.note,2000),
    righe:(Array.isArray(r.righe)?r.righe:[]).slice(0,60).map(x=>({ing:x.ing&&ID_OK.test(x.ing)?x.ing:null,ric:x.ric&&ID_OK.test(x.ric)?x.ric:null,nome:str(x.nome,120),dose:nn(x.dose,0,10000),doseTesto:str(x.doseTesto,40),flag:str(x.flag,20)})),
    procedimento:str(r.procedimento,20000),lotto:nn(r.lotto,0,10000),tProd:nn(r.tProd,0,100000),tCott:nn(r.tCott,0,100000),perdita:nn(r.perdita,0,.99),ricarico:nn(r.ricarico,0,100),confezione:nn(r.confezione,0,100000),
    vendita:r.vendita==='pezzo'||r.vendita==='kg'?r.vendita:(/pz|porzione/.test(String(r.unitaBanco||''))?'pezzo':'kg'),packaging:r.packaging&&ID_OK.test(r.packaging)?r.packaging:'',pezziPack:nn(r.pezziPack,0,1000),prezzoBanco:nn(r.prezzoBanco,0,10000),unitaBanco:str(r.unitaBanco,20),etichetta:r.etichetta&&ID_OK.test(r.etichetta)?r.etichetta:'',
    inProdotti:r.inProdotti!==false,updatedAt:nn(r.updatedAt,0)||0,deleted:!!r.deleted})).filter(r=>r.nome);
  o.archivio=(Array.isArray(D.archivio)?D.archivio:[]).slice(0,5000).map(a=>({id:okid(a.id,'a-'),nome:str(a.nome,200),tipo:a.tipo==='dolce'?'dolce':'salato',categoria:str(a.categoria,60),stagioni:(Array.isArray(a.stagioni)?a.stagioni:[]).filter(s=>['primavera','estate','autunno','inverno'].includes(s)),
    mesi:str(a.mesi,120),ultimoPrezzo:nn(a.ultimoPrezzo,0,10000),unita:str(a.unita,20),volte:nn(a.volte,0,100000)||0,prima:str(a.prima,20),ultima:str(a.ultima,20),materiaPrima:str(a.materiaPrima,120),ricetta:a.ricetta&&ID_OK.test(a.ricetta)?a.ricetta:'',updatedAt:nn(a.updatedAt,0)||0,deleted:!!a.deleted})).filter(a=>a.nome);
  o.stagionalita=(Array.isArray(D.stagionalita)?D.stagionalita:[]).slice(0,300).map(s=>({nome:str(s.nome,80),mesi:(Array.isArray(s.mesi)?s.mesi:[]).map(Number).filter(m=>m>=0&&m<12)}));
  o.mappaFatture=(Array.isArray(D.mappaFatture)?D.mappaFatture:[]).slice(0,8000).map(m=>({voce:str(m.voce,200),fornitore:str(m.fornitore,80),ing:m.ing&&ID_OK.test(m.ing)?m.ing:null,formato:nn(m.formato,0,1e5),negozio:!!m.negozio,updatedAt:nn(m.updatedAt,0)||0})).filter(m=>m.voce&&(m.ing||m.negozio));
  o.fornitori=(Array.isArray(D.fornitori)?D.fornitori:[]).slice(0,500).map(f=>({id:okid(f.id,'f-'),nome:str(f.nome,80).trim(),alias:(Array.isArray(f.alias)?f.alias:[]).slice(0,20).map(a=>str(a,60).trim()).filter(Boolean),regola:['cucina','negozio','misto'].includes(f.regola)?f.regola:'misto',updatedAt:nn(f.updatedAt,0)||0,deleted:!!f.deleted})).filter(f=>f.nome);
  o.importati=(Array.isArray(D.importati)?D.importati:[]).slice(-3000).map(x=>str(x,200));
  // etichette dell'app etichette segnate "non serve ricetta" (id del prodotto etichetta); deleted = rimessa in elenco
  o.etiNoRic=(Array.isArray(D.etiNoRic)?D.etiNoRic:[]).slice(0,5000).map(x=>({id:ID_OK.test(String(x&&x.id||''))?String(x.id):'',updatedAt:nn(x&&x.updatedAt,0)||0,deleted:!!(x&&x.deleted)})).filter(x=>x.id);
  o.updatedAt=nn(D.updatedAt,0)||0;
  return o;
}
function mergeColl(a,b){ const m=new Map(); for(const x of a||[]) m.set(x.id,x); for(const y of b||[]){ const x=m.get(y.id); if(!x||(y.updatedAt||0)>=(x.updatedAt||0)) m.set(y.id,y); } return [...m.values()]; }
function merge(a,b){ // b = archivio online: a parità vince b
  const o=emptyData();
  o.parametri=(b.parametri.updatedAt||0)>=(a.parametri.updatedAt||0)?b.parametri:a.parametri;
  for(const k of ['ingredienti','packaging','ricette','archivio','fornitori','etiNoRic']) o[k]=mergeColl(a[k],b[k]);
  o.stagionalita=b.stagionalita.length?b.stagionalita:a.stagionalita;
  const mk=x=>x.voce.toUpperCase()+'|'+x.fornitore.toUpperCase(); const mm=new Map();
  for(const x of a.mappaFatture) mm.set(mk(x),x); for(const y of b.mappaFatture){ const x=mm.get(mk(y)); if(!x||(y.updatedAt||0)>=(x.updatedAt||0)) mm.set(mk(y),y); }
  o.mappaFatture=[...mm.values()];
  o.importati=[...new Set([...a.importati,...b.importati])].slice(-3000);
  o.updatedAt=Math.max(a.updatedAt||0,b.updatedAt||0);
  return o;
}
const canon=d=>JSON.stringify(merge(d,emptyData()));
const touch=x=>{ x.updatedAt=Math.max(now(),(x.updatedAt||0)+1); };

/* ===================== ACCESSO AI DATI ===================== */
const ings=()=>S.ingredienti.filter(i=>!i.deleted).sort((a,b)=>a.nome.localeCompare(b.nome,'it'));
const ricette=()=>S.ricette.filter(r=>!r.deleted).sort((a,b)=>a.nome.localeCompare(b.nome,'it'));
const packs=()=>S.packaging.filter(p=>!p.deleted);
let IMAP=new Map(), INAME=new Map();
function reindex(){ IMAP=new Map(S.ingredienti.map(i=>[i.id,i])); INAME=new Map(S.ingredienti.filter(i=>!i.deleted).map(i=>[i.nome.toLowerCase(),i])); }
const getI=id=>IMAP.get(id);
const getR=id=>S.ricette.find(r=>r.id===id);
const unitCost=i=>i&&i.prezzo!=null&&i.formato?i.prezzo/i.formato:null;
function lastPriceDate(i){ const ds=(i.storico||[]).map(s=>s.data).filter(Boolean).sort(); if(ds.length) return ds[ds.length-1]; const m=/(\d{2})\/(\d{2})\/(\d{4})/.exec(i.note||''); return m?`${m[3]}-${m[2]}-${m[1]}`:''; }
function usedIn(id){ return ricette().filter(r=>r.righe.some(x=>x.ing===id)); }

