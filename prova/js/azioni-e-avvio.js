'use strict';
/* ===================== AZIONI ===================== */
function scrollEdit(){ const e=document.querySelector('[data-e=nome]'); if(e){ e.scrollIntoView({behavior:'smooth',block:'center'}); e.focus({preventScroll:true}); } }
function newRecipe(){ return {id:uid('r-'),nome:'',foglio:'',categoria:'',unita:'',allergeni:'',note:'',righe:[{ing:null,ric:null,nome:'',dose:null,doseTesto:'',flag:''}],procedimento:'',vendita:'kg',lotto:1,tProd:null,tCott:null,perdita:null,ricarico:null,confezione:null,packaging:'',pezziPack:null,prezzoBanco:null,unitaBanco:'',etichetta:'',inProdotti:true,updatedAt:0,deleted:false,_new:true}; }
function readEdit(){
  const r=EDIT; if(!r) return;
  document.querySelectorAll('[data-e]').forEach(e=>r[e.dataset.e]=e.value);
  document.querySelectorAll('[data-n]').forEach(e=>r[e.dataset.n]=num(e.value));
  document.querySelectorAll('[data-p]').forEach(e=>{ const v=num(e.value); r[e.dataset.p]=v==null?null:v/100; });
  document.querySelectorAll('[data-row]').forEach(e=>{ const x=r.righe[+e.dataset.row]; if(!x) return; if(e.dataset.f==='nome'){ let v=e.value.trim(); x.ric=null; x.ing=null; if(v.startsWith(BASE)){ const bn=v.slice(BASE.length).trim().toLowerCase(); const br=ricette().find(q=>q.nome.toLowerCase()===bn&&q.id!==r.id); if(br){ x.ric=br.id; v=br.nome; } } if(!x.ric){ const i=INAME.get(v.toLowerCase()); x.ing=i?i.id:null; } x.nome=v; } else { const v=num(e.value); x.dose=v; x.doseTesto=v==null?e.value.trim():''; } });
}
function saveRecipe(){
  readEdit(); const r=EDIT; r.nome=r.nome.trim(); if(!r.nome) return alert('Scrivi il nome della ricetta.');
  if(ricette().some(x=>x.id!==r.id&&x.nome.toLowerCase()===r.nome.toLowerCase())) return alert('Esiste già una ricetta con questo nome.');
  const miss=r.righe.filter(x=>x.nome&&!x.ing&&!x.ric).map(x=>x.nome);
  if(miss.length&&!confirm('Questi ingredienti non sono nell\'elenco e non avranno un costo:\n'+miss.join(', ')+'\n\nSalvo lo stesso?')) return;
  r.righe=r.righe.filter(x=>x.nome||x.dose!=null);
  const isNew=r._new; delete r._new; touch(r);
  if(isNew) S.ricette.push(r); else { const k=S.ricette.findIndex(x=>x.id===r.id); S.ricette[k]=r; }
  EDIT=null; SEL=r.id; commit(); render(); toast('Ricetta salvata');
}
async function pwDialog(){
  dialog('Cambia password',`<label class="f">Password attuale<input class="i" type="password" id="pwo" autocomplete="current-password"></label><label class="f">Nuova password (almeno 10 caratteri)<input class="i" type="password" id="pwn1" autocomplete="new-password"></label><label class="f">Ripeti la nuova<input class="i" type="password" id="pwn2" autocomplete="new-password"></label><div id="pwmsg"></div>`,[['Annulla','dlgclose'],['Cambia','pwsave','p']]);
}
async function pwSave(){
  const m=t=>$('#pwmsg').innerHTML=`<div class="err small">${esc(t)}</div>`;
  const v=await kvGet('vault'); try{ await unseal(await deriveKey($('#pwo').value,unb64(v.salt),v.iter),v.box); }catch(e){ return m('Password attuale sbagliata.'); }
  const p1=$('#pwn1').value; if(p1.length<10) return m('Almeno 10 caratteri.'); if(p1!==$('#pwn2').value) return m('Le due password non coincidono.');
  const salt=crypto.getRandomValues(new Uint8Array(16)); KEY=await deriveKey(p1,salt,PBKDF2_ITER);
  await kvSet('vault',{v:1,salt:b64(salt),iter:PBKDF2_ITER,box:await seal(KEY,CFG)}); await saveLocal(); closeDlg();
  alert('Password cambiata su questo computer. Sugli altri computer va cambiata anche lì (ognuno ha la sua copia cifrata).');
}

