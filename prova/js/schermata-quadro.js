'use strict';
/* ===================== NAVIGAZIONE ===================== */
const TABS=[['quadro','Quadro'],['ricette','Ricette'],['ingredienti','Ingredienti e prezzi'],['archivio','Archivio piatti'],['fatture','Fatture e file'],['impostazioni','Impostazioni']];
function nav(){ $('#nav').innerHTML=TABS.map(([k,t])=>`<button class="${k===TAB?'on':''}" data-tab="${k}">${t}</button>`).join(''); }
function render(){
  if(!S) return; nav();
  const m=$('#main');
  const f={quadro:vQuadro,ricette:vRicette,ingredienti:vIngredienti,archivio:vArchivio,fatture:vFatture,impostazioni:vImpostazioni}[TAB];
  if(render.busy) return; render.busy=true;
  try{ const ae=document.activeElement; if(ae&&m.contains(ae)&&ae.id!=='q') ae.blur(); const y=scrollY;
    const keep=render.newTab?[]:[...m.querySelectorAll('.list,.scroll')].map(e=>[e.scrollTop,e.scrollLeft]); render.newTab=false; // le liste restano dove eri
    m.innerHTML=f(); scrollTo(0,y);
    m.querySelectorAll('.list,.scroll').forEach((e,k)=>{ if(keep[k]){ e.scrollTop=keep[k][0]; e.scrollLeft=keep[k][1]; } }); }
  finally{ render.busy=false; }
  afterRender();
}
function afterRender(){ const q=document.getElementById('q'); if(q&&render.focusQ){ q.focus(); q.setSelectionRange(q.value.length,q.value.length); render.focusQ=false; } }
async function checkUpdate(){
  try{ const r=await fetch('version.json?'+Date.now(),{cache:'no-store'}); const j=await r.json();
    if(!j.version||j.version===APP_VERSION) return;
    let bar=document.getElementById('updbar');
    if(!bar){ bar=document.createElement('div'); bar.id='updbar'; document.body.prepend(bar); }
    bar.innerHTML=`È pronta la versione <b>${esc(j.version)}</b>${j.note?' — '+esc(j.note):''} <button class="b sm p" data-act="aggiorna">Aggiorna ora</button>`;
  }catch(e){}
}

/* ===================== DIALOGO ===================== */
function dialog(title,body,buttons){ // buttons: [[label,act,cls]]
  const d=$('#dlg'); d.innerHTML=`<div class="dh"><h3>${esc(title)}</h3><button class="b sm" data-act="dlgclose">✕</button></div><div class="db">${body}</div><div class="df">${(buttons||[]).map(([l,a,c])=>`<button class="b ${c||''}" data-act="${a}">${esc(l)}</button>`).join('')}</div>`;
  if(!d.open) d.showModal();
}
const closeDlg=()=>{ const d=$('#dlg'); if(d.open) d.close(); };

