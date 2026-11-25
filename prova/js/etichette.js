'use strict';
/* ===================== ETICHETTE (archivio separato) ===================== */
async function etiWrite(r){
  const c=calc(r);
  const ord=c.righe.filter(z=>z.x.nome).sort((a,b)=>((b.x.dose||0)*((b.i&&b.i.unita==='pz')?(b.i.pesoPezzo||0):1))-((a.x.dose||0)*((a.i&&a.i.unita==='pz')?(a.i.pesoPezzo||0):1))).map(z=>z.x.nome.toLowerCase());
  let txt=ord.join(', '); txt=txt?txt.charAt(0).toUpperCase()+txt.slice(1)+'.':'';
  const ex=r.etichetta?ETI.prodotti.find(p=>p.id===r.etichetta):null;
  if(!ex&&!txt) return alert('Questa ricetta non ha ancora ingredienti: inseriscili prima di creare l\'etichetta.');
  dialog(ex?'Aggiorna etichetta':'Nuova etichetta',`<p class="small">Testo ingredienti in ordine di peso decrescente, preso dalla ricetta. <b>Completalo</b> con i sotto-ingredienti dei prodotti composti (es. "salsa di soia (acqua, soia, sale)"): in etichetta sono obbligatori. Gli allergeni li evidenzia l'app etichette.</p>
   <label class="f">Nome in etichetta<input class="i" id="e_nome" value="${esc(ex?ex.nome:r.nome)}"></label>
   <label class="f">Ingredienti<textarea class="i" id="e_ing">${esc(ex?ex.ingredienti:txt)}</textarea></label>
   ${ex?`<p class="small mut">Testo attuale in etichetta: ${esc(ex.ingredienti)}</p><button class="b sm" data-act="etiord">Sostituisci con l'ordine per peso della ricetta</button>`:''}
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

