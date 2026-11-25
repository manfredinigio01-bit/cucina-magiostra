// La versione di PROVA (cartella prova/) deve essere completamente separata da quella vera:
// banche dati diverse nello stesso browser, nessuna scrittura su GitHub né nella cartella Drive.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { avviaServer, avviaBrowser } from './aiuto.mjs';

let server, browser;
before(async () => { server = await avviaServer(); browser = await avviaBrowser(); });
after(async () => { await browser?.close(); await server?.chiudi(); });

test('prova: riconoscibile, banca dati separata, non installabile', async () => {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const vera = await ctx.newPage(); await vera.goto(server.url + '/index.html');
  await vera.evaluate(() => kvSet('prova-separazione', 'vera'));
  const prova = await ctx.newPage(); await prova.goto(server.url + '/prova/index.html');
  const r = await prova.evaluate(async () => ({ PROVA, PFX, letto: await kvGet('prova-separazione'),
    db: (await indexedDB.databases()).map((d) => d.name).sort(), fascia: !!document.getElementById('provabar'),
    manifest: !!document.querySelector('link[rel="manifest"]'), titolo: document.title }));
  assert.equal(r.PROVA, true);
  assert.equal(r.PFX, 'prova_');
  assert.equal(r.letto, undefined, 'la prova legge la banca dati della versione vera');
  assert.ok(r.db.includes('prova_cucina-magiostra') && r.db.includes('cucina-magiostra'));
  assert.equal(r.fascia, true);
  assert.equal(r.manifest, false);
  assert.match(r.titolo, /^PROVA/);
  assert.equal(await vera.evaluate(() => PROVA), false);
  await ctx.close();
});

test('prova: nessuna scrittura su GitHub (né Cucina né Etichette) e niente file sul Drive', async () => {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const richieste = [];
  await ctx.route('https://api.github.com/**', (r) => { richieste.push(r.request().method()); r.fulfill({ status: 200, body: '{}' }); });
  const prova = await ctx.newPage(); await prova.goto(server.url + '/prova/index.html');
  const r = await prova.evaluate(async () => {
    CFG = { repo: 'utente/archivio', token: 'github_pat_prova' };
    const w = await ghWriteJSON('utente/archivio', 'ricettario.json', { x: 1 }, 'sha', 'prova');
    const w2 = await ghWriteJSON(ETI_REPO, 'archivio.json', { x: 1 }, 'sha', 'prova');
    await dirInit();
    return { ok: w.ok && w2.ok, dirState };
  });
  assert.equal(r.ok, true);
  assert.deepEqual(richieste, [], 'la prova ha mandato richieste di scrittura a GitHub');
  assert.equal(r.dirState, 'nosupport', 'la prova non deve scrivere nella cartella Drive');
  // la versione vera invece scrive davvero
  const vera = await ctx.newPage(); await vera.goto(server.url + '/index.html');
  await vera.evaluate(async () => { CFG = { repo: 'utente/archivio', token: 'github_pat_vera' }; await ghWriteJSON('utente/archivio', 'ricettario.json', { x: 1 }, 'sha', 'vera'); });
  assert.deepEqual(richieste, ['PUT']);
  await ctx.close();
});