document.addEventListener('click',async e=>{
  const t=e.target.closest('[data-tab],[data-act],[data-ric],[data-ing],[data-filt],[data-go]'); if(!t) return;
  if(t.dataset.tab){ TAB=t.dataset.tab; Q=''; EDIT=null; render.newTab=true; render(); scrollTo(0,0); return; }
  if(t.dataset.go!==undefined){ const [tab,f]=t.dataset.go.split(':'); TAB=tab; Q=''; FILT[tab==='ricette'?'ric':'ing']=f||''; render.newTab=true; render(); scrollTo(0,0); return; }
  if(t.dataset.filt!==undefined){ const [k,...v]=t.dataset.filt.split(':'); FILT[k]=v.join(':'); render(); return; }
  if(t.dataset.ric&&!t.dataset.act){ if(EDIT&&!confirm('Esci dalla modifica senza salvare?')) return; EDIT=null; TAB='ricette'; SEL=t.dataset.ric; MOLT={d:null,kg:null,tp:null,tc:null}; render(); if(innerWidth<860) document.querySelector('.split>div:last-child')?.scrollIntoView({behavior:'smooth'}); return; }
  if(t.dataset.ing&&!t.dataset.act){ ingDialog(t.dataset.ing); return; }
  const [a,arg]=(t.dataset.act||'').split(/:(.*)/);
  switch(a){
    case 'setup': return doSetup();
    case 'unlock': return doUnlock();
    case 'reset': e.preventDefault(); return doReset();
    case 'blocca': return lockNow();
    case 'cambiapw': return pwDialog();
    case 'pwsave': return pwSave();
    case 'aggiorna': if('serviceWorker' in navigator){ const rg=await navigator.serviceWorker.getRegistration(); if(rg) await rg.update(); } location.reload(); return;
    case 'dlgclose': return closeDlg();
    case 'nuovaric': EDIT=newRecipe(); SEL=EDIT.id; TAB='ricette'; render(); return scrollEdit();
    case 'modric': EDIT=JSON.parse(JSON.stringify(getR(SEL))); return render();
    case 'annullaric': EDIT=null; if(!getR(SEL)) SEL=null; return render();
    case 'salvaric': return saveRecipe();
    case 'addriga': readEdit(); EDIT.righe.push({ing:null,ric:null,nome:'',dose:null,doseTesto:'',flag:''}); render(); { const ins=document.querySelectorAll('[data-f="nome"]'); ins[ins.length-1]?.focus(); } return;
    case 'delriga': readEdit(); EDIT.righe.splice(+arg,1); return render();
    case 'duplica': { const r=JSON.parse(JSON.stringify(getR(SEL))); r.id=uid('r-'); r.nome=r.nome+' (copia)'; r.foglio=''; r.etichetta=''; r._new=true; EDIT=r; SEL=r.id; render(); return scrollEdit(); }
    case 'eliminaric': { const r=getR(SEL); const ub=usedAsBase(r.id); if(!confirm((ub.length?'Attenzione: è usata come base in '+ub.map(x=>x.nome).join(', ')+' (perderanno questo costo).\n\n':'')+'Eliminare "'+r.nome+'"? Resta nello storico dell\'archivio online.')) return; r.deleted=true; touch(r); SEL=null; commit(); return render(); }
    case 'stampa': return stampa(arg);
    case 'simreset': MOLT={d:null,kg:null,tp:null,tc:null}; return render();
    case 'simsalva': { const r=getR(SEL); const c=calc(r,{dosi:MOLT.d,kgVoluti:MOLT.kg,tProd:MOLT.tp,tCott:MOLT.tc}); if(!confirm(`Salvo come lotto standard ${fmt(c.dosi,3)} dosi con ${fmt(c.tP,0)} minuti di lavoro e ${fmt(c.tC,0)} di cottura?`)) return; r.lotto=+c.dosi.toFixed(3); r.tProd=c.tP; r.tCott=c.tC; touch(r); MOLT={d:null,kg:null,tp:null,tc:null}; commit(); render(); return toast('Lotto standard aggiornato'); }
    case 'nuovoing': return ingDialog(null);
    case 'ingsave': return ingSave(arg||null);
    case 'ingdel': { const i=getI(arg); if(!confirm('Eliminare "'+i.nome+'"?')) return; i.deleted=true; touch(i); closeDlg(); commit(); return render(); }
    case 'salvapar': { const P=S.parametri; document.querySelectorAll('[data-par]').forEach(x=>{ const v=num(x.value); if(v!=null) P[x.dataset.par]=v; }); touch(P); commit(); render(); return toast('Parametri salvati: tutti i food cost sono ricalcolati'); }
    case 'pkadd': S.packaging.push({id:uid('p-'),nome:'Nuovo packaging',fornitore:'',prezzo:null,pezzi:1,updatedAt:now(),deleted:false}); commit(); return render();
    case 'pksave': document.querySelectorAll('[data-pk]').forEach(x=>{ const p=S.packaging.find(p=>p.id===x.dataset.pk); if(!p) return; const f=x.dataset.f; const v=f==='prezzo'||f==='pezzi'?num(x.value):x.value; if(p[f]!==v){ p[f]=v; touch(p); } }); commit(); render(); return toast('Packaging salvato');
    case 'pkdel': { const p=S.packaging.find(p=>p.id===arg); if(S.ricette.some(r=>!r.deleted&&r.packaging===arg)) return alert('Questo packaging è usato da qualche ricetta.'); p.deleted=true; touch(p); commit(); return render(); }
    case 'dirpick': return dirPick();
    case 'dirperm': return dirPerm();
    case 'scrivifile': toast('Scrivo i file…'); await writeFiles(); return toast(filesErr||'File aggiornati nella cartella');
    case 'scaricaxls': toast('Preparo l\'Excel…'); return download(XLS_NAME,new Blob([await buildXlsx()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    case 'scaricajson': return download('cucina-backup-'+new Date().toISOString().slice(0,10)+'.json',new Blob([JSON.stringify(S,null,1)],{type:'application/json'}));
    case 'applicafatt': return applyInvoice();
    case 'dest': { const [k,v]=arg.split(':'); const r=IMP.righe[+k]; r.dest=v; if(v==='cucina'&&r.why.startsWith('ricordato')) r.why=''; return render(); }
    case 'restonegozio': IMP.righe.forEach(r=>{ if(r.dest[0]==='?') r.dest='negozio'; }); return render();
    case 'fsave': { document.querySelectorAll('[data-fo]').forEach(x=>{ const f=S.fornitori.find(f=>f.id===x.dataset.fo); if(!f) return; const k=x.dataset.f; const v=k==='alias'?x.value.split(',').map(t=>t.trim()).filter(Boolean):x.value.trim(); if(JSON.stringify(f[k])!==JSON.stringify(v)){ f[k]=v; touch(f); } }); commit(); render(); return toast('Fornitori salvati'); }
    case 'fadd': S.fornitori.push({id:uid('f-'),nome:'Nuovo fornitore',alias:[],regola:'misto',updatedAt:now(),deleted:false}); commit(); return render();
    case 'fdel': { const f=S.fornitori.find(f=>f.id===arg); if(!confirm('Togliere "'+f.nome+'" dall\'elenco fornitori?')) return; f.deleted=true; touch(f); commit(); return render(); }
    case 'applicaprop': return applyProposte();
    case 'chiudiimp': IMP=null; return render();
    case 'etinuova': return etiWrite(getR(SEL));
    case 'etiord': $('#e_ing').value=etiWrite.txt; return;
    case 'etisave': return etiSave(getR(SEL));
    case 'etiauto': return etiAutoDlg(getR(SEL));
    case 'etiautook': return etiRendiAuto(ETIAUTO_R);
    case 'etiman': return etiRendiManuale(getR(SEL));
    case 'etiautouguali': return etiAutoUguali();
  }
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='fileinp'&&t.files.length) return readFiles([...t.files]);
  if(t.dataset.filtsel){ FILT[t.dataset.filtsel]=t.value; return render(); }
  if(t.id==='etisel'){ const r=getR(SEL); r.etichetta=t.value; touch(r); commit(); return render(); }
  if(t.dataset.imp!==undefined){ const r=IMP.righe[+t.dataset.imp]; const f=t.dataset.f;
    if(f==='ing'){ r.ing=t.value||null; r.sure=true; r.weak=false; r.skip=false; r.why=''; if(r.dest[0]==='?') r.dest='cucina'; } else if(f==='formato'){ r.formato=num(t.value); } else if(f==='nuovo'){ r.nuovo=t.value; return; }
    return render(); }
  if(t.dataset.fregola!==undefined){ const raw=t.dataset.fregola; let f=fornMatch(raw); if(!f){ f={id:uid('f-'),nome:fornNome(raw),alias:[norm(raw).replace(SOC,' ').trim().split(/\s+/).slice(0,2).join(' ')],regola:'misto',updatedAt:0,deleted:false}; S.fornitori.push(f); } f.regola=t.value; touch(f); commit(); prepInvoice(); return render(); }
  if(t.dataset.prop!==undefined){ IMP.proposte[+t.dataset.prop].on=t.checked; return; }
  if(t.dataset.propdate!==undefined){ IMP.proposte[+t.dataset.propdate].data=t.value; return; }
  if(/^sim_/.test(t.id)){ const v=num(t.value);
    if(t.id==='sim_d'){ MOLT.d=v>0?v:null; MOLT.kg=null; } else if(t.id==='sim_kg'){ MOLT.kg=v>0?v:null; MOLT.d=null; } else if(t.id==='sim_tp') MOLT.tp=v!=null&&v>=0?v:null; else MOLT.tc=v!=null&&v>=0?v:null;
    return render(); }
});
document.addEventListener('input',e=>{ if(e.target.id==='q'){ Q=e.target.value; render.focusQ=true; clearTimeout(render.qt); render.qt=setTimeout(render,180); } });
document.addEventListener('keydown',e=>{ if(e.key==='Enter'){ if(e.target.id==='pw') doUnlock(); if(e.target.id==='nome'&&$('#pw1')) doSetup(); } });
document.addEventListener('dragover',e=>{ const d=$('#drop'); if(d){ e.preventDefault(); d.classList.add('on'); } });
document.addEventListener('dragleave',e=>{ const d=$('#drop'); if(d&&e.target===d) d.classList.remove('on'); });
document.addEventListener('drop',e=>{ const d=$('#drop'); if(!d) return; e.preventDefault(); d.classList.remove('on'); if(e.dataTransfer.files.length) readFiles([...e.dataTransfer.files]); });
addEventListener('beforeunload',e=>{ if(EDIT){ e.preventDefault(); e.returnValue=''; } });

/* ===================== AVVIO ===================== */
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
showLock();

