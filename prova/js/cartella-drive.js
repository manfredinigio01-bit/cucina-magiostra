'use strict';
/* ===================== CARTELLA DRIVE: Excel + backup automatici ===================== */
let DIR=null, dirState='none', fileT=null, lastFiles=null, filesErr='';
const XLS_NAME='Cucina La Magiostra - ricettario e food cost.xlsx';
const BAK_NAME='Cucina La Magiostra - backup dati.json';
async function dirInit(){ if(PROVA||!('showDirectoryPicker' in window)) { dirState='nosupport'; return; } try{ DIR=await kvGet('dir'); }catch(e){ DIR=null; } await dirCheck(); }
async function dirCheck(){ if(!DIR){ dirState='none'; return; } try{ const p=await DIR.queryPermission({mode:'readwrite'}); dirState=p==='granted'?'ok':'ask'; }catch(e){ dirState='ask'; } }
function dirBox(){
  if(dirState==='nosupport') return `<p class="small">${PROVA?'Versione di PROVA: niente file nella cartella Drive.':'Questo browser non può scrivere nelle cartelle (serve Chrome o Edge su Mac/Windows).'} Puoi sempre scaricare i file:</p><div class="row"><button class="b" data-act="scaricaxls">Scarica Excel</button><button class="b" data-act="scaricajson">Scarica backup dati</button></div>`;
  return `<p class="small">Collega la cartella di Google Drive sul computer (es. <i>Il mio Drive › La Magiostra › Cucina</i>). A ogni modifica l'app scrive lì, entro un minuto:</p>
   <ul class="small"><li><b>${esc(XLS_NAME)}</b>: il ricettario con le formule, come il tuo v10</li><li><b>${esc(BAK_NAME)}</b>: copia completa dei dati</li><li>cartella <b>Backup Cucina</b>: una copia al giorno</li></ul>
   ${dirState==='ok'?`<div class="good small">Collegata: <b>${esc(DIR.name)}</b>${lastFiles?' · file aggiornati alle '+lastFiles.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):''}</div>`:dirState==='ask'?`<div class="warn small">Cartella <b>${esc(DIR.name)}</b>: Chrome chiede di nuovo il permesso.</div>`:''}
   ${filesErr?`<div class="err small">${esc(filesErr)}</div>`:''}
   <div class="row">${dirState==='ask'?'<button class="b p" data-act="dirperm">Consenti di nuovo</button>':''}<button class="b ${dirState==='none'?'p':''}" data-act="dirpick">${DIR?'Cambia cartella':'Collega cartella'}</button>${dirState==='ok'?'<button class="b" data-act="scrivifile">Aggiorna file adesso</button>':''}<button class="b" data-act="scaricaxls">Scarica Excel</button><button class="b" data-act="scaricajson">Scarica backup</button></div>
   <p class="small mut">Consiglio: installa l'app (icona "Installa" nella barra di Chrome) e alla richiesta scegli "Consenti a ogni visita": così Chrome non richiede il permesso ogni volta.</p>`;
}
async function dirPick(){ try{ const h=await showDirectoryPicker({id:'cucina',mode:'readwrite'}); DIR=h; await kvSet('dir',h); await dirCheck(); await writeFiles(); render(); }catch(e){ if(e.name!=='AbortError') alert('Cartella non collegata: '+e.message); } }
async function dirPerm(){ try{ const p=await DIR.requestPermission({mode:'readwrite'}); dirState=p==='granted'?'ok':'ask'; if(dirState==='ok') await writeFiles(); render(); }catch(e){} }
function scheduleFiles(){ if(dirState!=='ok') return; clearTimeout(fileT); fileT=setTimeout(writeFiles,45000); }
async function writeTo(dir,name,data){ const fh=await dir.getFileHandle(name,{create:true}); const w=await fh.createWritable(); await w.write(data); await w.close(); }
async function writeFiles(){
  if(PROVA||dirState!=='ok'||!S) return;
  try{
    const json=JSON.stringify(S,null,1);
    await writeTo(DIR,BAK_NAME,new Blob([json],{type:'application/json'}));
    const bd=await DIR.getDirectoryHandle('Backup Cucina',{create:true});
    await writeTo(bd,'cucina-'+new Date().toISOString().slice(0,10)+'.json',new Blob([json],{type:'application/json'}));
    const buf=await buildXlsx();
    await writeTo(DIR,XLS_NAME,new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
    lastFiles=new Date(); filesErr='';
  }catch(e){
    filesErr=e.name==='NoModificationAllowedError'||/lock/i.test(e.message)?'Il file Excel è aperto in Excel: chiudilo e premi "Aggiorna file adesso".':'Non riesco a scrivere nella cartella: '+e.message;
    if(e.name==='NotAllowedError') dirState='ask';
  }
  if(TAB==='impostazioni'&&!EDIT) render();
}
function download(name,blob){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },2000); }

