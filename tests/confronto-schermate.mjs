// Confronto delle SCHERMATE con i dati veri (stesso uso di confronto-dati-veri.mjs, dati sempre fuori dal repository):
// apre ogni scheda e ogni ricetta (scheda e modifica) e salva l'HTML mostrato.
//   node tests/confronto-schermate.mjs <ricettario.json> <uscita.json>
import { readFile, writeFile } from 'node:fs/promises';
import { avviaServer, avviaBrowser, apriApp } from './aiuto.mjs';
const [, , ingresso, uscita] = process.argv;
const dati = JSON.parse(await readFile(ingresso, 'utf8'));
const server = await avviaServer(), browser = await avviaBrowser();
const { pagina, ctx, errori } = await apriApp(browser, server.url);
const r = await pagina.evaluate((d) => {
  S = sanitize(d); reindex(); ETI = { settings: {}, prodotti: [] }; CFG = { repo: DEF_REPO, nome: 'Postazione di prova', token: 'x' };
  document.getElementById('lock').classList.add('hidden'); document.getElementById('main').classList.remove('hidden');
  const out = {}, m = document.getElementById('main');
  const foto = (k) => { out[k] = m.innerHTML.replace(/il \d{2}\/\d{2}\/\d{4},? \d{2}:\d{2}(:\d{2})?/g, 'il <data>'); };
  for (const t of ['quadro', 'ricette', 'ingredienti', 'archivio', 'fatture', 'impostazioni']) { TAB = t; SEL = null; EDIT = null; render(); foto('scheda:' + t); }
  TAB = 'ricette';
  for (const x of ricette()) { SEL = x.id; EDIT = null; render(); foto('ricetta:' + x.id); }
  TAB = 'ingredienti';
  for (const i of ings().slice(0, 40)) { SEL = i.id; render(); foto('ingrediente:' + i.id); }
  return out;
}, dati);
await writeFile(uscita, JSON.stringify(r, null, 1));
console.log(`Schermate salvate: ${Object.keys(r).length}. Errori: ${errori.length ? errori.join(' | ') : 'nessuno'}`);
await ctx.close(); await browser.close(); await server.chiudi();
