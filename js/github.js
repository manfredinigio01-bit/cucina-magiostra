'use strict';
/* ===================== GITHUB ===================== */
async function gh(method,path,body){
  if(PROVA&&method!=='GET'){ toast('Versione di PROVA: niente viene salvato su GitHub'); return new Response(JSON.stringify({content:{sha:'prova'}}),{status:200,headers:{'Content-Type':'application/json'}}); }
  return fetch(GH_API+path,{method,cache:'no-store',headers:{Authorization:'Bearer '+CFG.token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
}
const ghErr=r=>r.status===401?'chiave non valida o scaduta':r.status===403?'accesso negato (permessi della chiave)':r.status===404?'archivio non trovato o chiave senza accesso':'errore GitHub '+r.status;
async function ghReadJSON(repo,file){
  const r=await gh('GET',`/repos/${repo}/contents/${file}`);
  if(r.status===404){ const t=await gh('GET',`/repos/${repo}`); if(t.ok) return {data:null,sha:null}; throw new Error(ghErr(t)); }
  if(!r.ok) throw new Error(ghErr(r));
  const j=await r.json(); let txt;
  if(j.content) txt=TD.decode(unb64(j.content.replace(/\s/g,'')));
  else { const bl=await gh('GET',`/repos/${repo}/git/blobs/${j.sha}`); if(!bl.ok) throw new Error(ghErr(bl)); txt=TD.decode(unb64((await bl.json()).content.replace(/\s/g,''))); }
  let data=null; try{ data=txt.trim()?JSON.parse(txt):null; }catch(e){ throw new Error('file online illeggibile'); }
  return {data,sha:j.sha};
}
async function ghWriteJSON(repo,file,obj,sha,msg){
  return gh('PUT',`/repos/${repo}/contents/${file}`,{message:msg,content:b64(TE.encode(JSON.stringify(obj,null,1))),...(sha?{sha}:{})});
}
function setStatus(t,err){ const e=$('#st'); if(!e) return; e.textContent=t; e.classList.toggle('err',!!err); }
async function sync(){
  if(!CFG||!KEY) return; if(syncing){ pending=true; return; } syncing=true;
  try{
    for(let k=0;k<4;k++){
      const {data,sha}=await ghReadJSON(CFG.repo,DATA_FILE);
      const remote=data?sanitize(data):null;
      const before=JSON.stringify(S);
      const merged=remote?merge(S,remote):S;
      if(JSON.stringify(merged)!==before){ S=merged; reindex(); await saveLocal(); if(!EDIT) render(); }
      if(remote&&canon(merged)===canon(remote)) break;
      const w=await ghWriteJSON(CFG.repo,DATA_FILE,merged,sha,`Cucina: salvataggio da ${CFG.nome||'postazione'}`);
      if(w.ok) break;
      if(w.status===409||w.status===422) continue;
      throw new Error(ghErr(w));
    }
    lastSync=new Date(); dirty=false;
    setStatus('Archivio ✓ '+lastSync.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}));
    scheduleFiles();
  }catch(e){
    const off=!navigator.onLine||e instanceof TypeError;
    setStatus(off?'Senza rete: le modifiche partono appena torna la connessione':'Archivio: '+e.message,true);
  }finally{ syncing=false; if(pending){ pending=false; setTimeout(sync,400); } }
}
async function loadEti(){
  if(!CFG) return;
  try{ const {data}=await ghReadJSON(CFG.etiRepo||ETI_REPO,'archivio.json'); ETI=data&&Array.isArray(data.prodotti)?data:null; }catch(e){ ETI=null; }
}
async function saveLocal(){ if(KEY&&S) await kvSet('cache',await seal(KEY,S)); }
let saveT=null;
function commit(){ S.updatedAt=now(); reindex(); dirty=true; clearTimeout(saveT); saveT=setTimeout(async()=>{ await saveLocal(); sync(); },500); }

