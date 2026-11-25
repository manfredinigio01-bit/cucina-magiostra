// Test automatici dell'app Cucina. Si lanciano con:  npm test
// Food cost verificato con conti fatti a mano, fatture elettroniche, Excel, sicurezza e dati.
// Usano SOLO un ricettario inventato (tests/fixtures): mai prezzi o ricette vere in questo repository pubblico.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { avviaServer, avviaBrowser, apriApp, leggiJSON, RADICE } from './aiuto.mjs';

let server, browser, app, dati;
const vicino = (a, b, msg) => assert.ok(a != null && Math.abs(a - b) < 1e-9, `${msg}: ${a} invece di ${b}`);

before(async () => {
  server = await avviaServer();
  browser = await avviaBrowser();
  dati = await leggiJSON('tests/fixtures/ricettario-prova.json');
  app = await apriApp(browser, server.url);
  await app.pagina.evaluate((d) => { S = sanitize(d); reindex(); }, dati);
});
after(async () => { await browser?.close(); await server?.chiudi(); });

const calcola = (id, opt) => app.pagina.evaluate(([id, opt]) => {
  const c = calc(getR(id), opt || {});
  return { stato: c.stato, ckg: c.ckg, tot: c.tot, fin: c.fin, cIng: c.cIng, man: c.man, en: c.en, aff: c.aff,
    pkg: c.pkg, conf: c.conf, pconf: c.pconf, banco: c.banco };
}, [id, opt]);

test('l\'app si apre e chiede la password al primo avvio', async () => {
  assert.match(await app.pagina.innerText('body'), /Primo avvio su questo computer/);
});

test('food cost ricetta base: valori calcolati a mano', async () => {
  // 0,5 kg farina a 1,20 €/kg + 0,1 kg olio a 8 €/kg = 1,40 € per dose; lotto 10 dosi, calo 10%
  // lavoro 60 min a 18 €/h = 18 €; energia 30 min a 5 €/h = 2,50 €
  // affitto e fissi: (400+230) € / (4×5×6 h) = 5,25 €/h × 1,5 h × 50% = 3,9375 €
  // totale 14 + 18 + 2,5 + 3,9375 = 38,4375 € su 5,4 kg finali = 7,1180555… €/kg
  const c = await calcola('r-base');
  assert.equal(c.stato, 'OK');
  vicino(c.cIng, 14, 'ingredienti');
  vicino(c.man, 18, 'lavoro');
  vicino(c.en, 2.5, 'energia');
  vicino(c.aff, 3.9375, 'affitto e fissi');
  vicino(c.tot, 38.4375, 'costo totale');
  vicino(c.fin, 5.4, 'kg finali');
  vicino(c.ckg, 38.4375 / 5.4, 'costo pieno €/kg');
  vicino(c.pkg, (38.4375 / 5.4) * 1.7 * 1.1, 'prezzo al kg con ricarico 70% e IVA 10%');
});

test('margine reale al banco (prezzo in €/etto)', async () => {
  const c = await calcola('r-base');
  const ckg = 38.4375 / 5.4, netto = 18 / 1.1;
  assert.equal(c.banco.u, 'kg');
  vicino(c.banco.netto, netto, 'prezzo al kg senza IVA');
  vicino(c.banco.marg, netto - ckg, 'margine al kg');
  vicino(c.banco.margPct, (netto - ckg) / netto, 'margine %');
  vicino(c.banco.ipo, ckg * 1.7 * 1.1, 'prezzo ipotetico');
});

test('vendita a pezzo: confezione 300 g + vaschetta', async () => {
  const c = await calcola('r-pezzo');
  const ckg = 38.4375 / 5.4, conf = ckg * 0.3 + 10 / 100;
  vicino(c.conf, conf, 'costo del pezzo');
  vicino(c.pconf, conf * 1.7 * 1.1, 'prezzo del pezzo');
  assert.equal(c.banco.u, 'pz');
  vicino(c.banco.marg, 3.5 / 1.1 - conf, 'margine a pezzo');
});

test('ricetta che usa una base + ingrediente a pezzi (uova)', async () => {
  // base 0,2 kg × 7,118… €/kg + 2 uova × 0,50 € = 2,4236… per dose; peso 0,2 + 2×0,06 = 0,32 kg
  // 5 dosi → 1,6 kg; lavoro 30 min = 9 €; affitto 0,5 h × 5,25 × 50% = 1,3125 €
  const c = await calcola('r-composta');
  const costoDose = 0.2 * (38.4375 / 5.4) + 1;
  vicino(c.tot, costoDose * 5 + 9 + 1.3125, 'costo totale');
  vicino(c.ckg, (costoDose * 5 + 9 + 1.3125) / 1.6, 'costo pieno €/kg');
  assert.equal(c.stato, 'OK');
});

