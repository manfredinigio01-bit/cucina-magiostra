'use strict';
/* ===================== EXCEL (stesse formule del v10) ===================== */
let XL=null;
function loadExcelJS(){ return XL||(XL=new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='lib/exceljs.min.js'; s.onload=()=>res(window.ExcelJS); s.onerror=()=>rej(new Error('ExcelJS non caricato')); document.head.appendChild(s); })); }
function sheetName(n,used){ let s=String(n).replace(/[\[\]:*?\/\\]/g,' ').slice(0,31).replace(/^'+|'+$/g,'').trim()||'Ricetta'; let k=2, b=s; while(used.has(s.toLowerCase())){ const suf=' ('+(k++)+')'; s=b.slice(0,31-suf.length)+suf; } used.add(s.toLowerCase()); return s; }
const qs=n=>"'"+n.replace(/'/g,"''")+"'";
async function buildXlsx(){
  const ExcelJS=await loadExcelJS();
  const wb=new ExcelJS.Workbook(); wb.creator='Cucina La Magiostra'; wb.calcProperties.fullCalcOnLoad=true;
  const Y={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF4C2'}}, H={type:'pattern',pattern:'solid',fgColor:{argb:'FFF3E3D6'}}, T={bold:true,size:14,color:{argb:'FF7C3A20'}};
  const hdr=row=>{ row.font={bold:true}; row.eachCell(c=>{ c.fill=H; c.alignment={wrapText:true,vertical:'top'}; }); };
  const P=S.parametri, I=ings(), R=ricette(), K=packs();
  const NI=Math.max(1000,I.length+50);
  const used=new Set(['prodotti','ingredienti','parametri','packaging','archivio piatti','stagionalità']);
  // Prodotti (riempito alla fine)
  const wsP=wb.addWorksheet('Prodotti',{views:[{state:'frozen',ySplit:4}]});
  // Ingredienti
  const wsI=wb.addWorksheet('Ingredienti',{views:[{state:'frozen',ySplit:4}]});
  wsI.getCell('A1').value="Ingredienti e prezzi d'acquisto"; wsI.getCell('A1').font=T;
  wsI.getCell('A2').value='File generato dall\'app Cucina il '+new Date().toLocaleString('it-IT')+'. Prezzi IVA esclusa. Le modifiche vanno fatte nell\'app: questo file viene riscritto.';
  wsI.getRow(4).values=['Ingrediente','Fornitore',"Prezzo d'acquisto (€)",'Formato (kg, l o pz)','Unità','Costo unitario (€/kg · €/l · €/pz)','Peso per pezzo (kg)','Note','Ultimo prezzo'];
  hdr(wsI.getRow(4));
  I.forEach((i,k)=>{ const r=5+k; wsI.getRow(r).values=[i.nome,i.fornitore,i.prezzo,i.formato,i.unita,null,i.pesoPezzo,i.note,lastPriceDate(i)?new Date(lastPriceDate(i)):null];
    wsI.getCell('F'+r).value={formula:`IF(OR(C${r}="",D${r}="",D${r}=0),"",C${r}/D${r})`,result:unitCost(i)??''}; ['C','D'].forEach(c=>wsI.getCell(c+r).fill=Y); wsI.getCell('I'+r).numFmt='dd/mm/yyyy'; });
  [32,18,14,14,8,16,12,60,12].forEach((w,k)=>wsI.getColumn(k+1).width=w); wsI.getColumn(3).numFmt='#,##0.00 €'; wsI.getColumn(6).numFmt='#,##0.000 €';
  // Parametri (stesse celle del v10)
  const wsA=wb.addWorksheet('Parametri'); wsA.getCell('A1').value='Parametri generali di costo'; wsA.getCell('A1').font=T;
  wsA.getRow(4).values=['Parametro','Valore','Nota']; hdr(wsA.getRow(4));
  const prow=[['Costo orario personale (€/h)',P.costoOrario,'costoOrario'],['Costo energia in cottura (€/h)',P.energiaOra,'energiaOra'],['Affitto mensile (€)',P.affittoMese,'affittoMese'],['Settimane al mese',P.settimaneMese],['Giorni a settimana',P.giorniSettimana],['Ore al giorno',P.oreGiorno],['Costo orario affitto + costi fissi cucina (€/h)',null],['Quota affitto allocata al tempo di produzione',P.quotaAffitto,'quotaAffitto'],['IVA gastronomia',P.iva],['Ricarico predefinito (se non indicato)',P.ricaricoDef],['Packaging predefinito (€/confezione)',P.packagingDef,'packagingDef'],['Altri costi fissi cucina (€/mese)',P.altriFissiMese,'altriFissiMese']];
  prow.forEach(([t,v,nk],k)=>{ const r=5+k; wsA.getCell('A'+r).value=t; if(r===11) wsA.getCell('B11').value={formula:'(B7+B16)/(B8*B9*B10)',result:orarioFissi(P)}; else { wsA.getCell('B'+r).value=v; wsA.getCell('B'+r).fill=Y; } if(nk&&P.note&&P.note[nk]) wsA.getCell('C'+r).value=P.note[nk]; });
  wsA.getColumn(1).width=46; wsA.getColumn(2).width=12; wsA.getColumn(3).width=90;
  // Packaging
  const wsK=wb.addWorksheet('Packaging'); wsK.getCell('A1').value='Packaging'; wsK.getCell('A1').font=T;
  wsK.getRow(3).values=['Packaging','Fornitore',"Prezzo d'acquisto (€)",'Pezzi nella confezione','Costo unitario (€/pz)']; hdr(wsK.getRow(3));
  for(let k=0;k<25;k++){ const r=4+k, p=K[k]; if(p) wsK.getRow(r).values=[p.nome,p.fornitore,p.prezzo,p.pezzi]; wsK.getCell('E'+r).value={formula:`IF(OR(C${r}="",D${r}="",D${r}=0),"",C${r}/D${r})`,result:p?(p.prezzo||0)/(p.pezzi||1):''}; }
  [34,16,14,14,14].forEach((w,k)=>wsK.getColumn(k+1).width=w);
  // Schede ricetta
  const IR=`Ingredienti!$A$5:$A$${4+NI}`, col=c=>`Ingredienti!$${c}$5:$${c}$${4+NI}`;
  const refs=[]; const SN=new Map(R.map(r=>[r.id,sheetName(r.nome,used)]));
  for(const r of R){
    const c=calc(r); const name=SN.get(r.id); refs.push([r,name,c]);
    const ws=wb.addWorksheet(name);
    ws.getCell('A1').value=r.nome; ws.getCell('A1').font=T;
    ws.getCell('H1').value={text:'← Prodotti',hyperlink:"#'Prodotti'!A1"};
    ws.getCell('A2').value='Categoria'; ws.getCell('B2').value=r.categoria; ws.getCell('D2').value='Allergeni'; ws.getCell('E2').value=r.allergeni||null;
    ws.getCell('A3').value='Unità'; ws.getCell('B3').value=r.unita||null; ws.getCell('D3').value='Note'; ws.getCell('E3').value=r.note||null;
    ws.getCell('A5').value='📖  RICETTA'; ws.getCell('A5').font={bold:true};
    ws.getCell('B6').value='Moltiplicatore dosi'; ws.getCell('D6').value=1; ws.getCell('D6').fill=Y; ws.getCell('E6').value='oppure kg finali voluti:'; ws.getCell('G6').fill=Y;
    ws.getCell('B7').value='Moltiplicatore applicato'; ws.getCell('D7').value={formula:'IF(AND(ISNUMBER(G6),G6>0),IFERROR(G6/(D30*(1-$D$53)),D6),IF(ISNUMBER(D6),D6,1))',result:1};
    ws.getRow(9).values=['#','Ingrediente','Unità','Q.tà originale (1 dose)','Q.tà da usare (moltiplicata)','≈ grammi / pezzi','Costo unit. (€/kg·l·pz)','Costo 1 dose (€)','Fornitore']; hdr(ws.getRow(9));
    const rows=r.righe.filter(x=>x.nome).slice(0,20);
    for(let k=0;k<20;k++){
      const rr=10+k, x=rows[k]; ws.getCell('A'+rr).value=k+1;
      if(x){ ws.getCell('B'+rr).value=x.nome; ws.getCell('D'+rr).value=x.dose!=null?x.dose:(x.doseTesto||null); }
      const bs=x&&x.ric?SN.get(x.ric):null;
      ws.getCell('B'+rr).fill=Y; ws.getCell('D'+rr).fill=Y;
      const z=x?c.righe.find(q=>q.x===x):null;
      ws.getCell('C'+rr).value=bs?'kg':{formula:`IF(B${rr}="","",IFERROR(INDEX(${col('E')},MATCH(B${rr},${IR},0)),"?"))`,result:z&&z.i?z.i.unita:''};
      ws.getCell('E'+rr).value={formula:`IF(OR(B${rr}="",D${rr}=""),"",D${rr}*$D$7)`,result:x&&x.dose!=null?x.dose:''};
      ws.getCell('F'+rr).value={formula:`IF(E${rr}="","",IF(C${rr}="pz",E${rr},E${rr}*1000))`,result:''};
      if(bs){ const q=qs(bs); ws.getCell('G'+rr).value={formula:`IF(ISNUMBER(${q}!D61),${q}!D61,IFERROR(IF(${q}!L30>0,"",${q}!H30/(${q}!D30*(1-N(${q}!D53)))),""))`,result:z&&z.u!=null?z.u:''}; }
      else ws.getCell('G'+rr).value={formula:`IF(B${rr}="","",IFERROR(INDEX(${col('F')},MATCH(B${rr},${IR},0)),""))`,result:z&&z.u!=null?z.u:''};
      ws.getCell('H'+rr).value={formula:`IF(OR(B${rr}="",D${rr}="",G${rr}=""),"",D${rr}*G${rr})`,result:z&&z.costo!=null?z.costo:''};
      ws.getCell('I'+rr).value=bs?{text:'ricetta base →',hyperlink:`#${qs(bs)}!A1`}:{formula:`IF(B${rr}="","",IFERROR(INDEX(${col('B')},MATCH(B${rr},${IR},0))&"",""))`,result:z&&z.i?z.i.fornitore:''};
      ws.getCell('K'+rr).value={formula:`IF(OR(B${rr}="",D${rr}=""),0,D${rr}*IF(C${rr}="pz",IFERROR(INDEX(${col('G')},MATCH(B${rr},${IR},0)),0),1))`,result:0};
      ws.getCell('L'+rr).value={formula:`IF(AND(B${rr}<>"",D${rr}<>"",G${rr}=""),1,0)`,result:0};
    }
    ws.getCell('B30').value='Peso impasto crudo (kg) / Costo ingredienti'; ws.getCell('D30').value={formula:'SUM(K10:K29)',result:c.peso}; ws.getCell('E30').value={formula:'D30*$D$7',result:c.peso}; ws.getCell('H30').value={formula:'SUM(H10:H29)',result:c.costo}; ws.getCell('L30').value={formula:'SUM(L10:L29)',result:c.manc};
    ws.getCell('B31').value='Costo ingredienti per la quantità moltiplicata'; ws.getCell('H31').value={formula:'H30*$D$7',result:c.costo};
    ws.getCell('I31').value={formula:'IF(L30>0,"⚠ "&L30&" prezzi mancanti","")',result:c.manc?'⚠ '+c.manc+' prezzi mancanti':''};
    if(r.righe.filter(x=>x.nome).length>20) ws.getCell('I32').value='⚠ La ricetta ha più di 20 ingredienti: nell\'Excel ci sono solo i primi 20 (nell\'app ci sono tutti).';
    ws.getCell('A33').value='Procedimento'; ws.getCell('A33').font={bold:true};
    ws.getCell('A34').value=r.procedimento||null; ws.mergeCells('A34:I47'); ws.getCell('A34').alignment={wrapText:true,vertical:'top'};
    ws.getCell('A49').value='€  FOOD COST (calcolato sul lotto standard di produzione)'; ws.getCell('A49').font={bold:true};
    const set=(cell,label,val,fill)=>{ ws.getCell('B'+cell).value=label; ws.getCell('D'+cell).value=val; if(fill) ws.getCell('D'+cell).fill=Y; };
    set(50,'Lotto standard di produzione (n. dosi)',r.lotto,1); set(51,'Tempo di produzione (minuti)',r.tProd,1); set(52,'Tempo di cottura (minuti)',r.tCott,1); set(53,'Perdita di peso in cottura',r.perdita,1);
    ws.getCell('D53').numFmt='0%';
    set(54,'Peso crudo del lotto (kg)',{formula:'D30*N(D50)',result:c.crudo}); set(55,'Peso finale del lotto (kg)',{formula:'D54*(1-N(D53))',result:c.fin});
    set(56,'Costo ingredienti del lotto',{formula:'H30*N(D50)',result:c.cIng}); set(57,'Costo manodopera',{formula:'N(D51)/60*Parametri!$B$5',result:c.man});
    set(58,'Costo energia',{formula:'N(D52)/60*Parametri!$B$6',result:c.en}); set(59,'Quota affitto e costi fissi cucina',{formula:'(N(D51)+N(D52))/60*Parametri!$B$11*Parametri!$B$12',result:c.aff});
    set(60,'COSTO TOTALE DEL LOTTO',{formula:'SUM(D56:D59)',result:c.tot}); set(61,'COSTO DI PRODUZIONE €/kg',{formula:'IF(D55>0,D60/D55,"")',result:c.ckg??''});
    set(62,'Peso ingredienti sul costo totale',{formula:'IF(D60>0,D56/D60,"")',result:c.pesoIng??''}); set(63,'Peso manodopera sul costo totale',{formula:'IF(D60>0,D57/D60,"")',result:c.pesoMan??''});
    set(64,'Ricarico',r.ricarico,1); set(65,'Ricarico applicato',{formula:'IF(ISNUMBER(D64),D64,Parametri!$B$14)',result:c.ric});
    set(66,'Prezzo di vendita €/kg (IVA incl.)',{formula:'IF(ISNUMBER(D61),D61*(1+D65)*(1+Parametri!$B$13),"")',result:c.pkg??''});
    ws.getCell('E66').value={formula:'IF(ISNUMBER(D66),D66/10,"")',result:c.pkg!=null?c.pkg/10:''}; ws.getCell('F66').value='€/etto'; ws.getCell('E66').numFmt='#,##0.00 €';
    set(67,'Pezzatura (g) — vuoto = venduto solo al kg',r.vendita==='pezzo'?r.confezione:null,1);
    const pk=K.find(p=>p.id===r.packaging); set(68,'Packaging usato',pk?pk.nome:null,1); ws.getCell('E68').value=r.pezziPack; ws.getCell('E68').fill=Y;
    ws.getCell('F68').value={formula:'IF(D68="",Parametri!$B$15,IFERROR(INDEX(Packaging!$E$4:$E$28,MATCH(D68,Packaging!$A$4:$A$28,0))*IF(ISNUMBER(E68),E68,1),Parametri!$B$15))',result:c.pcost};
    set(69,'Costo pieno della confezione',{formula:'IF(AND(ISNUMBER(D61),N(D67)>0),D61*D67/1000+F68,"")',result:c.conf??''});
    set(70,'Prezzo della confezione (IVA incl.)',{formula:'IF(ISNUMBER(D69),D69*(1+D65)*(1+Parametri!$B$13),"")',result:c.pconf??''});
    set(71,'Margine lordo a confezione (al netto IVA)',{formula:'IF(ISNUMBER(D70),D70/(1+Parametri!$B$13)-D69,"")',result:c.marg??''});
    ['D56','D57','D58','D59','D60','D61','D66','D69','D70','D71','H30','H31','F68'].forEach(a=>ws.getCell(a).numFmt='#,##0.00 €'); ['D62','D63','D64','D65'].forEach(a=>ws.getCell(a).numFmt='0%');
    for(let k=10;k<30;k++){ ws.getCell('G'+k).numFmt='#,##0.000 €'; ws.getCell('H'+k).numFmt='#,##0.000 €'; }
    [5,34,8,14,14,12,14,14,18].forEach((w,k)=>ws.getColumn(k+1).width=w); ws.getColumn(11).hidden=true; ws.getColumn(12).hidden=true;
  }
  // Prodotti
  wsP.getCell('A1').value='La Magiostra — Cucina: prodotti, ricettario e food cost'; wsP.getCell('A1').font=T;
  wsP.getCell('A2').value='Generato dall\'app Cucina il '+new Date().toLocaleString('it-IT')+'. Clicca il nome per aprire la scheda. Per modificare usa l\'app: questo file viene riscritto.';
  wsP.getRow(4).values=['#','Prodotto','Categoria','Stato','Costo produzione €/kg','Ricarico','Prezzo €/kg (IVA incl.)','Pezzatura (g)','Prezzo a pezzo','Margine a pezzo','Prezzo al banco','Unità','Ricarico reale al banco','Prezzo €/etto (IVA incl.)','Margine al banco: unità','Costo pieno per unità','Prezzo ipotetico con ricarico '+Math.round(S.parametri.ricaricoDef*100)+'% (IVA incl.)','Margine al banco (senza IVA)','Margine % sul prezzo senza IVA','Banco − ipotetico']; hdr(wsP.getRow(4));
  refs.forEach(([r,name,c],k)=>{ const row=5+k, q=qs(name);
    wsP.getCell('A'+row).value=k+1;
    wsP.getCell('B'+row).value={text:r.nome,hyperlink:`#${q}!A1`}; wsP.getCell('B'+row).font={color:{argb:'FF7C3A20'},underline:true};
    wsP.getCell('C'+row).value=r.categoria; wsP.getCell('D'+row).value=c.stato;
    wsP.getCell('E'+row).value={formula:`${q}!D61`,result:c.ckg??''}; wsP.getCell('F'+row).value={formula:`${q}!D65`,result:c.ric};
    wsP.getCell('G'+row).value={formula:`${q}!D66`,result:c.pkg??''}; wsP.getCell('H'+row).value={formula:`IF(N(${q}!D67)>0,${q}!D67,"")`,result:r.vendita==='pezzo'&&r.confezione?r.confezione:''};
    wsP.getCell('I'+row).value={formula:`${q}!D70`,result:c.pconf??''}; wsP.getCell('J'+row).value={formula:`${q}!D71`,result:c.marg??''};
    wsP.getCell('K'+row).value=r.prezzoBanco; wsP.getCell('L'+row).value=r.unitaBanco||null;
    wsP.getCell('M'+row).value={formula:`IF(AND(ISNUMBER(K${row}),L${row}="€/etto",ISNUMBER(E${row})),K${row}*10/(1+Parametri!$B$13)/E${row}-1,IF(AND(ISNUMBER(K${row}),L${row}="€/kg",ISNUMBER(E${row})),K${row}/(1+Parametri!$B$13)/E${row}-1,""))`,result:c.ricReale??''};
    wsP.getCell('N'+row).value={formula:`IF(ISNUMBER(G${row}),G${row}/10,"")`,result:c.pkg!=null?c.pkg/10:''};
    const b=c.banco;
    if(b){ wsP.getCell('O'+row).value=b.u==='kg'?'€/kg':'€/pz'; wsP.getCell('P'+row).value=b.costo; wsP.getCell('Q'+row).value=b.ipo; wsP.getCell('R'+row).value=b.marg; wsP.getCell('S'+row).value=b.margPct; wsP.getCell('T'+row).value=b.diff;
      if(b.marg<0) wsP.getCell('R'+row).font={color:{argb:'FFB3261E'},bold:true}; }
    if(c.stato!=='OK') wsP.getCell('D'+row).font={color:{argb:'FFA86B00'}};
  });
  wsP.getCell('O3').value='Colonne O–T: calcolate dall\'app sul costo pieno (ingredienti, lavoro, energia, affitto e fissi cucina; a pezzo anche il packaging).'; wsP.getCell('O3').font={italic:true,size:9,color:{argb:'FF777777'}};
  [5,36,16,18,14,10,16,12,14,14,12,10,14,14,10,14,16,16,14,14].forEach((w,k)=>wsP.getColumn(k+1).width=w);
  ['E','G','I','J','K','N','P','Q','R','T'].forEach(c=>wsP.getColumn(c).numFmt='#,##0.00 €'); ['F','M','S'].forEach(c=>wsP.getColumn(c).numFmt='0%');
  // Archivio piatti
  const wsR=wb.addWorksheet('Archivio piatti',{views:[{state:'frozen',ySplit:1}]});
  wsR.getRow(1).values=['Piatto','Tipo','Categoria','Primavera','Estate','Autunno','Inverno','Mesi','Ultimo prezzo','Unità','Volte','Prima volta','Ultima volta','Materia prima']; hdr(wsR.getRow(1));
  S.archivio.filter(a=>!a.deleted).sort((a,b)=>a.nome.localeCompare(b.nome,'it')).forEach(a=>wsR.addRow([a.nome,a.tipo,a.categoria,...['primavera','estate','autunno','inverno'].map(s=>a.stagioni.includes(s)?'●':''),a.mesi,a.ultimoPrezzo,a.unita,a.volte,a.prima?new Date(a.prima):null,a.ultima?new Date(a.ultima):null,a.materiaPrima]));
  [44,8,12,6,6,6,6,24,10,8,7,11,11,22].forEach((w,k)=>wsR.getColumn(k+1).width=w); wsR.getColumn(12).numFmt='mm/yyyy'; wsR.getColumn(13).numFmt='mm/yyyy';
  wsR.autoFilter='A1:N1';
  const wsS=wb.addWorksheet('Stagionalità'); wsS.getRow(1).values=['Materia prima','Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic']; hdr(wsS.getRow(1));
  S.stagionalita.forEach(s=>wsS.addRow([s.nome,...Array.from({length:12},(_,m)=>s.mesi.includes(m)?'●':'')])); wsS.getColumn(1).width=24;
  return wb.xlsx.writeBuffer();
}

