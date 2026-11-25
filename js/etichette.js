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
    out.push(nome+(i&&i.surgelato?'*':'')+(i&&i.composizione?' ('+i.composizione+')':''));
  });
  return {parti:out,warn:[...warn]};
}
function etiTesto(r){ const e=etiRighe(r); let t=e.parti.join(', '); t=t?t.charAt(0).toUpperCase()+t.slice(1)+'.':''; return {txt:t,warn:e.warn,surg:/\*/.test(t)}; }
async function etiWrite(r){
  const E=etiTesto(r), txt=E.txt;
  const ex=r.etichetta?ETI.prodotti.find(p=>p.id===r.etichetta):null;
  if(!ex&&!txt) return alert('Questa ricetta non ha ancora ingredienti: inseriscili prima di creare l\'etichetta.');
  dialog(ex?'Aggiorna etichetta':'Nuova etichetta',`<p class="small">Testo ingredienti in ordine di peso decrescente, preso dalla ricetta. I semilavorati (ricette base) e gli ingredienti composti (quelli con la lista ingredienti, es. margarina) sono già scritti con i loro ingredienti tra parentesi. I surgelati hanno l'asterisco: la nota "*Ingrediente surgelato." la aggiunge l'app etichette. Gli allergeni li evidenzia l'app etichette.</p>
   ${E.warn.length?`<div class="warn small">Forse composti ma senza lista ingredienti: <b>${E.warn.map(esc).join(', ')}</b>. Aggiungila in "Ingredienti e prezzi" (apri l'ingrediente, campo "Ingredienti di questo prodotto"), poi rigenera il testo.</div>`:''}
   <label class="f">Nome in etichetta<input class="i" id="e_nome" value="${esc(ex?ex.nome:r.nome)}"></label>
   <label class="f">Ingredienti<textarea class="i" id="e_ing">${esc(ex?ex.ingredienti:txt)}</textarea></label>
   ${ex?`<p class="small mut">Testo attuale in etichetta: ${esc(ex.ingredienti)}</p><button class="b sm" data-act="etiord">Sostituisci con il testo generato dalla ricetta</button>`:''}
   <p class="small mut">Viene scritto nell'archivio dell'app etichette: tutti i PC lo vedono entro 20 secondi.</p>`,[['Annulla','dlgclose'],[ex?'Salva nell\'etichetta':'Crea etichetta','etisave','p']]);
  etiWrite.txt=txt;
}
async function etiSave(r){
  const nome=$('#e_nome').value.trim(), ing=$('#e_ing').value.trim(); if(!nome||!ing) return alert('Nome e ingredienti servono.');
  const repo=CFG.etiRepo||ETI_REPO;
  for(let k=0;k<4;k++){
    const {data,sha}=await ghReadJSON(repo,'archivio.json'); if(!data) return alert('Archivio etichette vuoto o non raggiungibile.');
    let p=r.etichetta?data.prodotti.find(x=>x.id===r.etichetta):null;
    const t=now();
    if(p){ p.nome=nome; p.ingredienti=ing; p.updatedAt=Math.max(t,(p.updatedAt||0)+1); p.updatedBy='App Cucina'; }
    else { const id='cuc'+t.toString(36); p={id,updatedAt:t,updatedBy:'App Cucina',nome,sottotitolo:'',ingredienti:ing,tracce:[],tracceExtra:'',conservazione:'cs1',diciture:'',tipoData:'scadenza',giorni:4,prezzoKg:'',prezzoPezzo:'',tipoPrezzo:'kg',pezzature:[],mostraPrezzo:false,deleted:false,linea:'standard',categoria:'',fraseFronte:''}; data.prodotti.push(p); r.etichetta=id; touch(r); commit(); }
    const w=await ghWriteJSON(repo,'archivio.json',data,sha,'Etichette: '+nome+' da app Cucina');
    if(w.ok){ ETI=data; closeDlg(); render(); toast('Etichetta salvata: controllala nell\'app etichette (conservazione, giorni, tracce)'); return; }
    if(w.status!==409&&w.status!==422) return alert('Non salvata: '+ghErr(w));
  }
  alert('Non salvata: troppi salvataggi contemporanei, riprova.');
}