test('simulazione: dosi e kg voluti cambiano il food cost senza salvare', async () => {
  const doppio = await calcola('r-base', { dosi: 20 });
  vicino(doppio.cIng, 28, 'ingredienti per 20 dosi');
  const kg = await calcola('r-base', { kgVoluti: 10.8 });
  vicino(kg.fin, 10.8, 'kg finali voluti');
  const ancora = await calcola('r-base');
  vicino(ancora.fin, 5.4, 'la ricetta salvata non deve cambiare');
});

test('stati della ricetta: vuota, prezzi mancanti, tempi mancanti', async () => {
  assert.equal((await calcola('r-vuota')).stato, 'Ricetta da inserire');
  assert.equal((await calcola('r-mancaprezzo')).stato, 'Prezzi mancanti');
  assert.equal((await calcola('r-senzatempi')).stato, 'Tempi mancanti');
});

test('una base con prezzi mancanti NON rende "OK" la ricetta che la usa', async () => {
  const r = await app.pagina.evaluate(() => {
    const x = JSON.parse(JSON.stringify(getR('r-composta')));
    x.id = 'r-prova-base-incompleta'; x.righe[0] = { ric: 'r-mancaprezzo', nome: 'Base: Con prezzo mancante', dose: 0.2 };
    S.ricette.push(x);
    const c = calc(x); S.ricette.pop();
    return c.stato;
  });
  assert.equal(r, 'Prezzi mancanti');
});

test('ricette che si contengono a vicenda: nessun blocco e nessun "OK"', async () => {
  assert.equal((await calcola('r-cicloA')).stato, 'Prezzi mancanti');
  assert.equal((await calcola('r-cicloB')).stato, 'Prezzi mancanti');
});

