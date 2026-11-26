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
    else if(res.nomi.length) toast((res.prova?'PROVA, non salvato. Avrei aggiornato le etichette: ':'Etichette aggiornate: ')+res.nomi.join(', '),6000);
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

