'use strict';
/* ===================== ETICHETTE (archivio separato) ===================== */
/* testo ingredienti per l'etichetta: ordine per peso, semilavorati e ingredienti composti con i loro ingredienti tra parentesi, surgelati con * */
const COMPOSTI_PROB=/margarin|maiones|salsa|dado|brodo|panna|bevanda|latte di|sfoglia|frolla|cioccolat|seitan|tempeh|tofu|senape|ketchup|pesto|preparat|burro di|formaggi|wurstel|biscott|pane |pangrattat|pasta |gnocchi|curry|aceto balsamico|tamari|salsa di soia|miso|lievito in scaglie|gomasio/i;
function etiRighe(r,stack){
  stack=stack||new Set([r.id]);
  const peso=x=>{ const i=x.ing?getI(x.ing):null; return (x.dose||0)*(i&&i.unita==='pz'?(i.pesoPezzo||0):1); };
  const out=[], warn=new Set();
  r.righe.filter(x=>x.nome).slice().sort((a,b)=>peso(b)-peso(a)).forEach(x=>{
    if(x.ric){ const b=getR(x.ric); if(!b||stack.has(b.id)){ out.push(x.nome.toLowerCase()); return; }
      const st=new Set(stack); st.add(b.id); const sub=etiRighe(b,st); sub.warn.forEach(w=>warn.add(w));
      out.push(b.nome.replace(/\s*\([^)]*\)/g,'').trim().toLowerCase()+(sub.parti.length?' ('+sub.parti.join(', ')+')':'')); return; }
    const i=x.ing?getI(x.ing):null;
    const nome=((i&&i.nomeEtichetta)||x.nome).toLowerCase();
    if(i&&!i.composizione&&COMPOSTI_PROB.test(nome+' ')) warn.add(i.nome);
    out.push(nome+(i&&i.surgelato?'*':'')+(i&&i.composizione?' ('+i.composizione.replace(/\*/g,'').replace(/\s+/g,' ').trim()+')':''));
  });
  return {parti:out,warn:[...warn]};
}
function etiTesto(r){ const e=etiRighe(r); let t=e.parti.join(', '); t=t?t.charAt(0).toUpperCase()+t.slice(1)+'.':''; return {txt:t,warn:e.warn,surg:/\*/.test(t)}; }
/* ===== aggiornamento automatico (dalla 1.5.2) =====
   Un prodotto dell'archivio etichette con fonte:'cucina' e ricetta:<id> ha il testo ingredienti gestito dalla Cucina:
   a ogni salvataggio la Cucina rigenera il testo e, se è cambiato, lo riscrive (ingAt = momento della modifica del testo).
   Un'etichetta collegata a più ricette non può essere automatica. Nell'app etichette il testo di questi prodotti non si modifica;
   "Modifica a mano" li sgancia (fonte:''), e da lì la Cucina non li tocca più. */
