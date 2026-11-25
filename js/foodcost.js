'use strict';
/* ===================== FOOD COST (identico al file Excel v10) ===================== */
function orarioFissi(P){ const h=P.settimaneMese*P.giorniSettimana*P.oreGiorno; return h>0?(P.affittoMese+P.altriFissiMese)/h:0; }
// costo €/kg di una ricetta usata come base dentro un'altra (costo pieno se completo, altrimenti solo ingredienti)
function baseCost(id,stack){
  const b=getR(id); if(!b||b.deleted||stack.has(id)) return {u:null,b};
  const c=calc(b,{stack:new Set([...stack,id])});
  if(c.manc) return {u:null,b}; // base con prezzi mancanti (o ricette che si contengono a vicenda): il costo non è affidabile
  if(c.ckg!=null) return {u:c.ckg,b,full:true};
  const kgFin=c.peso*(1-(b.perdita||0));
  return {u:kgFin>0&&!c.manc?c.costo/kgFin:null,b,full:false};
}
function calc(r,opt={}){
  const P=S.parametri; let peso=0,costo=0,manc=0,righe=[],conDose=0;
  const stack=opt.stack||new Set([r.id]);
  for(const x of r.righe){
    let i=null,u=null,base=null;
    if(x.ric){ const bc=baseCost(x.ric,stack); base=bc; u=bc.u; }
    else { i=x.ing?getI(x.ing):null; u=unitCost(i); }
    const has=!!x.nome&&x.dose!=null;
    if(has){ conDose++; peso+=x.dose*(i&&i.unita==='pz'?(i.pesoPezzo||0):1); if(u==null) manc++; else costo+=x.dose*u; }
    righe.push({x,i,u,base,costo:has&&u!=null?x.dose*u:null});
  }
  const per=r.perdita||0;
  // dosi prodotte: lotto standard, oppure quelle scelte nella ricetta (moltiplicatore / kg finali)
  let dosi=r.lotto||0;
  if(opt.dosi>0) dosi=opt.dosi;
  if(opt.kgVoluti>0&&peso>0) dosi=opt.kgVoluti/(peso*(1-per));
  const tP=opt.tProd!=null?opt.tProd:(r.tProd||0), tC=opt.tCott!=null?opt.tCott:(r.tCott||0);
  const molt=opt.dosi>0||opt.kgVoluti>0?dosi:(opt.molt>0?opt.molt:1);
  const crudo=peso*dosi, fin=crudo*(1-per), cIng=costo*dosi;
  const man=tP/60*P.costoOrario, en=tC/60*P.energiaOra;
  const aff=(tP+tC)/60*orarioFissi(P)*P.quotaAffitto;
  const tot=cIng+man+en+aff;
  const ckg=fin>0?tot/fin:null;
  const ric=r.ricarico!=null?r.ricarico:P.ricaricoDef;
  const pkg=ckg!=null?ckg*(1+ric)*(1+P.iva):null;
  const pk=S.packaging.find(p=>p.id===r.packaging&&!p.deleted);
  const pcost=pk?(pk.prezzo||0)/(pk.pezzi||1)*(r.pezziPack||1):P.packagingDef;
  const aPezzo=r.vendita==='pezzo';
  const conf=aPezzo&&ckg!=null&&(r.confezione||0)>0?ckg*r.confezione/1000+pcost:null;
  const pconf=conf!=null?conf*(1+ric)*(1+P.iva):null;
  const marg=pconf!=null?pconf/(1+P.iva)-conf:null;
  let stato;
  if(!r.righe.some(x=>x.nome)) stato='Ricetta da inserire';
  else if(!conDose) stato='Dosi mancanti';
  else if(manc>0) stato='Prezzi mancanti';
  else if(!(r.tProd>0)) stato='Tempi mancanti';
  else if(ckg!=null) stato='OK'; else stato='Lotto mancante';
  // ricarico reale al banco (prezzo €/etto o €/kg, IVA inclusa) sul costo pieno €/kg
  let ricReale=null; const pb=r.prezzoBanco;
  if(pb!=null&&ckg){ const perKg=/etto/i.test(r.unitaBanco)?pb*10:/kg/i.test(r.unitaBanco)?pb:null; if(perKg!=null) ricReale=perKg/(1+P.iva)/ckg-1; }
  // margine reale al banco, sul costo pieno (ingredienti + lavoro + energia + affitto e fissi cucina), IVA esclusa.
  // €/etto o €/kg → al kg (senza packaging); €/pz o €/porzione → a pezzo (pezzatura + packaging).
  let mb=null; const rifRic=P.ricaricoDef;
  if(pb!=null&&ckg!=null){
    const perKg=/etto/i.test(r.unitaBanco)?pb*10:/kg/i.test(r.unitaBanco)?pb:null;
    const perPz=/pz|porz/i.test(r.unitaBanco)?pb:null;
    if(perKg!=null){ const netto=perKg/(1+P.iva), m=netto-ckg; mb={u:'kg',lordo:perKg,netto,costo:ckg,marg:m,margPct:netto>0?m/netto:null,ric:netto/ckg-1,ipo:ckg*(1+rifRic)*(1+P.iva),unita:fin>0?fin:null}; }
    else if(perPz!=null&&(r.confezione||0)>0){ const cp=ckg*r.confezione/1000+pcost, netto=perPz/(1+P.iva), m=netto-cp; mb={u:'pz',lordo:perPz,netto,costo:cp,marg:m,margPct:netto>0?m/netto:null,ric:netto/cp-1,ipo:cp*(1+rifRic)*(1+P.iva),unita:fin>0?fin*1000/r.confezione:null}; }
    if(mb){ mb.diff=mb.lordo-mb.ipo; mb.diffPct=mb.ipo>0?mb.diff/mb.ipo:null; mb.margTot=mb.unita!=null?mb.marg*mb.unita:null; mb.rifRic=rifRic; }
  }
  return {righe,peso,costo,manc,molt,dosi,tP,tC,crudo,fin,cIng,man,en,aff,tot,ckg,ric,pkg,pcost,conf,pconf,marg,stato,ricReale,banco:mb,aPezzo,pesoIng:tot>0?cIng/tot:null,pesoMan:tot>0?man/tot:null};
}
// riquadri del food cost: prezzo ipotetico con il ricarico di riferimento e margine reale al banco
function fcIpotetico(r,c){
  const P=S.parametri, rif=P.ricaricoDef, k=(1+rif)*(1+P.iva);
  const kg=c.ckg!=null?c.ckg*k:null;
  const cp=c.conf!=null?c.conf:(c.banco&&c.banco.u==='pz'?c.banco.costo:null);
  const pz=cp!=null?cp*k:null, g=r.confezione||0;
  const altro=r.ricarico!=null&&Math.abs(r.ricarico-rif)>0.001;
  return `<div><span>Prezzo ipotetico con ricarico ${pct(rif)} (+ IVA)</span><b>${pz!=null?eur(pz)+' al pezzo':eur(kg)+'/kg'}</b><span>${pz!=null?`pezzo da ${fmt(g,0)} g con packaging · ${eur(kg)}/kg · `:''}${eur(perEtto(kg))} all'etto</span>${altro?`<span>col ricarico della ricetta (${pct(r.ricarico)}): ${c.aPezzo&&c.pconf!=null?eur(c.pconf)+' al pezzo':eur(c.pkg)+'/kg'}</span>`:''}</div>`;
}
function fcBanco(r,c){
  const b=c.banco;
  if(r.prezzoBanco==null) return '<div><span>Prezzo al banco</span><b>–</b><span>inseriscilo in Modifica per vedere il margine reale</span></div>';
  if(!b) return `<div><span>Prezzo al banco</span><b>${esc(banco(r))}</b><span>${c.ckg==null?'margine: manca il costo pieno':/pz|porz/i.test(r.unitaBanco)?'margine: manca la pezzatura (g)':'margine: scegli l\'unità (€/etto, €/kg, €/pz)'}</span></div>`;
  const u=b.u==='kg'?'/kg':' al pezzo';
  const cl=b.marg<0?'r':b.ric<b.rifRic-0.05?'w':'ok';
  return `<div><span>Prezzo al banco attuale</span><b>${esc(banco(r))}</b><span>${b.u==='kg'&&/etto/i.test(r.unitaBanco)?'= '+eur(b.lordo)+'/kg · ':''}rispetto all'ipotetico <span class="chip ${b.diff<0?'r':'ok'}">${b.diff>0?'+':''}${eur(b.diff)} (${b.diff>0?'+':''}${pct(b.diffPct)})</span></span></div>
      <div><span>Margine reale al banco (IVA esclusa)</span><b><span class="chip ${cl}">${eur(b.marg)}${u}</span></b><span>${pct(b.margPct)} del prezzo senza IVA · ricarico reale ${pct(b.ric)}</span><span>prezzo senza IVA ${eur(b.netto)} − costo pieno ${eur(b.costo)}</span></div>
      <div><span>Margine su questa produzione</span><b>${eur(b.margTot)}</b><span>${b.u==='kg'?fmt(b.unita,2)+' kg venduti al banco':'circa '+fmt(b.unita,1)+' pezzi da '+fmt(r.confezione,0)+' g'}</span></div>`;
}
const STATO_CL={'OK':'ok','Tempi mancanti':'w','Prezzi mancanti':'w','Dosi mancanti':'w','Lotto mancante':'w','Ricetta da inserire':'r'};