/* ===================== QUADRO ===================== */
/* scelta dell'etichetta da collegare: ricerca mentre scrivi, risultati scorrevoli */
function etiCerca(r,q){
  const L=etiLinks? etiLinks():new Map(), n=norm(q||''), parole=n.split(/\s+/).filter(Boolean);
  const rn=norm(r.nome).split(/\s+/).filter(w=>w.length>3);
  const P=ETI.prodotti.filter(p=>!p.deleted&&p.id!==r.etichetta).map(p=>{ const t=norm(p.nome+' '+(p.sottotitolo||''));
    let s; if(parole.length){ if(!parole.every(w=>t.includes(w))) return null; s=(t.startsWith(n)?100:0)+(t.split(/\s+/).some(w=>w.startsWith(parole[0]))?50:0)-t.length/100; }
    else { s=rn.filter(w=>t.includes(w)).length*10-t.length/100; }
    return {p,s}; }).filter(Boolean).sort((a,b)=>b.s-a.s||a.p.nome.localeCompare(b.p.nome,'it'));
  return P.map(({p})=>{ const altre=(L.get(p.id)||[]).filter(x=>x.id!==r.id); return `<button type="button" data-act="etilink:${p.id}">${esc(p.nome)}${p.sottotitolo?`<small>${esc(p.sottotitolo)}</small>`:''}${altre.length?`<small>· già collegata a ${esc(altre[0].nome)}</small>`:''}</button>`; }).join('')||'<p class="small mut" style="padding:8px 12px;margin:0">Nessuna etichetta con queste parole.</p>';
}
function etiPicker(r,et){
  return `<div class="etipick">${et?`<div class="cur"><span class="small">Collegata a: <b>${esc(et.nome)}</b></span><button class="b sm" data-act="etipickopen">Cambia</button><button class="b sm" data-act="etiunlink">Scollega</button></div>`:''}
   <div id="etipickbox" ${et?'class="hidden"':''}><input class="i" id="etiq" placeholder="Cerca l'etichetta da collegare (es. ${esc(r.nome.split(' ')[0].toLowerCase())})…" autocomplete="off">
   <div class="etires" id="etires">${etiCerca(r,'')}</div><p class="small mut" style="margin:4px 0 0">Senza scrivere: prima quelle col nome più simile alla ricetta.</p></div></div>`;
}
const STAG=['inverno','inverno','primavera','primavera','primavera','estate','estate','estate','autunno','autunno','autunno','inverno'];
function monthsSince(s){ if(!s) return null; const d=new Date(s); if(isNaN(d)) return null; const n=new Date(); return (n.getFullYear()-d.getFullYear())*12+(n.getMonth()-d.getMonth()); }
function vQuadro(){
  const R=ricette().filter(r=>r.inProdotti!==false), C=R.map(r=>[r,calc(r)]);
  const cnt={}; C.forEach(([r,c])=>cnt[c.stato]=(cnt[c.stato]||0)+1);
  const I=ings(); const noPrice=I.filter(i=>unitCost(i)==null);
  const old=I.filter(i=>{ const d=lastPriceDate(i); const m=monthsSince(d); return unitCost(i)!=null&&(m==null||m>=6); });
  const MB=C.filter(([r,c])=>c.stato==='OK'&&c.banco).sort((a,b)=>a[1].banco.margPct-b[1].banco.margPct);
  const rif=S.parametri.ricaricoDef, nPerd=MB.filter(([r,c])=>c.banco.marg<0).length, nSotto=MB.filter(([r,c])=>c.banco.marg>=0&&c.banco.ric<rif-0.05).length;
  const noMB=C.filter(([r,c])=>r.prezzoBanco!=null&&!(c.stato==='OK'&&c.banco)).length;
  const stag=STAG[new Date().getMonth()];
  const ripro=S.archivio.filter(a=>!a.deleted&&a.stagioni.includes(stag)&&(monthsSince(a.ultima)??99)>=12).sort((a,b)=>(b.volte||0)-(a.volte||0)).slice(0,14);
  const recenti=[]; I.forEach(i=>(i.storico||[]).forEach(s=>{ const m=monthsSince(s.data); if(m!=null&&m<=1&&s.prima&&s.prezzoUnit) recenti.push([i,s,s.prezzoUnit/s.prima-1]); }));
  recenti.sort((a,b)=>Math.abs(b[2])-Math.abs(a[2]));
  const k=(n,t,go)=>`<div class="kpi" data-go="${go}"><b>${n}</b><span>${t}</span></div>`;
  return `<div class="kpis">
    ${k(R.length,'prodotti nel ricettario','ricette:')}
    ${k(cnt['OK']||0,'food cost completo','ricette:OK')}
    ${k((cnt['Tempi mancanti']||0)+(cnt['Prezzi mancanti']||0)+(cnt['Dosi mancanti']||0)+(cnt['Lotto mancante']||0),'quasi pronti (manca un dato)','ricette:quasi')}
    ${k(cnt['Ricetta da inserire']||0,'ricette da inserire','ricette:Ricetta da inserire')}
    ${k(I.length,'ingredienti','ingredienti:')}
    ${k(old.length,'prezzi vecchi (oltre 6 mesi)','ingredienti:vecchi')}
  </div>
  <div class="card"><h2>Margine reale al banco, prodotto per prodotto</h2>
   <p class="small">${MB.length} prodotti con food cost completo e prezzo al banco: <span class="chip r">${nPerd} in perdita</span> <span class="chip w">${nSotto} sotto il ricarico del ${pct(rif)}</span> <span class="chip ok">${MB.length-nPerd-nSotto} in linea o sopra</span></p>
   ${MB.length?`<div class="scroll" style="max-height:460px"><table class="t"><tr><th>Prodotto</th><th class="n">Costo pieno</th><th class="n">Ipotetico ${pct(rif)}</th><th class="n">Banco</th><th class="n">Margine (senza IVA)</th><th class="n">% sul prezzo</th><th class="n">Ricarico reale</th></tr>
   ${MB.map(([r,c])=>{ const b=c.banco, u=b.u==='kg'?'/kg':'/pz', cl=b.marg<0?'r':b.ric<rif-0.05?'w':'ok'; return `<tr data-ric="${r.id}" style="cursor:pointer"><td>${esc(r.nome)}</td><td class="n">${eur(b.costo)}${u}</td><td class="n">${eur(b.ipo)}${u}</td><td class="n">${esc(banco(r))}</td><td class="n"><span class="chip ${cl}">${eur(b.marg)}${u}</span></td><td class="n">${pct(b.margPct)}</td><td class="n">${pct(b.ric)}</td></tr>`}).join('')}</table></div>`:'<p class="mut">Nessun prodotto con food cost completo e prezzo al banco.</p>'}
   <p class="small mut">Dal margine più basso. Costo pieno = ingredienti + lavoro + energia + affitto e fissi della cucina (a pezzo anche il packaging). Margine = prezzo al banco senza IVA − costo pieno. Ipotetico = costo pieno + ricarico ${pct(rif)} + IVA.${noMB?` ${noMB} prodotti hanno un prezzo al banco ma non compaiono: food cost incompleto, unità mancante o pezzatura mancante.`:''}</p></div>
  ${etiQuadroCard()}
  <div class="grid2">
   <div class="card"><h2>Prezzi cambiati nell'ultimo mese</h2>
    ${recenti.length?`<table class="t"><tr><th>Ingrediente</th><th>Fornitore</th><th class="n">Prima</th><th class="n">Ora</th><th class="n">Var.</th></tr>${recenti.slice(0,12).map(([i,s,v])=>`<tr><td>${esc(i.nome)}</td><td>${esc(s.fornitore)}</td><td class="n">${eur3(s.prima)}</td><td class="n">${eur3(s.prezzoUnit)}</td><td class="n"><span class="chip ${v>0.05?'r':v<-0.05?'ok':'g'}">${v>0?'+':''}${pct(v)}</span></td></tr>`).join('')}</table>`:'<p class="mut">Nessun aggiornamento prezzi nell\'ultimo mese. Carica le fatture XML in "Fatture e file".</p>'}
   </div>
   <div class="card"><h2>Ingredienti da sistemare</h2>
    <p><b>${noPrice.length}</b> senza prezzo · <b>${old.length}</b> con prezzo più vecchio di 6 mesi</p>
    ${noPrice.length?`<p class="small">${noPrice.slice(0,30).map(i=>esc(i.nome)).join(', ')}${noPrice.length>30?'…':''}</p>`:''}
    <button class="b" data-go="ingredienti:vecchi">Vedi l'elenco</button></div>
  </div>
  <div class="grid2">
   <div class="card"><h2>Da riproporre questa stagione (${stag})</h2><p class="small mut">Piatti già fatti in ${stag}, non proposti da almeno 12 mesi.</p>
    ${ripro.length?`<table class="t">${ripro.map(a=>`<tr><td>${esc(a.nome)}</td><td class="mut small">${a.tipo}</td><td class="n small">${a.volte||0} volte</td><td class="n small mut">${esc(dIT(a.ultima))}</td></tr>`).join('')}</table>`:'<p class="mut">Nessuno.</p>'}</div>
  </div>`;
}

