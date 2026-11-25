// Confronto con i DATI VERI, da usare prima e dopo una modifica importante al codice.
// I dati veri non entrano mai nel repository: si passano da fuori e il risultato va in tests/locale/ (ignorata da git).
//
//   node tests/confronto-dati-veri.mjs <ricettario.json> <uscita.json>
//
// Per ogni ricetta salva tutto il risultato del food cost e il file Excel generato (solo i valori e le formule).
import { readFile, writeFile } from 'node:fs/promises';
import { avviaServer, avviaBrowser, apriApp } from './aiuto.mjs';

const [, , ingresso, uscita] = process.argv;
if (!ingresso || !uscita) { console.error('Uso: node tests/confronto-dati-veri.mjs <ricettario.json> <uscita.json>'); process.exit(2); }
const dati = JSON.parse(await readFile(ingresso, 'utf8'));
const server = await avviaServer(), browser = await avviaBrowser();
const { pagina, ctx, errori } = await apriApp(browser, server.url);
const r = await pagina.evaluate(async (d) => {
  S = sanitize(d); reindex();
  const foodcost = {};
  for (const x of S.ricette) { const c = calc(x); delete c.righe; foodcost[x.id] = c; }
  const buf = await buildXlsx(); const wb = new (await loadExcelJS()).Workbook(); await wb.xlsx.load(buf);
  const excel = {};
  wb.eachSheet((ws) => { const celle = []; ws.eachRow((row, ri) => row.eachCell((c, ci) => celle.push([ri, ci, c.formula || c.sharedFormula || null, c.formula ? null : (c.value && c.value.richText ? JSON.stringify(c.value) : c.value)]))); excel[ws.name] = celle; });
  const stati = Object.values(foodcost).reduce((m, c) => { m[c.stato] = (m[c.stato] || 0) + 1; return m; }, {});
  return { ricette: S.ricette.length, stati, foodcost, excel };
}, dati);
// l'ora di creazione scritta nell'Excel cambia a ogni esecuzione: non conta per il confronto
await writeFile(uscita, JSON.stringify(r, null, 1).replace(/il \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}/g, 'il <data>'));
console.log(`Ricette: ${r.ricette}. Stati: ${JSON.stringify(r.stati)}. Fogli Excel: ${Object.keys(r.excel).length}`);
if (errori.length) { console.error('ERRORI:', errori); process.exitCode = 1; }
await ctx.close(); await browser.close(); await server.chiudi();
