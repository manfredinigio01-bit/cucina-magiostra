'use strict';
/* ===================== INGREDIENTI ===================== */
function vIngredienti(){
  const f=FILT.ing||'';
  let I=ings();
  if(Q) I=I.filter(i=>norm(i.nome+' '+i.fornitore).includes(norm(Q)));
  if(f==='vecchi') I=I.filter(i=>{ const m=monthsSince(lastPriceDate(i)); return unitCost(i)==null||m==null||m>=6; });
  else if(f==='senza') I=I.filter(i=>unitCost(i)==null);
  else if(f==='surg') I=I.filter(i=>i.surgelato);
  else if(f==='comp') I=I.filter(i=>i.composizione);
  else if(f.startsWith('forn:')) I=I.filter(i=>i.fornitore===f.slice(5));
  const forn=[...new Set(ings().map(i=>i.fornitore).filter(Boolean))].sort();
  const use=new Map(); ricette().forEach(r=>r.righe.forEach(x=>{ if(x.ing) use.set(x.ing,(use.get(x.ing)||0)+1); }));
  return `<div class="card">
   <div class="row" style="margin-bottom:8px"><input class="i flex1" id="q" placeholder="Cerca ingrediente o fornitore" value="${esc(Q)}"><button class="b p" data-act="nuovoing">+ Ingrediente</button><button class="b" data-act="stampa:listino">Stampa elenco prezzi</button></div>
   <div class="tabs2"><button class="${!f?'on':''}" data-filt="ing:">Tutti (${ings().length})</button><button class="${f==='vecchi'?'on':''}" data-filt="ing:vecchi">Da aggiornare</button><button class="${f==='senza'?'on':''}" data-filt="ing:senza">Senza prezzo</button><button class="${f==='surg'?'on':''}" data-filt="ing:surg">Surgelati</button><button class="${f==='comp'?'on':''}" data-filt="ing:comp">Composti</button>
   <select class="i" style="width:auto" data-filtsel="ing"><option value="">Fornitore…</option>${forn.map(x=>`<option value="forn:${esc(x)}" ${f==='forn:'+x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
   <div class="scroll"><table class="t"><tr><th>Ingrediente</th><th>Fornitore</th><th class="n">Prezzo</th><th class="n">Formato</th><th class="n">Costo unitario</th><th>Ultimo prezzo</th><th class="n">Ricette</th></tr>
   ${I.map(i=>{ const u=unitCost(i), d=lastPriceDate(i), m=monthsSince(d); return `<tr data-ing="${i.id}" style="cursor:pointer"><td>${esc(i.nome)}${i.surgelato?' <span class="chip g">surgelato</span>':''}${i.composizione?' <span class="chip g" title="'+esc(i.composizione)+'">composto</span>':''}</td><td class="small">${esc(i.fornitore)}</td><td class="n">${eur(i.prezzo)}</td><td class="n">${fmt(i.formato)} ${esc(i.unita)}</td><td class="n"><b>${u!=null?eur3(u)+'/'+esc(i.unita):'<span class="chip r">manca</span>'}</b></td><td class="small">${d?esc(dIT(d)):'<span class="mut">?</span>'} ${m!=null&&m>=6?'<span class="chip w">vecchio</span>':''}</td><td class="n">${use.get(i.id)||''}</td></tr>`}).join('')}
   </table></div><p class="small mut">${I.length} ingredienti · prezzi IVA esclusa · clic su una riga per modificarla e vedere lo storico</p></div>`;
}
function ingDialog(id){
  const i=id?getI(id):{id:'',nome:'',fornitore:'',prezzo:null,formato:null,unita:'kg',pesoPezzo:null,note:'',storico:[]};
  const used=id?usedIn(id):[];
  dialog(id?i.nome:'Nuovo ingrediente',`
   <div class="row"><label class="f">Nome<input class="i" id="d_nome" value="${esc(i.nome)}"></label><label class="f">Fornitore<input class="i" id="d_forn" value="${esc(i.fornitore)}"></label></div>
   <div class="row"><label class="f s">Prezzo confezione € (IVA escl.)<input class="i" id="d_prezzo" inputmode="decimal" value="${fmt(i.prezzo,4)}"></label><label class="f s">Formato (quantità nella confezione)<input class="i" id="d_formato" inputmode="decimal" value="${fmt(i.formato,4)}"></label>
   <label class="f s">Unità<select class="i" id="d_unita">${['kg','l','pz'].map(u=>`<option ${u===i.unita?'selected':''}>${u}</option>`).join('')}</select></label><label class="f s">Peso per pezzo (kg, solo pz)<input class="i" id="d_pp" inputmode="decimal" value="${fmt(i.pesoPezzo,4)}"></label></div>
   <label class="row small" style="margin:4px 0 8px"><input type="checkbox" id="d_fisso" ${i.fornitoreFisso?'checked':''}> Fornitore fisso: le fatture di altri fornitori non cambiano il prezzo (puoi sempre scegliere a mano)</label>
   <h3>Per l'etichetta</h3>
   <label class="row small" style="margin:0 0 6px"><input type="checkbox" id="d_surg" ${i.surgelato?'checked':''}> <b>Surgelato</b>: in etichetta avrà l'asterisco (*) e la nota "*Ingrediente surgelato."</label>
   <div class="row"><label class="f">Nome in etichetta (solo se diverso, es. "margarina vegetale")<input class="i" id="d_neti" value="${esc(i.nomeEtichetta||'')}" placeholder="${esc((i.nome||'').toLowerCase())}"></label></div>
   <label class="f">Ingredienti di questo prodotto (se è composto: margarina, maionese, pasta sfoglia, bevanda di soia…)<textarea class="i" id="d_comp" style="min-height:60px" placeholder="es. oli e grassi vegetali (palma, girasole), acqua, emulsionante: lecitina di girasole, sale, correttore di acidità: acido citrico, aromi naturali">${esc(i.composizione||'')}</textarea><span class="small mut">Copiali dalla confezione. Non compaiono nel ricettario: servono solo all'etichetta, dove vanno tra parentesi dopo il nome. Allergeni compresi.</span></label><label class="f">Note<textarea class="i" id="d_note" style="min-height:70px">${esc(i.note)}</textarea></label>
   ${used.length?`<p class="small"><b>Usato in:</b> ${used.map(r=>esc(r.nome)).join(', ')}</p>`:''}
   ${(i.storico||[]).length?`<h3>Storico prezzi da fattura</h3><table class="t small"><tr><th>Data</th><th>Fornitore</th><th>Fattura</th><th>Voce</th><th class="n">€/unità</th></tr>${i.storico.slice().reverse().map(s=>`<tr><td>${esc(dIT(s.data))}</td><td>${esc(s.fornitore)}</td><td>${esc(s.fattura)}</td><td>${esc(s.voce)}</td><td class="n">${eur3(s.prezzoUnit)}</td></tr>`).join('')}</table>`:''}
  `,[...(id&&!used.length?[['Elimina','ingdel:'+id,'d']]:[]),['Annulla','dlgclose'],['Salva','ingsave:'+(id||''),'p']]);
}
function ingSave(id){
  const nome=$('#d_nome').value.trim(); if(!nome) return alert('Scrivi il nome.');
  const other=INAME.get(nome.toLowerCase()); if(other&&other.id!==id) return alert('Esiste già un ingrediente con questo nome.');
  let i=id?getI(id):null;
  if(!i){ i={id:uid('i-'),storico:[],updatedAt:0,deleted:false}; S.ingredienti.push(i); }
  const oldName=i.nome;
  Object.assign(i,{nome,fornitore:$('#d_forn').value.trim(),prezzo:num($('#d_prezzo').value),formato:num($('#d_formato').value),unita:$('#d_unita').value,pesoPezzo:num($('#d_pp').value),note:$('#d_note').value,fornitoreFisso:$('#d_fisso').checked,surgelato:$('#d_surg').checked,nomeEtichetta:$('#d_neti').value.trim(),composizione:$('#d_comp').value.trim().replace(/\s*\.\s*$/,'')});
  touch(i);
  if(oldName&&oldName!==nome) S.ricette.forEach(r=>{ let ch=false; r.righe.forEach(x=>{ if(x.ing===i.id){ x.nome=nome; ch=true; } }); if(ch) touch(r); });
  closeDlg(); commit(); render(); toast('Ingrediente salvato');
}

/* ===================== ARCHIVIO PIATTI ===================== */
function vArchivio(){
  const f=FILT.arc||'';
  let A=S.archivio.filter(a=>!a.deleted);
  if(Q) A=A.filter(a=>norm(a.nome+' '+a.materiaPrima+' '+a.categoria).includes(norm(Q)));
  if(['primavera','estate','autunno','inverno'].includes(f)) A=A.filter(a=>a.stagioni.includes(f));
  if(f==='salato'||f==='dolce') A=A.filter(a=>a.tipo===f);
  if(f==='ripro') A=A.filter(a=>(monthsSince(a.ultima)??99)>=12);
  const so=FILT.arcsort||'nome';
  A.sort(so==='volte'?(a,b)=>(b.volte||0)-(a.volte||0):so==='ultima'?(a,b)=>String(b.ultima).localeCompare(String(a.ultima)):(a,b)=>a.nome.localeCompare(b.nome,'it'));
  const mese=new Date().getMonth();
  const stagM=S.stagionalita.filter(s=>s.mesi.includes(mese)).map(s=>s.nome);
  return `<div class="card">
   <div class="row" style="margin-bottom:8px"><input class="i flex1" id="q" placeholder="Cerca piatto o materia prima" value="${esc(Q)}"><button class="b" data-act="stampa:archivio">Stampa elenco</button></div>
   <div class="tabs2">${[['','Tutti'],['salato','Salato'],['dolce','Dolci'],['primavera','Primavera'],['estate','Estate'],['autunno','Autunno'],['inverno','Inverno'],['ripro','Non proposti da 12 mesi']].map(([k,t])=>`<button class="${k===f?'on':''}" data-filt="arc:${k}">${t}</button>`).join('')}
   <select class="i" style="width:auto" data-filtsel="arcsort"><option value="nome" ${so==='nome'?'selected':''}>Ordina per nome</option><option value="volte" ${so==='volte'?'selected':''}>Più proposti</option><option value="ultima" ${so==='ultima'?'selected':''}>Ultima volta</option></select></div>
   ${stagM.length?`<p class="small"><b>Di stagione questo mese:</b> ${stagM.map(esc).join(', ')}</p>`:''}
   <div class="scroll"><table class="t"><tr><th>Piatto</th><th>Tipo</th><th>Stagioni</th><th class="n">Ultimo prezzo</th><th class="n">Volte</th><th>Ultima volta</th><th>Materia prima</th></tr>
   ${A.map(a=>{ const m=monthsSince(a.ultima); return `<tr><td>${esc(a.nome)}</td><td class="small">${a.tipo}${a.categoria?' · '+esc(a.categoria):''}</td><td class="small">${a.stagioni.map(s=>s.slice(0,3)).join(' ')}</td><td class="n">${a.ultimoPrezzo!=null?eur(a.ultimoPrezzo)+' '+esc(a.unita):''}</td><td class="n">${a.volte||''}</td><td class="small">${esc(dIT(a.ultima))} ${m!=null&&m>=12?'<span class="chip w">'+m+' mesi</span>':''}</td><td class="small">${esc(a.materiaPrima)}</td></tr>`}).join('')}
   </table></div><p class="small mut">${A.length} piatti. L'archivio si aggiorna caricando i file "PROPOSTE della GASTRONOMIA" in "Fatture e file".</p></div>`;
}

/* ===================== IMPOSTAZIONI ===================== */
function vImpostazioni(){
  const P=S.parametri; const fields=[['costoOrario','Costo orario personale (€/h)'],['energiaOra','Costo energia in cottura (€/h)'],['affittoMese','Affitto cucina (€/mese)'],['altriFissiMese','Altri costi fissi cucina (€/mese)'],['settimaneMese','Settimane al mese'],['giorniSettimana','Giorni a settimana'],['oreGiorno','Ore al giorno'],['quotaAffitto','Quota affitto sul tempo di produzione (0-1)'],['iva','IVA gastronomia (0,10 = 10%)'],['ricaricoDef','Ricarico predefinito (0,70 = 70%)'],['packagingDef','Packaging predefinito (€/confezione)']];
  return `<div class="grid2"><div class="card"><h2>Parametri di costo</h2>
   ${fields.map(([k,t])=>`<label class="f" style="margin-bottom:6px">${t}<input class="i" inputmode="decimal" data-par="${k}" value="${fmt(P[k],4)}">${P.note&&P.note[k]?`<span class="small mut">${esc(P.note[k])}</span>`:''}</label>`).join('')}
   <p class="small">Costo orario affitto + costi fissi calcolato: <b>${eur(orarioFissi(P))}/h</b></p>
   <button class="b p" data-act="salvapar">Salva parametri</button></div>
   <div>
   <div class="card"><h2>Packaging</h2><table class="t"><tr><th>Packaging</th><th>Fornitore</th><th class="n">Prezzo</th><th class="n">Pezzi</th><th class="n">€/pz</th><th></th></tr>
   ${packs().map(p=>`<tr><td><input class="i" data-pk="${p.id}" data-f="nome" value="${esc(p.nome)}"></td><td><input class="i" data-pk="${p.id}" data-f="fornitore" value="${esc(p.fornitore)}"></td><td class="n"><input class="i n" data-pk="${p.id}" data-f="prezzo" value="${fmt(p.prezzo,4)}"></td><td class="n"><input class="i n" data-pk="${p.id}" data-f="pezzi" value="${fmt(p.pezzi)}"></td><td class="n">${eur3((p.prezzo||0)/(p.pezzi||1))}</td><td><button class="b sm d" data-act="pkdel:${p.id}">✕</button></td></tr>`).join('')}</table>
   <div class="row" style="margin-top:8px"><button class="b sm" data-act="pkadd">+ Packaging</button><button class="b sm p" data-act="pksave">Salva packaging</button></div></div>
   <div class="card"><h2>Fornitori</h2><p class="small mut">Il nome unico e i modi in cui compare nelle fatture (separati da virgola). La regola decide dove vanno le righe delle fatture: <b>tutto alla cucina</b> (es. Granchef), <b>tutto al negozio</b>, oppure <b>misto</b>: l'app propone e decidi tu riga per riga, poi si ricorda la scelta.</p>
   <div class="scroll"><table class="t small"><tr><th>Fornitore</th><th>Come compare in fattura</th><th>Regola</th><th></th></tr>${S.fornitori.filter(f=>!f.deleted).sort((a,b)=>a.nome.localeCompare(b.nome,'it')).map(f=>`<tr><td><input class="i" data-fo="${f.id}" data-f="nome" value="${esc(f.nome)}"></td><td><input class="i" data-fo="${f.id}" data-f="alias" value="${esc(f.alias.join(', '))}"></td><td><select class="i" data-fo="${f.id}" data-f="regola">${[['misto','misto: chiedi'],['cucina','tutto alla cucina'],['negozio','tutto al negozio']].map(([v,t])=>`<option value="${v}" ${f.regola===v?'selected':''}>${t}</option>`).join('')}</select></td><td><button class="b sm d" data-act="fdel:${f.id}">✕</button></td></tr>`).join('')}</table></div>
   <div class="row" style="margin-top:8px"><button class="b sm" data-act="fadd">+ Fornitore</button><button class="b sm p" data-act="fsave">Salva fornitori</button></div></div>
   <div class="card"><h2>Cartella Drive e file</h2>${dirBox()}</div>
   <div class="card"><h2>Sicurezza</h2>
    <p class="small">Questo computer: <b>${esc(CFG.nome||'senza nome')}</b> · archivio <b>${esc(CFG.repo)}</b>. L'app si blocca dopo ${LOCK_MIN} minuti senza uso. Chiave e copia locale sono cifrate con la tua password.</p>
    <div class="row"><button class="b" data-act="blocca">Blocca adesso</button><button class="b" data-act="cambiapw">Cambia password</button><button class="b d" data-act="reset">Scollega questo computer</button></div>
    <p class="small mut" style="margin-top:10px">App Cucina v${APP_VERSION}${lastSync?' · ultima sincronizzazione '+lastSync.toLocaleTimeString('it-IT'):''}</p></div>
   </div></div>`;
}

