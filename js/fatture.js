'use strict';
/* ===================== FATTURE E FILE ===================== */
let IMP=null; // {righe:[...], docs:[...], proposte:[...], note:[]}
function vFatture(){
  return `<div class="card"><h2>Carica fatture e file</h2>
   <p class="small">Trascina qui (o scegli) i file. L'app li legge sul tuo computer: non vengono caricati da nessuna parte.</p>
   <ul class="small"><li><b>Fatture elettroniche XML</b> (.xml, .xml.p7m o uno .zip che le contiene, scaricate da Aziendaonweb): aggiornano i prezzi d'acquisto degli ingredienti con l'ultimo prezzo pagato.</li>
   <li><b>PROPOSTE della GASTRONOMIA</b> (.docx): aggiornano l'archivio piatti (ultima volta, volte, prezzo).</li>
   <li><b>Excel</b> (.xlsx): se contiene righe con descrizione e prezzo le uso come una fattura; l'elenco fatture di Aziendaonweb ha solo i totali e non basta per i prezzi.</li>
   <li><b>PDF e foto</b> di bolle o fatture: l'app non li sa leggere in modo affidabile. Mandali a Claude in chat e aggiorna lui l'archivio.</li></ul>
   <div class="drop" id="drop">Trascina qui i file<br><br><label class="b p">Scegli file<input type="file" id="fileinp" multiple accept=".xml,.p7m,.zip,.docx,.xlsx" hidden></label></div>
  </div>${IMP?impView():''}`;
}
async function readFiles(files){
  IMP={righe:[],proposte:[],note:[]};
  for(const f of files){
    try{
      const buf=new Uint8Array(await f.arrayBuffer()); const n=f.name.toLowerCase();
      if(n.endsWith('.zip')){ const z=fflate.unzipSync(buf); for(const k in z){ const kl=k.toLowerCase(); if(kl.endsWith('.xml')||kl.endsWith('.p7m')) parseInvoice(z[k],k.split('/').pop()); } }
      else if(n.endsWith('.xml')||n.endsWith('.p7m')) parseInvoice(buf,f.name);
      else if(n.endsWith('.docx')) parseDocx(buf,f.name);
      else if(n.endsWith('.xlsx')) await parseXlsx(buf,f.name);
      else IMP.note.push(f.name+': formato non gestito (PDF e foto: mandali a Claude in chat).');
    }catch(e){ IMP.note.push(f.name+': non leggibile ('+e.message+')'); }
  }
  prepInvoice(); render();
}
/* --- FatturaPA --- */
function p7mToXml(u8){
  let s=''; for(let i=0;i<u8.length;i++) s+=String.fromCharCode(u8[i]);
  if(/^\s*MI/.test(s)&&!/<\?xml|<\w*:?FatturaElettronica/.test(s)){ try{ return p7mToXml(unb64(s.replace(/\s/g,''))); }catch(e){} }
  const a=s.search(/<\?xml|<([A-Za-z0-9_]+:)?FatturaElettronica[\s>]/); const m=/<\/([A-Za-z0-9_]+:)?FatturaElettronica>/.exec(s);
  if(a<0||!m) throw new Error('XML non trovato nel file firmato');
  let x=s.slice(a,m.index+m[0].length);
  x=x.replace(/\x04\x82[\x00-\xff]{2}|\x04\x81[\x00-\xff]/g,''); // salti dei blocchi della firma
  const b=new Uint8Array(x.length); for(let i=0;i<x.length;i++) b[i]=x.charCodeAt(i);
  return new TextDecoder('utf-8').decode(b);
}
const kids=(el,name)=>[...el.getElementsByTagNameNS('*',name)];
const tx=(el,name)=>{ const e=el&&el.getElementsByTagNameNS('*',name)[0]; return e?e.textContent.trim():''; };
function parseInvoice(u8,name){
  let xml; const head=String.fromCharCode(...u8.slice(0,200));
  if(/\.p7m$/i.test(name)||!/<\?xml|<\w*:?FatturaElettronica/.test(head)) xml=p7mToXml(u8); else xml=new TextDecoder('utf-8').decode(u8);
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.getElementsByTagName('parsererror').length) throw new Error('XML non valido');
  const ced=kids(doc,'CedentePrestatore')[0]; if(!ced) throw new Error('non è una fattura elettronica');
  const forn=tx(ced,'Denominazione')||(tx(ced,'Nome')+' '+tx(ced,'Cognome')).trim();
  for(const body of kids(doc,'FatturaElettronicaBody')){
    const dg=kids(body,'DatiGeneraliDocumento')[0];
    const tipo=tx(dg,'TipoDocumento'), data=tx(dg,'Data'), numero=tx(dg,'Numero');
    if(tipo==='TD04'||tipo==='TD05'){ IMP.note.push(`${forn} n. ${numero} (${dIT(data)}): nota di credito/debito, ignorata per i prezzi.`); continue; }
    for(const l of kids(body,'DettaglioLinee')){
      const desc=tx(l,'Descrizione'); const q=num(tx(l,'Quantita')); const pu=num(tx(l,'PrezzoUnitario')); const pt=num(tx(l,'PrezzoTotale'));
      if(!desc||pt==null||pt<=0) continue;
      const netto=q&&q>0?pt/q:pt;
      IMP.righe.push({file:name,fornitore:forn,data,numero,voce:desc.replace(/\s+/g,' '),qta:q,um:tx(l,'UnitaMisura').toUpperCase(),pu,netto,iva:num(tx(l,'AliquotaIVA'))});
    }
  }
}
async function parseXlsx(u8,name){
  const ExcelJS=await loadExcelJS(); const wb=new ExcelJS.Workbook(); await wb.xlsx.load(u8.buffer);
  let found=0;
  wb.eachSheet(ws=>{ let h=null;
    ws.eachRow((row,ri)=>{ const v=row.values.map(x=>x&&typeof x==='object'&&'result' in x?x.result:x&&x.text?x.text:x);
      if(!h){ const lc=v.map(x=>norm(x)); const d=lc.findIndex(x=>/descrizione/.test(x)), p=lc.findIndex(x=>/prezzo unitario|prezzo/.test(x)); if(d>0&&p>0) h={d,p,q:lc.findIndex(x=>/quantit/.test(x)),f:lc.findIndex(x=>/fornitore|denominazione|cedente/.test(x)),dt:lc.findIndex(x=>/^data/.test(x)),n:lc.findIndex(x=>/numero/.test(x))}; return; }
      const desc=v[h.d]; const pu=num(v[h.p]); if(!desc||pu==null||pu<=0) return;
      const q=h.q>0?num(v[h.q]):null; const dt=h.dt>0?v[h.dt]:''; 
      IMP.righe.push({file:name,fornitore:h.f>0?String(v[h.f]||''):'',data:dt instanceof Date?dt.toISOString().slice(0,10):String(dt||'').slice(0,10),numero:h.n>0?String(v[h.n]||''):'',voce:String(desc).replace(/\s+/g,' '),qta:q,um:'',pu,netto:pu}); found++;
    }); });
  if(!found) IMP.note.push(name+': non ci sono righe con descrizione e prezzo (probabilmente è l\'elenco fatture con i soli totali). Per i prezzi servono gli XML.');
}
function guessFormato(voce,um){
  if(/^(KG|KGM|KILOGRAMMI|KILO)$/.test(um)) return {f:1,u:'kg'}; if(/^(LT|L|LITRI)$/.test(um)) return {f:1,u:'l'};
  const s=voce.toUpperCase().replace(',','.');
  let mult=1; const mm=/(\d+)\s*[X×]\s*\d/.exec(s); if(mm) mult=+mm[1];
  const m=/(\d+(?:\.\d+)?)\s*(KG|GR|G|LT|L|ML|CL)\b/.exec(s);
  if(!m) return null; let v=+m[1], u=m[2];
  if(u==='G'||u==='GR') return {f:v/1000*mult,u:'kg'}; if(u==='KG') return {f:v*mult,u:'kg'};
  if(u==='ML') return {f:v/1000*mult,u:'l'}; if(u==='CL') return {f:v/100*mult,u:'l'}; return {f:v*mult,u:'l'};
}
/* --- Fornitori: nome unico + regola cucina / negozio / misto --- */
const SOC=/\b(s\.?r\.?l\.?s?|s\.?p\.?a\.?|s\.?n\.?c\.?|s\.?a\.?s\.?|soc(ieta)?|coop(erativa)?|agricola|az(ienda)?|di|e|c|srls|spa|srl|snc|sas|unipersonale|semplificata|a r\.?l\.?)\b/g;
function fornMatch(raw){
  const r=' '+norm(raw)+' ';
  let best=null,bl=0;
  for(const f of S.fornitori.filter(f=>!f.deleted)) for(const a of [f.nome,...f.alias]){ const n=norm(a); if(!n) continue;
    const hit=n.length<=3?r.includes(' '+n+' '):r.includes(n)||(norm(raw).length>=4&&n.includes(norm(raw)));
    if(hit&&n.length>bl){ best=f; bl=n.length; } }
  return best;
}
function fornNome(raw){ const f=fornMatch(raw); if(f) return f.nome; const w=norm(raw).replace(SOC,' ').trim().split(/\s+/).slice(0,3).join(' '); return w.replace(/\b\w/g,c=>c.toUpperCase())||raw; }
function fornRegola(raw){ const f=fornMatch(raw); return f?f.regola:'misto'; }
function suggest(voce,forn){
  const key=voce.toUpperCase(), fn=fornNome(forn);
  const ms=S.mappaFatture.filter(x=>x.voce.toUpperCase()===key);
  const m=ms.find(x=>x.fornitore===fn)||ms[0];
  if(m&&m.negozio) return {negozio:true,sure:true};
  if(m&&m.ing&&getI(m.ing)&&!getI(m.ing).deleted) return {ing:m.ing,sure:true,formato:m.formato};
  const w=new Set(norm(voce).split(' ').filter(x=>x.length>2&&!/^\d/.test(x)));
  let best=null,bs=0;
  for(const i of ings()){ const iw=norm(i.nome).split(' ').filter(x=>x.length>2); if(!iw.length) continue; const hit=iw.filter(x=>w.has(x)||[...w].some(y=>y.startsWith(x.slice(0,5))&&x.length>4)).length; const sc=hit/iw.length; if(sc>bs){bs=sc;best=i;} }
  return bs>=0.99?{ing:best.id,sure:false}:bs>=0.5?{ing:best.id,sure:false,weak:true}:{ing:null};
}
function nomeDaVoce(v){ let t=String(v).replace(/^\s*[\d.\-\/]{4,}\s+/,'').replace(/\b\d+(?:[.,]\d+)?\s*(KG|GR|G|LT|L|ML|CL|PZ|X)\b/gi,'').replace(/\b(BIO|BIOLOGIC[OA]|S\/G|NSI|FDL|CONF|SACCO|BUSTA|VASO|LATTA|BRIK|BRICK|TETRA|PET)\b\.?/gi,'').replace(/[^A-Za-zÀ-ÿ' ]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase(); return t.charAt(0).toUpperCase()+t.slice(1); }
function prepInvoice(){
  if(!IMP) return;
  IMP.righe.sort((a,b)=>String(b.data).localeCompare(String(a.data)));
  for(const r of IMP.righe){
    r.forn=fornNome(r.fornitore); r.regola=fornRegola(r.fornitore);
    const s=suggest(r.voce,r.fornitore); r.ing=s.ing||null; r.sure=!!s.sure; r.weak=!!s.weak; r.why='';
    const g=guessFormato(r.voce,r.um); r.formato=s.formato||(g?g.f:null); r.unitaNuovo=g?g.u:'kg';
    r.key=(r.fornitore+'|'+r.numero+'|'+r.voce).slice(0,200);
    r.nuovo=nomeDaVoce(r.voce);
    // dove va: cucina / negozio / da decidere
    if(s.negozio){ r.dest='negozio'; r.why='ricordato come prodotto del negozio'; }
    else if(r.regola==='negozio') r.dest='negozio';
    else if(r.ing&&(s.sure||r.regola==='cucina')) r.dest='cucina';
    else if(r.regola==='cucina') r.dest='cucina';
    else r.dest=r.ing?'?cucina':'?';
    if(S.importati.includes(r.key)){ r.dest='fatto'; r.why='già importata'; }
    const i=r.ing&&getI(r.ing);
    r.skip=false;
    if(i&&r.dest!=='fatto'){ const last=lastPriceDate(i);
      if(last&&r.data&&r.data<last){ r.skip=true; r.why='prezzo più vecchio di quello già registrato'; }
      if(/^farin/i.test(i.nome)&&!/sobrino/i.test(r.forn)){ r.skip=true; r.why='farine: solo prezzi Mulino Sobrino'; }
      if(i.fornitoreFisso&&norm(i.fornitore)!==norm(r.forn)){ r.skip=true; r.why='fornitore fisso: '+i.fornitore; } }
  }
  const byIng=new Map(); for(const r of IMP.righe.filter(r=>r.dest==='cucina'&&r.ing&&!r.skip)){ const o=byIng.get(r.ing); if(!o||r.data>o.data||(r.data===o.data&&(r.formato||0)>(o.formato||0))) byIng.set(r.ing,r); }
  for(const r of IMP.righe) if(r.dest==='cucina'&&r.ing&&!r.skip&&byIng.get(r.ing)!==r){ r.skip=true; r.why='c\'è una riga più recente o un formato più grande'; }
}
const willApply=r=>r.dest==='cucina'&&!r.skip&&r.formato>0&&(r.ing||r.nuovo);
function impView(){
  const R=IMP.righe.filter(r=>r.dest!=='fatto'); const opts=ings();
  const nC=R.filter(willApply).length, nN=R.filter(r=>r.dest==='negozio').length, nQ=R.filter(r=>r.dest[0]==='?').length;
  const forns=[...new Map(R.map(r=>[r.forn,r])).values()];
  const P=IMP.proposte;
  return `${IMP.note.length?`<div class="card">${IMP.note.map(n=>`<div class="warn small">${esc(n)}</div>`).join('')}</div>`:''}
  ${R.length?`<div class="card"><h2>Righe di fattura (${R.length})</h2>
   <div class="small" style="margin-bottom:8px">${forns.map(r=>{ const f=fornMatch(r.fornitore); return `<span class="row" style="display:inline-flex;margin:0 14px 6px 0"><b>${esc(r.forn)}</b>&nbsp;<select class="i" style="width:auto" data-fregola="${esc(r.fornitore)}"><option value="misto" ${!f||f.regola==='misto'?'selected':''}>cucina e negozio: chiedi</option><option value="cucina" ${f&&f.regola==='cucina'?'selected':''}>tutto alla cucina</option><option value="negozio" ${f&&f.regola==='negozio'?'selected':''}>tutto al negozio</option></select></span>`}).join('')}</div>
   <p class="small">Per ogni riga scegli <b>Cucina</b> (aggiorna o crea l'ingrediente col prezzo nuovo) o <b>Negozio</b> (ignorata; la ricordo e la prossima volta la salto da sola). Prezzo netto pagato, IVA esclusa. Il <b>formato</b> è la quantità in UNA unità di fattura (es. "Ceci 1KG" = 1).</p>
   <div class="row" style="margin-bottom:8px"><button class="b p" data-act="applicafatt" ${nC+nN?'':'disabled'}>Conferma: ${nC} prezzi in cucina, ${nN} al negozio</button>${nQ?`<span class="chip w">${nQ} da decidere</span> <button class="b sm" data-act="restonegozio">Tutte le "da decidere" al negozio</button>`:''}<button class="b" data-act="chiudiimp">Chiudi</button></div>
   <div class="scroll"><table class="t small"><tr><th>Data · fornitore</th><th>Voce in fattura</th><th class="n">Prezzo netto</th><th>Dove va</th><th>Ingrediente</th><th class="n">Formato</th><th class="n">Nuovo €/unità</th><th class="n">Prima</th></tr>
   ${R.map(r=>{ const k=IMP.righe.indexOf(r); const i=r.ing&&getI(r.ing); const nu=r.formato?r.netto/r.formato:null; const old=i?unitCost(i):null; const v=nu&&old?nu/old-1:null; const cu=r.dest==='cucina'||r.dest==='?cucina';
    return `<tr style="${r.dest==='negozio'?'opacity:.55':''}">
    <td>${esc(dIT(r.data))}<br><span class="mut">${esc(r.forn)} n. ${esc(r.numero)}</span></td>
    <td>${esc(r.voce)}${r.qta?`<br><span class="mut">q.tà ${fmt(r.qta,2)} ${esc(r.um)}</span>`:''}${r.why?`<br><span class="chip g">${esc(r.why)}</span>`:''}</td>
    <td class="n">${eur3(r.netto)}</td>
    <td style="white-space:nowrap"><button class="b sm ${r.dest==='cucina'?'p':''}" data-act="dest:${k}:cucina">Cucina</button> <button class="b sm ${r.dest==='negozio'?'p':''}" data-act="dest:${k}:negozio">Negozio</button>${r.dest[0]==='?'?'<br><span class="chip w">da decidere</span>':''}</td>
    <td>${cu?`<select class="i" data-imp="${k}" data-f="ing"><option value="">+ nuovo ingrediente</option>${opts.map(o=>`<option value="${o.id}" ${o.id===r.ing?'selected':''}>${esc(o.nome)} (${esc(o.fornitore||'?')})</option>`).join('')}</select>${!r.ing?`<input class="i" data-imp="${k}" data-f="nuovo" value="${esc(r.nuovo)}" placeholder="nome del nuovo ingrediente">`:''}${r.ing&&!r.sure?`<span class="chip ${r.weak?'w':'g'}">${r.weak?'abbinamento incerto':'proposto'}</span>`:''}${i&&norm(i.fornitore)!==norm(r.forn)?`<br><span class="small mut">ora: ${esc(i.fornitore||'?')} → diventa ${esc(r.forn)}</span>`:''}`:''}</td>
    <td class="n">${cu?`<input class="i n" data-imp="${k}" data-f="formato" value="${fmt(r.formato,4)}" inputmode="decimal" style="width:80px"> ${i?esc(i.unita):esc(r.unitaNuovo)}`:''}</td>
    <td class="n"><b>${cu&&nu?eur3(nu):''}</b>${cu&&r.skip?'<br><span class="chip g">non aggiorna</span>':''}</td><td class="n">${cu&&old!=null?eur3(old):''}${cu&&v!=null?`<br><span class="chip ${v>0.05?'r':v<-0.05?'ok':'g'}">${v>0?'+':''}${pct(v)}</span>`:''}</td></tr>`}).join('')}
   </table></div></div>`:''}
  ${P.length?propView():''}`;
}
function remember(r,patch){
  const mk=r.voce.toUpperCase(); let ex=S.mappaFatture.find(m=>m.voce.toUpperCase()===mk&&m.fornitore===r.forn);
  if(!ex){ ex={voce:r.voce,fornitore:r.forn,ing:null,formato:null,negozio:false,updatedAt:0}; S.mappaFatture.push(ex); }
  Object.assign(ex,patch); touch(ex);
}
function applyInvoice(){
  let n=0,nn=0,nw=0;
  // per ogni ingrediente vale una sola riga: la più recente, a parità di data il formato più grande
  const best=new Map(); for(const r of IMP.righe.filter(r=>willApply(r)&&r.ing)){ const o=best.get(r.ing); if(!o||r.data>o.data||(r.data===o.data&&(r.formato||0)>(o.formato||0))) best.set(r.ing,r); }
  for(const r of IMP.righe){
    if(willApply(r)&&r.ing&&best.get(r.ing)!==r) continue;
    if(r.dest==='negozio'&&!r.why.startsWith('ricordato')){ remember(r,{ing:null,formato:null,negozio:true}); S.importati.push(r.key); nn++; continue; }
    if(!willApply(r)) continue;
    let i=r.ing&&getI(r.ing);
    if(!i){ const nome=(r.nuovo||'').trim(); if(!nome) continue; i=INAME.get(nome.toLowerCase());
      if(!i){ i={id:uid('i-'),nome,fornitore:r.forn,prezzo:null,formato:null,unita:r.unitaNuovo||'kg',pesoPezzo:null,note:'',storico:[],updatedAt:0,deleted:false}; S.ingredienti.push(i); reindex(); nw++; } }
    const last=lastPriceDate(i); if(last&&r.data&&r.data<last){ remember(r,{ing:i.id,formato:r.formato,negozio:false}); continue; } // fattura più vecchia: ricorda l'abbinamento ma non tocca il prezzo
    const prima=unitCost(i), nu=r.netto/r.formato;
    i.storico=(i.storico||[]).concat([{data:r.data,prezzoUnit:nu,prima,fornitore:r.forn,fattura:r.numero,voce:r.voce}]).slice(-60);
    i.prezzo=r.netto; i.formato=r.formato; i.fornitore=r.forn;
    i.note=`Fattura ${dIT(r.data)} ${r.forn} n. ${r.numero}: ${r.voce} (conf. ${fmt(r.formato,3)} ${i.unita}). Ultimo prezzo pagato, IVA esclusa.${prima!=null?' Prima: '+eur3(prima)+'/'+i.unita+'.':''}`;
    touch(i); remember(r,{ing:i.id,formato:r.formato,negozio:false}); S.importati.push(r.key); n++;
  }
  commit(); IMP.righe=IMP.righe.filter(r=>!S.importati.includes(r.key)); prepInvoice(); render();
  toast(`${n} prezzi aggiornati in cucina${nw?' ('+nw+' ingredienti nuovi)':''}, ${nn} righe segnate come negozio`);
}
/* --- PROPOSTE della GASTRONOMIA (.docx) --- */
const MESI=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
function parseDocx(u8,name){
  const z=fflate.unzipSync(u8,{filter:f=>f.name==='word/document.xml'}); const x=z['word/document.xml']; if(!x) throw new Error('documento Word non valido');
  const doc=new DOMParser().parseFromString(new TextDecoder().decode(x),'application/xml');
  const paras=[...doc.getElementsByTagNameNS('*','p')].map(p=>[...p.getElementsByTagNameNS('*','t')].map(t=>t.textContent).join('').trim()).filter(Boolean);
  // data: dal titolo o dal nome del file
  const src=(paras.slice(0,4).join(' ')+' '+name).toLowerCase();
  let data=''; const mm=new RegExp('(\\d{1,2})\\D{0,25}?(?:(?:e|-|–)\\s*\\D{0,12}?(\\d{1,2})\\s*)?('+MESI.join('|')+')').exec(src);
  if(mm){ const mo=MESI.indexOf(mm[3]); const d=+(mm[2]||mm[1]); const n=new Date(); let y=n.getFullYear(); if(mo>n.getMonth()+1) y--; data=`${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
  let tipo='salato', sempre=false; const piatti=[];
  for(const p of paras){
    const u=p.toUpperCase();
    if(/^DOLCI\b/.test(u)){ tipo='dolce'; continue; }
    if(/SEMPRE PRESENTI/.test(u)){ sempre=true; continue; }
    const m=/^(.+?)\s*[–—-]\s*€\s*([\d]+(?:[.,]\d+)?)\s*\/?\s*(etto|pz|pezzo|kg|porzione|vasetto)?/i.exec(p);
    if(!m) continue;
    piatti.push({nome:m[1].trim().replace(/\s+/g,' '),prezzo:num(m[2]),unita:'€/'+((m[3]||'pz').toLowerCase().replace('pezzo','pz')),tipo,sempre});
  }
  if(!piatti.length) { IMP.note.push(name+': nessun piatto riconosciuto (righe "Nome – € 2,50/etto").'); return; }
  IMP.proposte.push({file:name,data,piatti,on:!S.importati.includes('doc:'+name)&&!!data});
}
function findArch(nome,tipo){ const k=norm(nome); return S.archivio.find(a=>!a.deleted&&norm(a.nome)===k)||null; }
function propView(){
  return `<div class="card"><h2>Proposte della gastronomia</h2><p class="small">Per ogni documento: i piatti già in archivio prendono questa data come "ultima volta" (+1 volta) e il nuovo prezzo; quelli nuovi vengono aggiunti. I piatti "sempre presenti" aggiornano solo il prezzo.</p>
  ${IMP.proposte.map((d,k)=>`<div style="border-top:1px solid var(--b);padding-top:8px;margin-top:8px"><label class="row"><input type="checkbox" data-prop="${k}" ${d.on?'checked':''}> <b>${esc(d.file)}</b> — data: <input class="i" type="date" data-propdate="${k}" value="${esc(d.data)}" style="width:auto">${S.importati.includes('doc:'+d.file)?'<span class="chip g">già importato</span>':''}</label>
   <table class="t small">${d.piatti.map(p=>{ const a=findArch(p.nome,p.tipo); return `<tr><td>${esc(p.nome)}</td><td>${p.tipo}${p.sempre?' · sempre presente':''}</td><td class="n">${esc(banco({prezzoBanco:p.prezzo,unitaBanco:p.unita}))}</td><td>${a?'<span class="chip ok">in archivio</span>':'<span class="chip w">nuovo</span>'}</td></tr>`}).join('')}</table></div>`).join('')}
   <div class="row" style="margin-top:10px"><button class="b p" data-act="applicaprop">Aggiorna l'archivio</button></div></div>`;
}
function applyProposte(){
  let n=0,nw=0;
  for(const d of IMP.proposte.filter(d=>d.on&&d.data)){
    const st=STAG[new Date(d.data).getMonth()], mese=MESI[new Date(d.data).getMonth()].slice(0,3);
    for(const p of d.piatti){
      let a=findArch(p.nome,p.tipo);
      if(!a){ a={id:uid('a-'),nome:p.nome,tipo:p.tipo,categoria:'',stagioni:[],mesi:'',ultimoPrezzo:null,unita:'',volte:0,prima:d.data,ultima:'',materiaPrima:'',ricetta:'',updatedAt:0,deleted:false}; S.archivio.push(a); nw++; }
      a.ultimoPrezzo=p.prezzo; a.unita=p.unita;
      if(!p.sempre&&(!a.ultima||d.data>a.ultima)){ a.ultima=d.data; a.volte=(a.volte||0)+1; if(!a.stagioni.includes(st)) a.stagioni.push(st); if(!a.mesi.includes(mese)) a.mesi=(a.mesi?a.mesi+', ':'')+mese; if(!a.prima||d.data<a.prima) a.prima=d.data; }
      // prezzo al banco della ricetta con lo stesso nome
      const r=ricette().find(r=>norm(r.nome)===norm(p.nome)); if(r&&p.prezzo!=null){ r.prezzoBanco=p.prezzo; r.unitaBanco=p.unita; touch(r); }
      touch(a); n++;
    }
    S.importati.push('doc:'+d.file);
  }
  commit(); IMP.proposte=[]; render(); toast(`Archivio aggiornato: ${n} piatti, ${nw} nuovi`);
}

