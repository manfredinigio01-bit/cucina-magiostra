'use strict';
/* ===================== STAMPA ===================== */
function printHTML(html){ $('#print').innerHTML=html; window.print(); }
const pHead=t=>`<div class="head"><b>La Magiostra · Cucina</b><span>${esc(t)} · ${new Date().toLocaleDateString('it-IT')}</span></div>`;
function stampa(tipo){
  if(tipo==='cucina'||tipo==='fc'){
    const r=getR(SEL); if(!r) return; const c=calc(r,{dosi:MOLT.d,kgVoluti:MOLT.kg,tProd:MOLT.tp,tCott:MOLT.tc});
    let h=pHead(tipo==='cucina'?'Scheda di produzione':'Food cost')+`<h1>${esc(r.nome)}</h1><p>${esc(r.categoria)}${r.unita?' · '+esc(r.unita):''}' · <b>'+fmt(c.dosi,2)+' dosi</b>'</p>`;
    h+=`<table><tr><th>Ingrediente</th><th class="n">Quantità</th>${tipo==='fc'?'<th class="n">€/unità</th><th class="n">Costo</th>':''}</tr>${c.righe.filter(z=>z.x.nome).map(({x,i,u,base,costo})=>{ const un=base?'kg':i?i.unita:''; const q=x.dose!=null?x.dose*c.dosi:null; return `<tr><td>${esc(x.nome)}</td><td class="n"><b>${q!=null?qty(q,un):esc(x.doseTesto||'q.b.')}</b></td>${tipo==='fc'?`<td class="n">${u!=null?eur3(u):'manca'}</td><td class="n">${costo!=null?eur(costo*c.dosi):''}</td>`:''}</tr>`}).join('')}
    <tr><td><b>Totale impasto crudo</b></td><td class="n"><b>${qty(c.crudo,'kg')}</b></td>${tipo==='fc'?`<td></td><td class="n"><b>${eur(c.cIng)}</b></td>`:''}</tr></table>`;
    if(r.procedimento) h+=`<h2>Procedimento</h2><div style="white-space:pre-wrap">${esc(r.procedimento)}</div>`;
    if(tipo==='fc') h+=`<h2>Food cost — ${fmt(c.dosi,2)} dosi</h2><table>
      <tr><td>Peso finale del lotto</td><td class="n">${fmt(c.fin)} kg</td></tr><tr><td>Ingredienti</td><td class="n">${eur(c.cIng)}</td></tr><tr><td>Manodopera (${fmt(c.tP,0)} min)</td><td class="n">${eur(c.man)}</td></tr>
      <tr><td>Energia (${fmt(c.tC,0)} min)</td><td class="n">${eur(c.en)}</td></tr><tr><td>Affitto e costi fissi</td><td class="n">${eur(c.aff)}</td></tr><tr><td><b>Costo totale lotto</b></td><td class="n"><b>${eur(c.tot)}</b></td></tr>
      <tr><td><b>Costo di produzione</b></td><td class="n"><b>${eur(c.ckg)}/kg</b></td></tr><tr><td>Prezzo al kg (ricarico ${pct(c.ric)} + IVA)</td><td class="n">${eur(c.pkg)}/kg · ${eur(perEtto(c.pkg))}/etto</td></tr>
      ${c.aPezzo?`<tr><td>Pezzo da ${fmt(r.confezione,0)||'–'} g: prezzo / margine</td><td class="n">${eur(c.pconf)} / ${eur(c.marg)}</td></tr>`:''}<tr><td>Prezzo ipotetico con ricarico ${pct(S.parametri.ricaricoDef)}</td><td class="n">${c.banco?eur(c.banco.ipo)+(c.banco.u==='kg'?'/kg':' al pezzo'):eur(c.ckg!=null?c.ckg*(1+S.parametri.ricaricoDef)*(1+S.parametri.iva):null)+'/kg'}</td></tr><tr><td>Prezzo al banco</td><td class="n">${esc(banco(r))}</td></tr>${c.banco?`<tr><td>Margine reale al banco (senza IVA)</td><td class="n">${eur(c.banco.marg)}${c.banco.u==='kg'?'/kg':' al pezzo'} · ${pct(c.banco.margPct)} del prezzo · ricarico reale ${pct(c.banco.ric)}</td></tr>`:''}</table>`;
    return printHTML(h);
  }
  if(tipo==='listino'){
    const I=ings(); return printHTML(pHead('Ingredienti e prezzi d\'acquisto')+`<h1>Ingredienti e prezzi d'acquisto</h1><table><tr><th>Ingrediente</th><th>Fornitore</th><th class="n">Prezzo</th><th class="n">Formato</th><th class="n">€/unità</th><th>Ultimo prezzo</th></tr>${I.map(i=>`<tr><td>${esc(i.nome)}</td><td>${esc(i.fornitore)}</td><td class="n">${eur(i.prezzo)}</td><td class="n">${fmt(i.formato)} ${esc(i.unita)}</td><td class="n">${unitCost(i)!=null?eur3(unitCost(i)):'–'}</td><td>${esc(dIT(lastPriceDate(i)))}</td></tr>`).join('')}</table>`);
  }
  if(tipo==='archivio'){
    const A=S.archivio.filter(a=>!a.deleted).sort((a,b)=>a.nome.localeCompare(b.nome,'it'));
    return printHTML(pHead('Archivio piatti')+`<h1>Archivio piatti</h1><table><tr><th>Piatto</th><th>Tipo</th><th>Stagioni</th><th class="n">Prezzo</th><th class="n">Volte</th><th>Ultima</th></tr>${A.map(a=>`<tr><td>${esc(a.nome)}</td><td>${a.tipo}</td><td>${a.stagioni.join(', ')}</td><td class="n">${a.ultimoPrezzo!=null?eur(a.ultimoPrezzo)+' '+esc(a.unita):''}</td><td class="n">${a.volte||''}</td><td>${esc(dIT(a.ultima))}</td></tr>`).join('')}</table>`);
  }
  if(tipo==='quadro'){
    const C=ricette().map(r=>[r,calc(r)]);
    return printHTML(pHead('Quadro food cost')+`<h1>Quadro food cost</h1><table><tr><th>Prodotto</th><th>Stato</th><th class="n">Costo €/kg</th><th class="n">Prezzo teorico €/kg</th><th class="n">Banco</th><th class="n">Margine al banco</th><th class="n">% sul prezzo</th></tr>${C.map(([r,c])=>`<tr><td>${esc(r.nome)}</td><td>${esc(c.stato)}</td><td class="n">${eur(c.ckg)}</td><td class="n">${eur(c.pkg)}</td><td class="n">${r.prezzoBanco!=null?esc(banco(r)):''}</td><td class="n">${c.banco?eur(c.banco.marg)+(c.banco.u==='kg'?'/kg':'/pz'):''}</td><td class="n">${c.banco?pct(c.banco.margPct):''}</td></tr>`).join('')}</table>`);
  }
}

