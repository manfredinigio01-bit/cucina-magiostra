# App Cucina La Magiostra – note per le modifiche

PWA (HTML/CSS/JS vanilla) per ricettario, food cost, prezzi d'acquisto e archivio piatti. Utente: Giovanni. Interfaccia in italiano. Pubblicata con GitHub Pages da `main`, root: https://manfredinigio01-bit.github.io/cucina-magiostra/
Separata dall'app etichette (repo `etichette-magiostra`): fino al 25/11/2026 stava in `etichette-magiostra/cucina/`, spostata qui perché Edge non installava un'app dentro lo scope delle etichette. Lo stesso origin (manfredinigio01-bit.github.io) mantiene IndexedDB: vault e cache restano validi.

## Pubblicare
Alzare la versione in tre punti: `APP_VERSION` in `app.js`, `version.json`, `CACHE` in `sw.js`. Commit e push su `main`.

## Dati
- Repo PRIVATO `manfredinigio01-bit/magiostra-cucina-dati`, file `ricettario.json` (parametri, ingredienti con storico, packaging, ricette, archivio piatti, stagionalità, mappaFatture voce→ingrediente, importati). `sanitize()` su tutto ciò che si carica: ogni campo nuovo va aggiunto lì.
- Unione per `updatedAt` (monotono con `touch()`); a parità vince l'archivio online. Eliminazioni = `deleted:true`.
- Claude può modificare `ricettario.json` direttamente (es. prezzi da fatture PDF): alzare `updatedAt` degli elementi toccati.

## Sicurezza
- Password all'apertura; token + copia locale cifrati AES-GCM 256, chiave PBKDF2-SHA256 600.000 iterazioni (IndexedDB `cucina-magiostra`: vault, cache, dir). Blocco dopo 30 minuti. Ritardo crescente dopo 3 password sbagliate.
- CSP: `script-src 'self'` (niente script inline, niente onclick: solo `data-act` con delega eventi), `connect-src 'self' https://api.github.com`. Nessun CDN. Tutto il testo nell'HTML passa da `esc()`.
- Rifiuta archivi pubblici.

## Food cost
`calc()` replica le formule del file Excel v10 (Gastronomia_ricettario_foodcost_v10): verificato su 104 schede, differenze 0. L'export (`buildXlsx`, ExcelJS in `lib/`) riscrive la stessa struttura con formule; ricalcolato con LibreOffice = valori dell'app.

## Funzioni aggiunte (v1.2.0, 25/11/2026)
- `ricetta.vendita` 'kg' | 'pezzo' (default da `unitaBanco`: €/pz o porzione → pezzo). Con 'kg' si mostrano solo €/kg ed €/etto: niente prezzo a confezione né in app né nell'Excel (D67 vuota). Con 'pezzo' compare anche il prezzo del pezzo da `confezione` grammi (+ packaging).
- Ricette base: una riga può avere `ric` (id di un'altra ricetta) al posto di `ing`; dose in kg; costo = `calc(base).ckg` (costo pieno), oppure solo ingredienti se la base non ha lotto. Protezione dai cicli. Nell'editor si scelgono le voci "Base: nome". Excel: G = foglio della base!D61.
- Scheda ricetta: "Dosi da produrre" / "kg finali" / minuti simulano il food cost (`calc(r,{dosi,kgVoluti,tProd,tCott})`), senza salvare; "Salva come lotto standard" li salva.
- Le liste (`.list`, `.scroll`) conservano lo scorrimento a ogni render.
- Verifica Excel: per ricalcolare davvero con LibreOffice bisogna togliere i risultati salvati (riaprire e salvare con openpyxl), altrimenti LibreOffice mostra i valori in cache. 25/11: 1668 celle, 0 differenze.

## File in ingresso (letti in locale)
Fatture FatturaPA .xml/.p7m/.zip (prezzo netto = PrezzoTotale/Quantita; TD04/TD05 ignorate; farine solo Mulino Sobrino; riga più recente / formato più grande), PROPOSTE della GASTRONOMIA .docx → archivio piatti e prezzo al banco, .xlsx con colonne descrizione/prezzo. PDF e foto: li elabora Claude in chat.

## Etichette
`ricetta.etichetta` = id prodotto in `etichette-magiostra-dati/archivio.json`. L'app può creare/aggiornare il testo ingredienti (ordine per peso) con merge su sha.