function etiLinks(){ const m=new Map(); ricette().forEach(r=>{ if(r.etichetta){ if(!m.has(r.etichetta)) m.set(r.etichetta,[]); m.get(r.etichetta).push(r); } }); return m; }
function etiStato(r,L){
  if(!r.etichetta) return 'nessuna'; if(!ETI) return '?';
  const p=ETI.prodotti.find(x=>x.id===r.etichetta&&!x.deleted); if(!p) return 'mancante';
  if(((L||etiLinks()).get(r.etichetta)||[]).length>1) return 'doppia';
  return p.fonte==='cucina'&&p.ricetta===r.id?'auto':'manuale';
}
function etiDaAggiornare(data){
  const out=[];
  for(const [pid,rs] of etiLinks()){ if(rs.length!==1) continue; const r=rs[0];
    const p=data.prodotti.find(x=>x.id===pid); if(!p||p.deleted||p.fonte!=='cucina'||p.ricetta!==r.id) continue;
    const txt=etiTesto(r).txt; if(txt&&txt!==p.ingredienti) out.push({r,p,txt}); }
  return out;
}
const etiStamp=p=>{ const t=Math.max(now(),(p.updatedAt||0)+1); p.updatedAt=t; p.ingAt=t; };
async function etiApply(fn,msg){
  const repo=CFG.etiRepo||ETI_REPO;
  for(let k=0;k<4;k++){
    const {data,sha}=await ghReadJSON(repo,'archivio.json'); if(!data||!Array.isArray(data.prodotti)) return {ok:false,err:'archivio etichette vuoto o non raggiungibile'};
    const nomi=fn(data); if(!nomi.length||PROVA){ ETI=data; return {ok:true,nomi,prova:PROVA&&nomi.length>0}; }
    const w=await ghWriteJSON(repo,'archivio.json',data,sha,msg(nomi));
    if(w.ok){ ETI=data; return {ok:true,nomi}; }
    if(w.status!==409&&w.status!==422) return {ok:false,err:ghErr(w)};
  }
  return {ok:false,err:'troppi salvataggi contemporanei, riprovo al prossimo salvataggio'};
}
let etiAutoBusy=false, etiAutoSig='', etiAutoAt=0;
function etiAutoMaybe(){ // dopo ogni sincronizzazione: solo se i testi generati sono cambiati, o ogni 5 minuti
  if(!CFG) return; const sig=[...etiLinks()].map(([pid,rs])=>pid+':'+rs.map(r=>etiTesto(r).txt).join('|')).join('\n');
  if(sig===etiAutoSig&&now()-etiAutoAt<300000) return; etiAutoSig=sig; etiAutoAt=now(); etiAuto();
}
async function etiAuto(){
  if(!CFG||etiAutoBusy) return; etiAutoBusy=true;
  try{
    await loadEti(); if(!ETI||!etiDaAggiornare(ETI).length) return;
    const res=await etiApply(data=>{ const nomi=[]; etiDaAggiornare(data).forEach(({p,txt})=>{ p.ingredienti=txt; etiStamp(p); p.updatedBy='App Cucina (automatico)'; nomi.push(p.nome); }); return nomi; },
      nomi=>'Etichette aggiornate dalla Cucina: '+nomi.join(', '));
    if(!res.ok) setStatus('Etichette: '+res.err,true);
    else if(res.nomi.length) toast((res.prova?'PROVA, non salvato. Avrei aggiornato le etichette: ':'Etichette aggiornate: ')+res.nomi.join(', ')+(res.prova?'':'. Le confezioni già in banco vanno rietichettate.'),9000);
    if(!EDIT) render();
  }catch(e){ console.warn('etiAuto',e); }finally{ etiAutoBusy=false; }
}
let ETIAUTO_R=null;
function etiAutoDlg(r){
  const p=ETI&&ETI.prodotti.find(x=>x.id===r.etichetta); if(!p) return;
  const E=etiTesto(r); ETIAUTO_R=r.id;
  if(!E.txt) return alert('Questa ricetta non ha ancora ingredienti.');
  dialog('Etichetta automatica: '+p.nome,`<p class="small">Da adesso il testo ingredienti di questa etichetta lo scrive la Cucina, e si aggiorna da solo ogni volta che cambi la ricetta, un suo semilavorato o uno dei suoi ingredienti (nome, lista ingredienti, surgelato).</p>
   <p class="small"><b>Testo attuale in etichetta</b><br>${esc(p.ingredienti)||'<i>vuoto</i>'}</p>
   <p class="small"><b>Testo che verrà scritto (dalla ricetta)</b><br>${esc(E.txt)}</p>
   ${p.ingredienti===E.txt?'<p class="small ok">Sono uguali.</p>':'<div class="warn small">Sono diversi: controlla che la ricetta sia giusta (ingredienti, nomi, farine, liste dei composti). Quello che c\'è solo nel testo attuale andrà perso.</div>'}
   ${E.warn.length?`<div class="warn small">Forse composti ma senza lista ingredienti: <b>${E.warn.map(esc).join(', ')}</b>.</div>`:''}
   <p class="small mut">Nell'app etichette il testo non si potrà modificare: per tornare a scriverlo a mano, "Modifica a mano" nell'app etichette o "Rendi manuale" qui.</p>`,
   [['Annulla','dlgclose'],['Usa il testo della ricetta e aggiorna da sola','etiautook','p']]);
}
async function etiRendiAuto(rid){
  const r=getR(rid); if(!r) return; const txt=etiTesto(r).txt;
  if((etiLinks().get(r.etichetta)||[]).length>1) return alert('Questa etichetta è collegata a più ricette: non può aggiornarsi da sola.');
  const res=await etiApply(data=>{ const p=data.prodotti.find(x=>x.id===r.etichetta&&!x.deleted); if(!p||!txt) return []; p.ingredienti=txt; p.fonte='cucina'; p.ricetta=r.id; etiStamp(p); p.updatedBy='App Cucina'; return [p.nome]; },
    n=>'Etichette: '+n[0]+' ora si aggiorna dalla Cucina');
  closeDlg(); if(!res.ok) return alert('Non salvato: '+res.err);
  toast(res.prova?'PROVA: non salvato':'Fatto: l\'etichetta ora si aggiorna da sola',4000); render();
}
async function etiRendiManuale(r){
  if(!confirm('Il testo resta com\'è, ma non si aggiornerà più quando cambi la ricetta. Continuare?')) return;
  const res=await etiApply(data=>{ const p=data.prodotti.find(x=>x.id===r.etichetta&&!x.deleted); if(!p) return []; p.fonte=''; etiStamp(p); p.updatedBy='App Cucina'; return [p.nome]; }, n=>'Etichette: '+n[0]+' torna manuale');
  if(!res.ok) return alert('Non salvato: '+res.err); toast(res.prova?'PROVA: non salvato':'Etichetta manuale',3000); render();
}
async function etiAutoUguali(){
  const L=etiLinks(); const rs=ricette().filter(r=>etiStato(r,L)==='manuale').filter(r=>{ const p=ETI.prodotti.find(x=>x.id===r.etichetta); const t=etiTesto(r).txt; return t&&p.ingredienti===t; });
  if(!rs.length) return;
  const res=await etiApply(data=>{ const nomi=[]; rs.forEach(r=>{ const p=data.prodotti.find(x=>x.id===r.etichetta&&!x.deleted); const t=etiTesto(r).txt; if(p&&p.ingredienti===t&&p.fonte!=='cucina'){ p.fonte='cucina'; p.ricetta=r.id; etiStamp(p); p.updatedBy='App Cucina'; nomi.push(p.nome); } }); return nomi; },
    n=>'Etichette: ora si aggiornano dalla Cucina '+n.join(', '));
  if(!res.ok) return alert('Non salvato: '+res.err); toast((res.prova?'PROVA, non salvato: ':'Ora automatiche: ')+res.nomi.join(', '),5000); render();
}
function etiQuadroCard(){
  if(!ETI) return '';
  const L=etiLinks(), R=ricette().filter(r=>r.etichetta), st={auto:[],manuale:[],doppia:[],mancante:[]};
  R.forEach(r=>{ const s=etiStato(r,L); if(st[s]) st[s].push(r); });
  if(!R.length) return '';
  const ug=st.manuale.filter(r=>{ const p=ETI.prodotti.find(x=>x.id===r.etichetta); const t=etiTesto(r).txt; return t&&p.ingredienti===t; });
  const dif=st.manuale.filter(r=>!ug.includes(r));
  return `<div class="card"><h2>Etichette collegate alle ricette</h2>
   <p class="small"><span class="chip ok">${st.auto.length} si aggiornano da sole</span> <span class="chip w">${st.manuale.length} manuali</span>${st.doppia.length?` <span class="chip r">${st.doppia.length} ricette con un'etichetta in comune</span>`:''}${st.mancante.length?` <span class="chip r">${st.mancante.length} etichette non trovate</span>`:''}</p>
   ${ug.length?`<p class="small">${ug.length} manuali hanno già lo stesso testo della ricetta: ${ug.map(r=>esc(r.nome)).join(', ')}. <button class="b sm p" data-act="etiautouguali">Rendile automatiche</button></p>`:''}
   ${dif.length?`<p class="small">Testo diverso dalla ricetta, da controllare una per una (apri la ricetta → "Rendi automatica"): ${dif.map(r=>`<a href="#" data-ric="${r.id}">${esc(r.nome)}</a>`).join(', ')}</p>`:''}
   ${st.doppia.length?`<p class="small">Un'etichetta può seguire una sola ricetta: ${st.doppia.map(r=>esc(r.nome)).join(', ')}. Per renderle automatiche crea un'etichetta per ciascuna.</p>`:''}
   <p class="small mut">Automatiche = il testo ingredienti lo scrive la Cucina e si aggiorna da solo quando cambi una ricetta, un semilavorato o un ingrediente. Le altre parti dell'etichetta (conservazione, scadenza, prezzo, tracce) restano dell'app etichette.</p></div>`;
}
async function etiWrite(r){
  const E=etiTesto(r), txt=E.txt;
  const ex=r.etichetta?ETI.prodotti.find(p=>p.id===r.etichetta):null;
  if(!ex&&!txt) return alert('Questa ricetta non ha ancora ingredienti: inseriscili prima di creare l\'etichetta.');
  dialog(ex?'Aggiorna etichetta':'Nuova etichetta',`<p class="small">Testo ingredienti in ordine di peso decrescente, preso dalla ricetta. I semilavorati (ricette base) e gli ingredienti composti (quelli con la lista ingredienti, es. margarina) sono già scritti con i loro ingredienti tra parentesi. I surgelati hanno l'asterisco: la nota "*Ingrediente surgelato." la aggiunge l'app etichette. Gli allergeni li evidenzia l'app etichette.</p>
   ${E.warn.length?`<div class="warn small">Forse composti ma senza lista ingredienti: <b>${E.warn.map(esc).join(', ')}</b>. Aggiungila in "Ingredienti e prezzi" (apri l'ingrediente, campo "Ingredienti di questo prodotto"), poi rigenera il testo.</div>`:''}
   <label class="f">Nome in etichetta<input class="i" id="e_nome" value="${esc(ex?ex.nome:r.nome)}"></label>
   <label class="f">Ingredienti<textarea class="i" id="e_ing">${esc(ex?ex.ingredienti:txt)}</textarea></label>
   ${ex?`<p class="small mut">Testo attuale in etichetta: ${esc(ex.ingredienti)}</p><button class="b sm" data-act="etiord">Sostituisci con il testo generato dalla ricetta</button>`:''}
   <p class="small mut">Viene scritto nell'archivio dell'app etichette: tutti i PC lo vedono entro 20 secondi.${ex?' Se cambi il testo a mano, l\'etichetta smette di aggiornarsi da sola.':' Se lasci il testo com\'è, l\'etichetta si aggiornerà da sola a ogni modifica della ricetta o dei suoi ingredienti.'}</p>`,[['Annulla','dlgclose'],[ex?'Salva nell\'etichetta':'Crea etichetta','etisave','p']]);
  etiWrite.txt=txt;
}
async function etiSave(r){
  const nome=$('#e_nome').value.trim(), ing=$('#e_ing').value.trim(); if(!nome||!ing) return alert('Nome e ingredienti servono.');
  const repo=CFG.etiRepo||ETI_REPO;
  for(let k=0;k<4;k++){
    const {data,sha}=await ghReadJSON(repo,'archivio.json'); if(!data) return alert('Archivio etichette vuoto o non raggiungibile.');
    let p=r.etichetta?data.prodotti.find(x=>x.id===r.etichetta):null;
    const t=now();
    if(p){ if(p.fonte==='cucina'&&ing!==p.ingredienti){ p.fonte=''; } p.nome=nome; p.ingredienti=ing; p.updatedAt=Math.max(t,(p.updatedAt||0)+1); p.ingAt=p.updatedAt; p.updatedBy='App Cucina'; }
    else { const id='cuc'+t.toString(36); const auto=ing===etiTesto(r).txt; p={id,updatedAt:t,ingAt:t,fonte:auto?'cucina':'',ricetta:auto?r.id:'',updatedBy:'App Cucina',nome,sottotitolo:'',ingredienti:ing,tracce:[],tracceExtra:'',conservazione:'cs1',diciture:'',tipoData:'scadenza',giorni:4,prezzoKg:'',prezzoPezzo:'',tipoPrezzo:'kg',pezzature:[],mostraPrezzo:false,deleted:false,linea:'standard',categoria:'',fraseFronte:''}; data.prodotti.push(p); r.etichetta=id; touch(r); commit(); }
    const w=await ghWriteJSON(repo,'archivio.json',data,sha,'Etichette: '+nome+' da app Cucina');
    if(w.ok){ ETI=data; closeDlg(); render(); toast('Etichetta salvata: controllala nell\'app etichette (conservazione, giorni, tracce)'); return; }
    if(w.status!==409&&w.status!==422) return alert('Non salvata: '+ghErr(w));
  }
  alert('Non salvata: troppi salvataggi contemporanei, riprova.');
}


/* ===== Etichette senza ricetta (dalla 1.5.5) =====
   Prodotti dell'archivio etichette che nessuna ricetta usa: si collegano a una ricetta, si crea una ricetta nuova
   partendo dall'etichetta, oppure si segnano "non serve ricetta" (S.etiNoRic, sincronizzato tra i computer).
   Le etichette nuove (mai viste su questo computer) danno un avviso all'apertura. */
const ETI_VISTE=PFX+'cuc_eti_viste';
function etiNoRicSet(){ return new Set((S.etiNoRic||[]).filter(x=>!x.deleted).map(x=>x.id)); }
function etiSenzaRicetta(tutte){
  if(!ETI) return []; const L=etiLinks(), no=etiNoRicSet();
  return ETI.prodotti.filter(p=>!p.deleted&&!L.has(p.id)&&(tutte||!no.has(p.id))).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)||a.nome.localeCompare(b.nome,'it'));
}
function etiViste(){ try{ const v=JSON.parse(localStorage.getItem(ETI_VISTE)||'null'); return Array.isArray(v)?new Set(v):null; }catch(e){ return null; } }
function etiSegnaViste(){ if(ETI) localStorage.setItem(ETI_VISTE,JSON.stringify(ETI.prodotti.map(p=>p.id))); }
function etiNuove(){ const v=etiViste(); if(!v) return []; return etiSenzaRicetta().filter(p=>!v.has(p.id)); }
function etiAvvisoNuove(){ // dopo aver letto l'archivio etichette
  if(!ETI) return; if(!etiViste()){ etiSegnaViste(); return; } // prima volta su questo computer: niente avviso per le etichette che c'erano già
  const n=etiNuove(); if(n.length) toast((n.length===1?'Nuova etichetta senza ricetta: '+n[0].nome:n.length+' nuove etichette senza ricetta')+' (vedi Quadro)',7000);
}
function etiNoRicCard(){
  if(!ETI) return ''; const tutte=!!etiNoRicCard.tutte, E=etiSenzaRicetta(tutte), no=etiNoRicSet(), nuove=new Set(etiNuove().map(p=>p.id));
  const da=E.filter(p=>!no.has(p.id)).length, nNo=etiSenzaRicetta(true).length-etiSenzaRicetta().length;
  if(!E.length&&!nNo) return '';
  const prezzo=p=>p.tipoPrezzo==='pezzo'&&p.prezzoPezzo?eur(+p.prezzoPezzo)+'/pz':p.prezzoKg?eur(+p.prezzoKg)+'/kg':'';
  return `<div class="card" id="etinoric"><h2>Etichette senza ricetta${nuove.size?` <span class="chip w">${nuove.size} nuov${nuove.size===1?'a':'e'}</span>`:''}</h2>
   <p class="small">${da} prodotti dell'app etichette non sono collegati a nessuna ricetta. Per ognuno: <b>Collega</b> a una ricetta che c'è già, <b>Crea ricetta</b> partendo dall'etichetta, oppure <b>Non serve</b> (prodotti rivenduti, confezionati da altri).${nNo?` ${nNo} segnati "non serve": <a href="#" data-act="etinrtutte">${tutte?'nascondili':'mostrali'}</a>.`:''}</p>
   ${E.length?`<div class="scroll" style="max-height:420px"><table class="t"><tr><th>Etichetta</th><th class="hm">Ingredienti</th><th class="n hm">Prezzo</th><th></th></tr>
   ${E.map(p=>`<tr><td>${nuove.has(p.id)?'<span class="chip w">nuova</span> ':''}<b>${esc(p.nome)}</b>${p.sottotitolo?`<br><span class="small mut">${esc(p.sottotitolo)}</span>`:''}</td><td class="small hm">${esc((p.ingredienti||'').slice(0,140))}${(p.ingredienti||'').length>140?'…':''}</td><td class="n hm">${esc(prezzo(p))}</td>
     <td class="n" style="white-space:nowrap">${no.has(p.id)?`<button class="b sm" data-act="etinrsi:${p.id}">Rimetti in elenco</button>`:`<button class="b sm" data-act="etinrlink:${p.id}">Collega</button> <button class="b sm p" data-act="etinrnew:${p.id}">Crea ricetta</button> <button class="b sm" data-act="etinrno:${p.id}">Non serve</button>`}</td></tr>`).join('')}</table></div>`:''}
   <p class="small mut">Collegare non cambia l'etichetta: per farla aggiornare da sola, apri poi la ricetta → "Rendi automatica".</p></div>`;
}
function etiNoRic(pid,si){
  const x=(S.etiNoRic||(S.etiNoRic=[])).find(y=>y.id===pid);
  if(x){ x.deleted=!si; touch(x); } else S.etiNoRic.push({id:pid,updatedAt:now(),deleted:!si});
  commit(); render(); toast(si?'Segnata: non serve ricetta':'Rimessa nell\'elenco');
}
let ETINR_P='';
function etiNoRicLinkDlg(pid){
  const p=ETI&&ETI.prodotti.find(x=>x.id===pid); if(!p) return; ETINR_P=pid;
  dialog('Collega "'+p.nome+'" a una ricetta',`<input class="i" id="ricq" type="search" aria-label="Cerca la ricetta" placeholder="Cerca la ricetta…" autocomplete="off" value="">
   <div class="etipick"><div class="etires" id="ricres">${etiRicCerca(p.nome,true)}</div></div>
   <p class="small mut">Mostro prima le ricette con il nome più simile all'etichetta. Una ricetta ha una sola etichetta: se ne aveva già un'altra, viene sostituita.</p>`,[['Annulla','dlgclose']]);
  setTimeout(()=>$('#ricq')?.focus(),50);
}
function etiRicCerca(q,simili){
  const n=norm(q||''), parole=n.split(/\s+/).filter(w=>w.length>(simili?3:0));
  return ricette().map(r=>{ const t=norm(r.nome); const s=simili?parole.filter(w=>t.includes(w)).length*10-t.length/100:(parole.every(w=>t.includes(w))?(t.startsWith(n)?100:0)-t.length/100:null); return s==null?null:{r,s}; })
    .filter(Boolean).sort((a,b)=>b.s-a.s||a.r.nome.localeCompare(b.r.nome,'it')).slice(0,60)
    .map(({r})=>`<button type="button" data-act="etinrpick:${r.id}">${esc(r.nome)}${r.etichetta?`<small>· ha già un'etichetta</small>`:''}</button>`).join('')||'<p class="small mut" style="padding:8px 12px;margin:0">Nessuna ricetta con queste parole.</p>';
}
function etiNoRicPick(rid){
  const r=getR(rid), p=ETI&&ETI.prodotti.find(x=>x.id===ETINR_P); if(!r||!p) return;
  if(r.etichetta&&r.etichetta!==p.id){ const v=ETI.prodotti.find(x=>x.id===r.etichetta); if(!confirm(`"${r.nome}" è già collegata a "${v?v.nome:'un\'altra etichetta'}". Sostituire con "${p.nome}"?`)) return; }
  r.etichetta=p.id; touch(r); commit(); closeDlg(); toast('Collegata: '+r.nome+' → '+p.nome,4000); render();
}
function etiNoRicNew(pid){
  const p=ETI&&ETI.prodotti.find(x=>x.id===pid); if(!p) return;
  if(EDIT&&!confirm('Esci dalla modifica in corso senza salvare?')) return;
  const r=newRecipe(); r.nome=p.nome.trim(); r.etichetta=p.id;
  if(ricette().some(x=>x.nome.toLowerCase()===r.nome.toLowerCase())) r.nome+=' (da etichetta)';
  if(p.tipoPrezzo==='pezzo'&&+p.prezzoPezzo){ r.vendita='pezzo'; r.prezzoBanco=+p.prezzoPezzo; r.unitaBanco='€/pz'; }
  else if(+p.prezzoKg){ r.vendita='kg'; r.prezzoBanco=+p.prezzoKg; r.unitaBanco='€/kg'; }
  r.note=('Creata dall\'etichetta "'+p.nome+'". Ingredienti in etichetta: '+(p.ingredienti||'—')).slice(0,2000);
  // dalla 1.5.6: righe già compilate con gli ingredienti riconosciuti nel testo dell'etichetta (dosi vuote)
  const rg=etiRigheDaTesto(p.ingredienti||''); if(rg.length) r.righe=rg;
  const nr=rg.filter(x=>!x.ing&&!x.ric).length;
  EDIT=r; SEL=r.id; TAB='ricette'; render(); if(typeof scrollEdit==='function') scrollEdit();
  toast(rg.length?'Nuova ricetta da "'+p.nome+'": '+rg.length+' ingredienti presi dall\'etichetta'+(nr?' ('+nr+' non in elenco, in rosso)':'')+'. Controllali, metti dosi e tempi, poi Salva':'Nuova ricetta da "'+p.nome+'": aggiungi ingredienti e dosi, poi Salva',9000);
}

/* ===== Modifiche nelle Etichette (dalla 1.5.5) =====
   Confronta l'archivio etichette di adesso con quello visto l'ultima volta su questo computer (localStorage, solo i campi
   che contano) ed elenca le differenze: prodotti nuovi o eliminati, prezzo, ingredienti, nome, conservazione, scadenza, tracce.
   Non elenca le modifiche fatte dalla Cucina (updatedBy "App Cucina…"). "Segna come viste" = la foto di adesso diventa il riferimento. */
const ETI_FOTO=PFX+'cuc_eti_foto';
const ETI_CAMPI=[['nome','Nome'],['sottotitolo','Sottotitolo'],['ingredienti','Ingredienti'],['tracce','Tracce'],['tracceExtra','Tracce (altro)'],['conservazione','Conservazione'],['diciture','Diciture'],['tipoData','Tipo di scadenza'],['giorni','Giorni'],['tipoPrezzo','Prezzo al kg/pezzo'],['prezzoKg','Prezzo €/kg'],['prezzoPezzo','Prezzo €/pezzo'],['mostraPrezzo','Prezzo in etichetta'],['stato','Stato (surgelato/decongelato)'],['fonte','Ingredienti dalla Cucina']];
function etiFotoDi(d){ const o={}; (d&&d.prodotti||[]).forEach(p=>{ const x={u:p.updatedAt||0,d:!!p.deleted}; ETI_CAMPI.forEach(([k])=>{ const v=p[k]; x[k]=Array.isArray(v)?v.join(', '):v==null?'':String(v); }); o[p.id]=x; }); return o; }
function etiFoto(){ try{ const v=JSON.parse(localStorage.getItem(ETI_FOTO)||'null'); return v&&typeof v==='object'?v:null; }catch(e){ return null; } }
function etiFotoSalva(){ if(ETI) try{ localStorage.setItem(ETI_FOTO,JSON.stringify(etiFotoDi(ETI))); }catch(e){} }
function etiModifiche(){
  if(!ETI) return []; const F=etiFoto(); if(!F) return [];
  const out=[], val=(k,v)=>k==='fonte'?(v==='cucina'?'sì (automatica)':'no (scritti a mano)'):k==='mostraPrezzo'?(v==='true'?'sì':'no'):v;
  ETI.prodotti.forEach(p=>{
    if(/^App Cucina/.test(p.updatedBy||'')) return; const a=F[p.id], chi=p.updatedBy||'', quando=p.updatedAt||0;
    if(!a){ if(!p.deleted) out.push({p,tipo:'nuovo',chi,quando}); return; }
    if(p.deleted&&!a.d){ out.push({p,tipo:'eliminato',chi,quando}); return; }
    if(p.deleted) return;
    const c=[]; ETI_CAMPI.forEach(([k,l])=>{ const v=Array.isArray(p[k])?p[k].join(', '):p[k]==null?'':String(p[k]); if((a[k]??'')!==v) c.push({l,k,prima:val(k,a[k]??''),dopo:val(k,v)}); });
    if(c.length) out.push({p,tipo:'cambiato',c,chi,quando});
  });
  return out.sort((x,y)=>y.quando-x.quando);
}
function etiModAvviso(){ if(!ETI) return; if(!etiFoto()){ etiFotoSalva(); return; } const n=etiModifiche().length; if(n) toast(n+(n===1?' modifica':' modifiche')+' nell\'app Etichette (vedi Quadro)',7000); }
// solo il pezzo cambiato di un testo lungo, con qualche parola intorno: "…carote, polpa [olio extravergine di oliva] → [olio di girasole], sale…"
function etiDiff(a,b){
  a=String(a||'').trim(); b=String(b||'').trim(); if(a.length+b.length<120) return `<span class="prima">${esc(a)||'<i>vuoto</i>'}</span> → <span class="dopo">${esc(b)||'<i>vuoto</i>'}</span>`;
  const A=a.split(/(\s+)/), B=b.split(/(\s+)/); let i=0; while(i<A.length&&i<B.length&&A[i]===B[i]) i++;
  let j=0; while(j<A.length-i&&j<B.length-i&&A[A.length-1-j]===B[B.length-1-j]) j++;
  const ctx=8, pre=A.slice(Math.max(0,i-ctx),i).join(''), post=A.slice(A.length-j,Math.min(A.length,A.length-j+ctx)).join('');
  const via=A.slice(i,A.length-j).join('').trim(), nuovo=B.slice(i,B.length-j).join('').trim();
  return `${i>ctx?'…':''}${esc(pre)}<span class="prima">${esc(via)||'<i>niente</i>'}</span> → <span class="dopo">${esc(nuovo)||'<i>tolto</i>'}</span> ${esc(post)}${j>ctx?'…':''}`;
}
function etiModCard(){
  const M=etiModifiche(); if(!M.length) return '';
  const L=etiLinks(), data=t=>t?new Date(t).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
  const ric=p=>{ const rs=L.get(p.id)||[]; return rs.length?` · ricetta <a href="#" data-ric="${rs[0].id}">${esc(rs[0].nome)}</a>`:''; };
  return `<div class="card" id="etimod"><h2>Modifiche nelle Etichette <span class="chip w">${M.length}</span></h2>
   <p class="small mut">Cambiamenti fatti nell'app Etichette dall'ultima volta che hai segnato "viste". Se un ingrediente è stato cambiato per errore, correggilo nell'app Etichette (o nella ricetta, se l'etichetta è automatica).</p>
   <div class="scroll" style="max-height:460px">${M.map(m=>`<div class="etimod"><div><b>${esc(m.p.nome)}</b> ${m.tipo==='nuovo'?'<span class="chip w">nuova etichetta</span>':m.tipo==='eliminato'?'<span class="chip r">eliminata</span>':''}<span class="small mut"> · ${esc(m.chi||'postazione senza nome')} · ${data(m.quando)}${ric(m.p)}</span></div>
     ${m.c?m.c.map(c=>`<div class="small${c.k==='ingredienti'||c.k==='tracce'?' imp':''}"><b>${esc(c.l)}</b>: ${etiDiff(c.prima,c.dopo)}</div>`).join(''):''}</div>`).join('')}</div>
   <p style="margin-top:8px"><button class="b sm p" data-act="etimodviste">Segna tutte come viste</button></p></div>`;
}

/* ===== Crea ricetta: ingredienti presi dal testo dell'etichetta (dalla 1.5.6) =====
   Il testo ingredienti si divide alle virgole di primo livello (le parentesi restano col loro ingrediente),
   si tolgono asterischi, percentuali e parentesi, e ogni voce si abbina a un ingrediente dell'elenco
   (nome o "nome in etichetta") o a una ricetta base. Quello che non si riconosce resta scritto com'è:
   il modulo lo segna in rosso ("Non è nell'elenco ingredienti"). Le dosi restano vuote. */
// nomi scritti in modo diverso tra etichetta e ricettario: si riducono alla stessa forma prima di confrontarli
const ETI_SINONIMI=[[/\bolio (di )?semi (di )?/g,'olio di '],[/\b(albicocche|prugne|fichi) secche\b/g,'$1 disidratate'],[/\bextra ?vergine\b|\bextravergine\b/g,'evo'],[/\bbevanda (a base )?di\b/g,'latte di'],[/\buva sultanina\b|\buvetta\b/g,'uva passa'],[/\bpangrattato\b/g,'pan grattato'],
  [/\blievito (in scaglie|alimentare in scaglie)\b/g,'lievito alimentare'],[/\btahin[ai]?\b|\btahini\b/g,'thaina'],[/\bcoste\b|\bbieta\b/g,'biete'],[/\bsucco (di )?limone\b/g,'limoni'],
  [/\bfarina di (grano tenero|frumento) tipo\b/g,'farina'],[/\bfarina di grano tenero\b/g,'farina'],[/\bamido di mais\b/g,'maizena'],[/\bcocco (in scaglie|rapato|grattugiato)\b/g,'cocco rape'],
  [/\bsciroppo d agave\b/g,'sciroppo di agave'],[/\bpolpa e succo di pomodoro\b/g,'polpa di pomodoro']];
const ETI_VUOTE=new Set(['di','d','del','della','dello','dei','degli','delle','e','ed','a','al','alla','in','con','tipo','da','il','la','le','lo','i','gli']);
function etiForma(t){ let n=norm(t); ETI_SINONIMI.forEach(([re,v])=>n=n.replace(re,v)); return n.split(' ').filter(w=>w&&!ETI_VUOTE.has(w)).map(w=>w.length>3&&/[aeio]$/.test(w)?w.slice(0,-1):w); }
function etiVoci(txt){
  const out=[]; let liv=0, cur='', frase=0; const pezzi=[];
  txt=String(txt||'').replace(/\b(zucch|bev|giras|bicarb|conc|natur|integr|int|melanz|margar|veg|germ|vegan|biol|ext|verg)\.\s*/gi,(m,a)=>({zucch:'zucchero',bev:'bevanda',giras:'girasole',bicarb:'bicarbonato',conc:'concentrato',natur:'naturale',integr:'integrale',int:'integrale',margar:'margarina',veg:'vegetale',germ:'germogliato',melanz:'melanzane',vegan:'vegano',biol:'biologico',ext:'extra',verg:'vergine'})[a.toLowerCase()]+' ').replace(/\s+e\/o\s+/gi,', '); // abbreviazioni con il punto; "melanzane e/o zucchine" = due voci
  for(const ch of txt){ if(ch==='('||ch==='[') liv++; if(ch===')'||ch===']') liv=Math.max(0,liv-1);
    if(liv===0&&(ch===','||ch===';'||ch==='.'&&!/\d$/.test(cur))){ pezzi.push([cur,frase]); cur=''; if(ch==='.') frase++; } else cur+=ch; }
  pezzi.push([cur,frase]);
  let g=0, fPrec=0;
  pezzi.forEach(([v,f])=>{ let t=v.replace(/\*/g,'').trim(), titolo='';
    const dp=t.indexOf(':'), pp=t.indexOf('('); if(dp>0&&(pp<0||dp<pp)){ titolo=t.slice(0,dp).trim(); t=t.slice(dp+1).trim(); } // "Besciamella: bevanda di soia" = componente "Besciamella"
    if(f!==fPrec||titolo){ g++; fPrec=f; } // un gruppo nuovo a ogni frase e a ogni titolo (anche dopo una virgola: "…, ripieno: miglio")
    const nome=t.replace(/\s*[\(\[].*$/,'').replace(/\s*\d+([.,]\d+)?\s*%/g,'').replace(/\s+/g,' ').trim();
    if(nome&&nome.length>1&&!/^(puo|può) contenere|^tracce|^ingrediente surgelato|^prodotto/i.test(nome)) out.push({testo:t,nome,titolo,frase:g}); });
  return out;
}
// parole che trasformano l'ingrediente: se ce l'ha uno solo dei due nomi, non sono la stessa cosa
const ETI_TRASF=/^(malt|acet|sciropp|succ|oli|confit|bevand|brod|estratt|gocc|marmellat|compost|fiocc|soffiat|secch|disidratat|essiccat|affumicat|fermentat|concentrat|granulat|crem|pann|burr|panko)$/;
let ETI_USO=null; // quante ricette usano ogni ingrediente: a parità di somiglianza vince il più usato
function etiAbbinaVoce(v,soloRic){
  const W=etiForma(v.nome); if(!W.length) return null; const Ws=new Set(W);
  if(!ETI_USO){ ETI_USO=new Map(); ricette().forEach(r=>r.righe.forEach(x=>{ const k=x.ing||x.ric; if(k) ETI_USO.set(k,(ETI_USO.get(k)||0)+1); })); }
  let best=null, bs=0, bu=-1;
  const prova=(nome,ris,id)=>{ const M=etiForma(String(nome).replace(/\s*\([^)]*\)/g,'')); if(!M.length) return; const com=M.filter(w=>Ws.has(w)).length; let s=com/Math.max(W.length,M.length);
    if(com!==M.length||com!==W.length){ if(M.some(w=>!Ws.has(w)&&ETI_TRASF.test(w))||W.some(w=>!M.includes(w)&&ETI_TRASF.test(w))) return; } // "orzo" ≠ "malto di orzo", "aceto di mele" ≠ "mele"
    if(com===M.length&&com===W.length) s=1; else if(com===M.length&&M.length>=2) s=Math.max(s,.8); else if(com===M.length) s=Math.max(s,.7); else if(com===W.length&&W.length>=2) s=Math.max(s,.75); else if(com===W.length) s=Math.max(s,.7); // "cipolla" → "Cipolla rossa/bianca"
    const u=ETI_USO.get(id)||0; if(s>bs+.001||Math.abs(s-bs)<=.001&&u>bu){ bs=s; best=ris; bu=u; } };
  if(soloRic!==true) ings().forEach(i=>{ prova(i.nome,{ing:i},i.id); if(/\(/.test(i.nome)) prova(i.nome.replace(/[()\/]/g,' '),{ing:i},i.id); if(i.nomeEtichetta) prova(i.nomeEtichetta,{ing:i},i.id); });
  // una ricetta base come riga solo se il nome corrisponde bene (o se è il titolo di un gruppo, es. "Besciamella: …")
  const bs0=bs, best0=best, bu0=bu; ricette().forEach(r=>prova(r.nome.replace(/\s*\([^)]*\)/g,''),{ric:r},r.id));
  if(best&&best.ric&&bs<.8&&!soloRic){ bs=bs0; best=best0; bu=bu0; }
  return bs>=.7?best:null;
}
// titolo di un gruppo ("Frolla: …") → solo una ricetta BASE (categoria "Basi…" o già usata come base altrove), mai un piatto
const ETI_GENERICI=/^(ripien|impast|crem|bas|sals|condiment|copertur|guarnizion|farci|farcitur|topping|glass|fond|sugh|composta|gel|cop)$/; // titoli troppo generici: solo nome identico
function etiBaseTitolo(titolo){
  const W=etiForma(titolo); if(!W.length) return null; const Ws=new Set(W); let best=null, bs=0;
  ricette().filter(r=>/bas/i.test(r.categoria||'')||usedAsBase(r.id).length).forEach(r=>{ const M=etiForma(r.nome.replace(/\s*\([^)]*\)/g,'')); if(!M.length) return;
    const com=M.filter(w=>Ws.has(w)).length; const s=com===M.length&&com===W.length?1:(com===W.length||com===M.length)&&!(W.length===1&&ETI_GENERICI.test(W[0]))?.7:0; if(s>bs){ bs=s; best={ric:r}; } });
  return bs>=.7?best:null;
}
function etiRigheDaTesto(txt){
  ETI_USO=null; const visti=new Set(), righe=[], basiFrasi=new Map();
  const add=(a,nome)=>{ const k=a?(a.ing?'i'+a.ing.id:'r'+a.ric.id):'t'+norm(nome); if(visti.has(k)) return; visti.add(k);
    righe.push(a&&a.ing?{ing:a.ing.id,ric:null,nome:a.ing.nome,dose:null,doseTesto:'',flag:''}:a&&a.ric?{ing:null,ric:a.ric.id,nome:a.ric.nome,dose:null,doseTesto:'',flag:''}:{ing:null,ric:null,nome:nome.charAt(0).toUpperCase()+nome.slice(1),dose:null,doseTesto:'',flag:''}); };
  etiVoci(txt).forEach(v=>{
    // "Besciamella: …" o "Pasta (semola…)": se c'è una ricetta base con quel nome si usa la base, e i suoi ingredienti non si ripetono
    if(v.titolo){ if(!basiFrasi.has(v.frase)){ const b=etiBaseTitolo(v.titolo); basiFrasi.set(v.frase,b); if(b) add(b); } }
    if(basiFrasi.get(v.frase)) return;
    add(etiAbbinaVoce(v),v.nome); });
  return righe;
}