test('fattura elettronica: prezzo netto = totale / quantità, note di credito ignorate', async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
<FatturaElettronicaHeader><CedentePrestatore><DatiAnagrafici><Anagrafica><Denominazione>Fornitore di Prova srl</Denominazione></Anagrafica></DatiAnagrafici></CedentePrestatore></FatturaElettronicaHeader>
<FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Data>2026-11-20</Data><Numero>12</Numero></DatiGeneraliDocumento></DatiGenerali>
<DatiBeniServizi>
<DettaglioLinee><Descrizione>FARINA TIPO 1 KG 25</Descrizione><Quantita>2.00</Quantita><UnitaMisura>PZ</UnitaMisura><PrezzoUnitario>20.00</PrezzoUnitario><PrezzoTotale>36.00</PrezzoTotale><AliquotaIVA>4.00</AliquotaIVA></DettaglioLinee>
<DettaglioLinee><Descrizione>Trasporto</Descrizione><Quantita>1</Quantita><PrezzoUnitario>0</PrezzoUnitario><PrezzoTotale>0.00</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
</DatiBeniServizi></FatturaElettronicaBody>
<FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD04</TipoDocumento><Data>2026-11-21</Data><Numero>13</Numero></DatiGeneraliDocumento></DatiGenerali>
<DatiBeniServizi><DettaglioLinee><Descrizione>RESO FARINA</Descrizione><Quantita>1</Quantita><PrezzoUnitario>5</PrezzoUnitario><PrezzoTotale>5.00</PrezzoTotale><AliquotaIVA>4.00</AliquotaIVA></DettaglioLinee></DatiBeniServizi></FatturaElettronicaBody>
</p:FatturaElettronica>`;
  const r = await app.pagina.evaluate((xml) => {
    IMP = { righe: [], proposte: [], note: [] };
    parseInvoice(new TextEncoder().encode(xml), 'prova.xml');
    const out = { righe: IMP.righe.map((x) => ({ voce: x.voce, netto: x.netto, fornitore: x.fornitore, iva: x.iva })), note: IMP.note.length };
    IMP = null; return out;
  }, xml);
  assert.equal(r.righe.length, 1, 'solo la riga della farina (trasporto a 0 € e nota di credito esclusi)');
  assert.equal(r.righe[0].netto, 18, 'prezzo netto con lo sconto: 36 / 2');
  assert.equal(r.righe[0].fornitore, 'Fornitore di Prova srl');
  assert.equal(r.note, 1, 'la nota di credito va segnalata');
});

test('file che non è una fattura: errore chiaro, nessun dato inserito', async () => {
  const r = await app.pagina.evaluate(() => {
    IMP = { righe: [], proposte: [], note: [] }; let msg = '';
    try { parseInvoice(new TextEncoder().encode('<?xml version="1.0"?><altro/>'), 'x.xml'); } catch (e) { msg = e.message; }
    const n = IMP.righe.length; IMP = null; return { msg, n };
  });
  assert.match(r.msg, /non è una fattura/);
  assert.equal(r.n, 0);
});

test('Excel: si genera con formule e tutti i fogli', async () => {
  const r = await app.pagina.evaluate(async () => {
    const buf = await buildXlsx();
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
    let formule = 0; const fogli = [];
    wb.eachSheet((ws) => { fogli.push(ws.name); ws.eachRow((row) => row.eachCell((c) => { if (c.formula || c.sharedFormula) formule++; })); });
    return { fogli, formule, byte: buf.byteLength };
  });
  for (const f of ['Prodotti', 'Ingredienti', 'Packaging', 'Parametri', 'Archivio piatti', 'Stagionalità'])
    assert.ok(r.fogli.includes(f), `manca il foglio ${f}`);
  assert.ok(r.formule > 50, `poche formule: ${r.formule}`);
});

test('cifratura: i dati si aprono solo con la password giusta', async () => {
  const r = await app.pagina.evaluate(async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const k = await deriveKey('password-di-prova', salt, 1000);
    const scatola = await seal(k, { segreto: 'ricetta segreta', token: 'github_pat_prova' });
    const testo = JSON.stringify(scatola);
    const giusta = await unseal(await deriveKey('password-di-prova', salt, 1000), scatola);
    let sbagliata = 'aperta';
    try { await unseal(await deriveKey('altra', salt, 1000), scatola); } catch { sbagliata = 'rifiutata'; }
    return { inChiaro: testo.includes('ricetta segreta') || testo.includes('github_pat'), giusta: giusta.segreto, sbagliata, iter: PBKDF2_ITER };
  });
  assert.equal(r.inChiaro, false);
  assert.equal(r.giusta, 'ricetta segreta');
  assert.equal(r.sbagliata, 'rifiutata');
  assert.ok(r.iter >= 600000);
});

test('dati manomessi: id pericolosi e campi strani vengono ripuliti', async () => {
  const r = await app.pagina.evaluate(() => {
    const s = sanitize({ ingredienti: [{ id: '"><script>', nome: '<b>x</b>', prezzo: 'tanto', formato: -5, unita: 'litri' }],
      ricette: [{ id: 'ok-1', nome: 'R', righe: [{ ing: '../x', nome: 'y', dose: 1e9 }] }], parametri: { iva: 'abc', costoOrario: 999999999 } });
    return { idI: s.ingredienti[0].id, prezzo: s.ingredienti[0].prezzo, formato: s.ingredienti[0].formato, unita: s.ingredienti[0].unita,
      ing: s.ricette[0].righe[0].ing, dose: s.ricette[0].righe[0].dose, iva: s.parametri.iva, orario: s.parametri.costoOrario };
  });
  assert.doesNotMatch(r.idI, /[<>"]/);
  assert.equal(r.prezzo, null);
  assert.equal(r.formato, 0);
  assert.equal(r.unita, 'kg');
  assert.equal(r.ing, null);
  assert.equal(r.dose, 10000);
  assert.equal(r.iva, 0.1);
  assert.equal(r.orario, 100000);
});

test('unione: vince la modifica più recente; a parità vince l\'archivio online', async () => {
  const r = await app.pagina.evaluate(() => {
    const a = sanitize(JSON.parse(JSON.stringify(S))), b = sanitize(JSON.parse(JSON.stringify(S)));
    a.ingredienti[0].prezzo = 1; a.ingredienti[0].updatedAt = 5000;
    b.ingredienti[0].prezzo = 2; b.ingredienti[0].updatedAt = 4000;
    a.ingredienti[1].prezzo = 3; a.ingredienti[1].updatedAt = 6000;
    b.ingredienti[1].prezzo = 4; b.ingredienti[1].updatedAt = 6000;
    const m = merge(a, b);
    return [m.ingredienti.find((i) => i.id === a.ingredienti[0].id).prezzo, m.ingredienti.find((i) => i.id === a.ingredienti[1].id).prezzo];
  });
  assert.deepEqual(r, [1, 4]);
});

test('impronta del food cost invariata (protegge dalle modifiche involontarie)', async () => {
  const impronta = await app.pagina.evaluate(() => Object.fromEntries(S.ricette.map((r) => {
    const c = calc(r); return [r.id, JSON.stringify({ stato: c.stato, ckg: c.ckg, tot: c.tot, pkg: c.pkg, conf: c.conf, pconf: c.pconf, banco: c.banco })];
  })));
  const file = join(RADICE, 'tests/fixtures/impronta-foodcost.json');
  if (process.env.AGGIORNA_IMPRONTA) { await writeFile(file, JSON.stringify(impronta, null, 1) + '\n'); return; }
  assert.deepEqual(impronta, JSON.parse(await readFile(file, 'utf8')));
});

test('nessun errore JavaScript o di sicurezza (CSP) durante i test', () => {
  assert.deepEqual(app.errori, []);
});
