'use strict';
/* ===================== RICETTE ===================== */
const BASE='Base: ';
const CATS=()=>[...new Set(ricette().map(r=>r.categoria).filter(Boolean))].sort();
function vRicette(){
  const f=FILT.ric||'';
  let R=ricette();
  if(Q) R=R.filter(r=>norm(r.nome+' '+r.categoria+' '+r.righe.map(x=>x.nome).join(' ')).includes(norm(Q)));
  const C=new Map(R.map(r=>[r.id,calc(r)]));
  if(f==='quasi') R=R.filter(r=>['Tempi mancanti','Prezzi mancanti','Dosi mancanti','Lotto mancante'].includes(C.get(r.id).stato));
  else if(f&&f.startsWith('cat:')) R=R.filter(r=>r.categoria===f.slice(4));
  else if(f) R=R.filter(r=>C.get(r.id).stato===f);
  const sel=EDIT&&EDIT.id===SEL?EDIT:SEL&&getR(SEL); // una ricetta nuova o duplicata non è ancora nell'archivio
  const fl=[['','Tutte'],['OK','Food cost OK'],['quasi','Manca un dato'],['Ricetta da inserire','Da inserire'],...CATS().map(c=>['cat:'+c,c])];
  return `<div class="split"><div>
    <div class="row" style="margin-bottom:8px"><input class="i flex1" id="q" placeholder="Cerca ricetta o ingrediente" value="${esc(Q)}"><button class="b p" data-act="nuovaric">+ Nuova</button></div>
    <div class="tabs2">${fl.map(([k,t])=>`<button class="${k===f?'on':''}" data-filt="ric:${esc(k)}">${esc(t)}</button>`).join('')}</div>
    <div class="list">${R.map(r=>{const c=C.get(r.id);return `<div class="it ${sel&&sel.id===r.id?'on':''}" data-ric="${r.id}"><div class="nm">${esc(r.nome)}<small>${esc(r.categoria)}${c.ckg!=null?' · '+eur(c.ckg)+'/kg':''}</small></div><span class="chip ${STATO_CL[c.stato]}">${c.stato==='OK'?'OK':esc(c.stato.replace(' mancanti','').replace('Ricetta da inserire','da inserire'))}</span></div>`}).join('')||'<div class="it mut">Nessuna ricetta</div>'}</div>
    <p class="small mut">${R.length} ricette</p>
  </div><div>${sel?(EDIT&&EDIT.id===sel.id?ricEdit():ricView(sel)):'<div class="card"><p class="mut">Scegli una ricetta dall\'elenco.</p></div>'}</div></div>`;
}
let MOLT={d:null,kg:null,tp:null,tc:null}; // simulazione nella scheda: dosi, kg finali, minuti (non salvati)
const qty=(q,un)=>q==null?'':un==='pz'?fmt(q,1)+' pz':q>=1?fmt(q,2)+(un==='l'?' l':' kg'):fmt(q*1000,0)+(un==='l'?' ml':' g');
const perEtto=v=>v==null?null:v/10;
function ricView(r){
  const sim=MOLT.d!=null||MOLT.kg!=null||MOLT.tp!=null||MOLT.tc!=null;
  const c=calc(r,{dosi:MOLT.d,kgVoluti:MOLT.kg,tProd:MOLT.tp,tCott:MOLT.tc});
  const st=calc(r); // lotto standard, per confronto
  const P=S.parametri, pk=S.packaging.find(p=>p.id===r.packaging);
  const et=ETI&&r.etichetta?ETI.prodotti.find(p=>p.id===r.etichetta&&!p.deleted):null;
  return `<div class="card">
    <div class="row"><h2 class="flex1" style="margin:0">${esc(r.nome)}</h2><span class="chip ${STATO_CL[c.stato]}">${esc(c.stato)}</span></div>
    <p class="mut small">${esc(r.categoria)}${r.unita?' · '+esc(r.unita):''} · venduto ${r.vendita==='pezzo'?'al kg e a pezzo ('+(fmt(r.confezione,0)||'?')+' g)':'al kg'}${r.foglio?' · scheda Excel: '+esc(r.foglio):''}</p>
    ${r.note?`<p class="small">${esc(r.note)}</p>`:''}
    <div class="row" style="margin:8px 0 12px"><button class="b p" data-act="modric">Modifica</button><button class="b" data-act="stampa:cucina">Stampa per la cucina</button><button class="b" data-act="stampa:fc">Stampa food cost</button><button class="b" data-act="duplica">Duplica</button><button class="b d" data-act="eliminaric">Elimina</button></div>
    <h3>Produzione</h3>
    <div class="row small">
      <label class="f s">Dosi da produrre<input class="i n" id="sim_d" inputmode="decimal" value="${fmt(c.dosi,3)}"></label>
      <label class="f s">oppure kg finali voluti<input class="i n" id="sim_kg" inputmode="decimal" value="${MOLT.kg?fmt(MOLT.kg,2):''}" placeholder="${fmt(c.fin,2)}"></label>
      <label class="f s">Minuti di lavoro<input class="i n" id="sim_tp" inputmode="decimal" value="${fmt(c.tP,0)}"></label>
      <label class="f s">Minuti di cottura<input class="i n" id="sim_tc" inputmode="decimal" value="${fmt(c.tC,0)}"></label>
      ${sim?'<button class="b sm" data-act="simreset">Torna al lotto standard</button><button class="b sm" data-act="simsalva">Salva come lotto standard</button>':''}
    </div>
    <p class="small mut">Lotto standard: ${fmt(r.lotto)||'–'} dosi, ${fmt(r.tProd)||0} min di lavoro, ${fmt(r.tCott)||0} min di cottura. Se cambi le dosi i minuti restano quelli del lotto standard: correggili qui se una produzione più grande richiede più tempo.</p>
    <div class="scroll"><table class="t" style="margin-top:8px"><tr><th>Ingrediente</th><th class="n">1 dose</th><th class="n">Da usare (${fmt(c.dosi,2)} dosi)</th><th class="n">€/unità</th><th class="n">Costo</th><th>Fornitore</th></tr>
    ${c.righe.filter(z=>z.x.nome).map(({x,i,u,base})=>{ const un=base?'kg':i?i.unita:''; const q=x.dose!=null?x.dose*c.dosi:null; return `<tr><td>${base?'<span class="chip g">base</span> ':''}${esc(x.nome)}${i&&i.surgelato?' <span class="chip g">surgelato</span>':''}${x.flag?' <span class="chip w">da verificare</span>':''}${!i&&!base?' <span class="chip r">non in elenco</span>':''}${base&&base.u!=null&&!base.full?' <span class="chip w">solo ingredienti</span>':''}</td><td class="n">${x.dose!=null?fmt(x.dose)+' '+esc(un):esc(x.doseTesto||'–')}</td><td class="n"><b>${qty(q,un)}</b></td><td class="n">${u!=null?eur3(u):'<span class="chip r">manca</span>'}</td><td class="n">${x.dose!=null&&u!=null?eur(x.dose*u*c.dosi):''}</td><td class="small mut">${esc(base?'ricetta base':i?i.fornitore:'')}</td></tr>`}).join('')}
    <tr class="tot"><td>Impasto crudo · ingredienti</td><td class="n">${fmt(c.peso)} kg</td><td class="n">${qty(c.crudo,'kg')}</td><td></td><td class="n">${eur(c.cIng)}</td><td class="small">${c.manc?`<span class="chip r">${c.manc} prezzi mancanti</span>`:''}</td></tr></table></div>
    ${r.procedimento?`<h3>Procedimento</h3><div class="proc">${esc(r.procedimento)}</div>`:''}
    <h3>Food cost per ${fmt(c.dosi,2)} dosi${sim?' <span class="chip w">simulazione</span>':''}</h3>
    <div class="fc">
      <div><span>Costo pieno di produzione</span><b>${eur(c.ckg)}/kg</b>${sim&&st.ckg!=null&&c.ckg!=null?`<span>lotto standard: ${eur(st.ckg)}/kg</span>`:''}</div>
      ${fcIpotetico(r,c)}
      ${fcBanco(r,c)}
      <div><span>Costo totale della produzione</span><b>${eur(c.tot)}</b><span>${fmt(c.fin,2)} kg finali</span></div>
    </div>
    <p class="small mut">Costo pieno = ingredienti + lavoro + energia + affitto e costi fissi della cucina${c.banco&&c.banco.u==='pz'||c.aPezzo?' (a pezzo anche il packaging)':''}. Margine = prezzo al banco senza IVA − costo pieno: è quello che resta per il negozio (affitto del negozio, banco, utile). Il prezzo ipotetico è solo un confronto: il prezzo al banco lo decidi tu.</p>
    <div class="scroll"><table class="t" style="margin-top:10px">
      <tr><td>Peso crudo</td><td class="n">${fmt(c.crudo)} kg</td><td>Perdita in cottura</td><td class="n">${pct(r.perdita||0)}</td></tr>
      <tr><td>Peso finale</td><td class="n">${fmt(c.fin)} kg</td><td>Minuti lavoro / cottura</td><td class="n">${fmt(c.tP,0)} / ${fmt(c.tC,0)}</td></tr>
      <tr><td>Ingredienti</td><td class="n">${eur(c.cIng)}</td><td>Manodopera (${eur(P.costoOrario)}/h)</td><td class="n">${eur(c.man)}</td></tr>
      <tr><td>Energia (${eur(P.energiaOra)}/h)</td><td class="n">${eur(c.en)}</td><td>Affitto e costi fissi cucina</td><td class="n">${eur(c.aff)}</td></tr>
      <tr class="tot"><td>Costo totale</td><td class="n">${eur(c.tot)}</td><td>${c.aPezzo?'Packaging a pezzo':''}</td><td class="n">${c.aPezzo?eur(c.pcost)+' '+(pk?'('+esc(pk.nome)+')':'(predefinito)'):''}</td></tr>
      <tr><td>Peso ingredienti sul costo</td><td class="n">${pct(c.pesoIng)}</td><td>Peso manodopera sul costo</td><td class="n">${pct(c.pesoMan)}</td></tr>
    </table></div>
    ${usedAsBase(r.id).length?`<p class="small">Usata come base in: ${usedAsBase(r.id).map(x=>esc(x.nome)).join(', ')}</p>`:''}
    <h3>Etichetta</h3>
    ${etiBox(r,et,c)}
  </div>`;
}
const usedAsBase=id=>ricette().filter(r=>r.righe.some(x=>x.ric===id));
function etiBox(r,et,c){
  if(!ETI) return '<p class="mut small">Archivio etichette non raggiungibile (serve la rete, e la chiave deve avere accesso anche a etichette-magiostra-dati).</p>';
  const opts=ETI.prodotti.filter(p=>!p.deleted).sort((a,b)=>a.nome.localeCompare(b.nome,'it'));
  const ord=c.righe.filter(z=>z.x.nome&&z.x.dose!=null).sort((a,b)=>b.x.dose*((b.i&&b.i.unita==='pz')?(b.i.pesoPezzo||0):1)-a.x.dose*((a.i&&a.i.unita==='pz')?(a.i.pesoPezzo||0):1)).map(z=>z.x.nome);
  let miss='';
  if(et){ const t=norm(et.ingredienti); const m=r.righe.filter(x=>x.nome&&!t.includes(norm(x.nome).split(' ')[0])).map(x=>x.nome); if(m.length) miss=`<div class="warn small">Nella ricetta ma forse non in etichetta: ${m.map(esc).join(', ')}</div>`; }
  return `<div class="row"><select class="i flex1" id="etisel"><option value="">— nessuna etichetta collegata —</option>${opts.map(p=>`<option value="${p.id}" ${p.id===r.etichetta?'selected':''}>${esc(p.nome+(p.sottotitolo?' '+p.sottotitolo:''))}</option>`).join('')}</select></div>
  ${et?`<p class="small" style="margin-top:8px"><b>Ingredienti in etichetta:</b> ${esc(et.ingredienti)}</p>${miss}`:''}
  ${ord.length?`<p class="small mut">Testo per l'etichetta dalla ricetta (ordine per peso, semilavorati e composti con i loro ingredienti): ${esc(etiTesto(r).txt)}</p>`:''}
  <div class="row"><button class="b sm" data-act="etinuova">${et?'Copia l\'ordine per peso nell\'etichetta…':'Crea l\'etichetta da questa ricetta…'}</button></div>`;
}
function ricEdit(){
  const r=EDIT; const names=ings().map(i=>i.nome);
  const basi=ricette().filter(b=>b.id!==r.id).sort((a,b)=>(a.categoria==='Basi e salse'?0:1)-(b.categoria==='Basi e salse'?0:1)||a.nome.localeCompare(b.nome,'it')).map(b=>BASE+b.nome);
  return `<div class="card"><h2>${r._new?'Nuova ricetta':'Modifica: '+esc(r.nome)}</h2>
   <div class="row"><label class="f">Nome<input class="i" data-e="nome" value="${esc(r.nome)}"></label><label class="f">Categoria<input class="i" data-e="categoria" value="${esc(r.categoria)}" list="catlist"></label><label class="f">Unità / resa<input class="i" data-e="unita" value="${esc(r.unita)}"></label></div>
   <datalist id="catlist">${CATS().map(c=>`<option value="${esc(c)}">`).join('')}</datalist>
   <datalist id="inglist">${names.map(n=>`<option value="${esc(n)}">`).join('')}${basi.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>
   <h3>Ingredienti per 1 dose (kg, litri o pezzi, come nell'elenco ingredienti)</h3><p class="small mut">Per usare una vostra preparazione (panna, besciamella, frolla…) scegli dall'elenco la voce che inizia con <b>${esc(BASE)}</b> e scrivi la dose in kg: il costo viene preso dal food cost di quella ricetta.</p>
   <div class="scroll"><table class="t"><tr><th>Ingrediente</th><th class="n">Dose</th><th>Unità</th><th></th></tr>
   ${r.righe.map((x,k)=>{ const i=x.ric?{unita:'kg'}:INAME.get((x.nome||'').toLowerCase()); return `<tr><td><input class="i" list="inglist" data-row="${k}" data-f="nome" value="${esc((x.ric?BASE:'')+x.nome)}">${x.nome&&!i?'<div class="small" style="color:var(--r)">Non è nell\'elenco ingredienti: aggiungilo in "Ingredienti e prezzi" o scegli un nome dall\'elenco.</div>':''}</td><td class="n"><input class="i n" inputmode="decimal" data-row="${k}" data-f="dose" value="${x.dose!=null?fmt(x.dose,4):esc(x.doseTesto)}"></td><td class="mut">${i?esc(i.unita):''}</td><td><button class="b sm d" data-act="delriga:${k}">✕</button></td></tr>`}).join('')}
   </table></div>
   <div class="row" style="margin-top:6px"><button class="b sm" data-act="addriga">+ Ingrediente</button></div>
   <h3>Procedimento</h3><textarea class="i" data-e="procedimento">${esc(r.procedimento)}</textarea>
   <h3>Produzione e prezzo</h3>
   <div class="row">
    <label class="f s">Lotto standard (dosi)<input class="i" inputmode="decimal" data-n="lotto" value="${fmt(r.lotto)}"></label>
    <label class="f s">Tempo produzione (min)<input class="i" inputmode="decimal" data-n="tProd" value="${fmt(r.tProd)}"></label>
    <label class="f s">Tempo cottura (min)<input class="i" inputmode="decimal" data-n="tCott" value="${fmt(r.tCott)}"></label>
    <label class="f s">Perdita in cottura %<input class="i" inputmode="decimal" data-p="perdita" value="${r.perdita!=null?fmt(r.perdita*100,1):''}"></label>
    <label class="f s">Ricarico % (vuoto = ${pct(S.parametri.ricaricoDef)})<input class="i" inputmode="decimal" data-p="ricarico" value="${r.ricarico!=null?fmt(r.ricarico*100,1):''}"></label>
    <label class="f">Come lo vendi<select class="i" data-e="vendita"><option value="kg" ${r.vendita!=='pezzo'?'selected':''}>Solo al kg (prezzo al kg e all'etto)</option><option value="pezzo" ${r.vendita==='pezzo'?'selected':''}>Al kg e anche a pezzo / confezione</option></select></label><label class="f s">Pezzatura (g)<input class="i" inputmode="decimal" data-n="confezione" value="${fmt(r.confezione)}"></label>
    <label class="f">Packaging<select class="i" data-e="packaging"><option value="">predefinito (${eur(S.parametri.packagingDef)})</option>${packs().map(p=>`<option value="${p.id}" ${p.id===r.packaging?'selected':''}>${esc(p.nome)}</option>`).join('')}</select></label>
    <label class="f s">Pezzi packaging<input class="i" inputmode="decimal" data-n="pezziPack" value="${fmt(r.pezziPack)}"></label>
    <label class="f s">Prezzo al banco €<input class="i" inputmode="decimal" data-n="prezzoBanco" value="${fmt(r.prezzoBanco,2)}"></label>
    <label class="f s">Unità prezzo<select class="i" data-e="unitaBanco">${['','€/etto','€/kg','€/pz','€/porzione'].map(u=>`<option ${u===r.unitaBanco?'selected':''}>${u}</option>`).join('')}</select></label>
   </div>
   <label class="f" style="margin-top:8px">Note<textarea class="i" style="min-height:60px" data-e="note">${esc(r.note)}</textarea></label>
   <div class="row" style="margin-top:12px"><button class="b p" data-act="salvaric">Salva</button><button class="b" data-act="annullaric">Annulla</button></div>
  </div>`;
}

