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

## Fatture: cucina o negozio (v1.3.0, 25/11/2026)
- `S.fornitori` [{id,nome,alias[],regola:'cucina'|'negozio'|'misto'}]: nome unico del fornitore (le fatture lo scrivono in modi diversi) e regola. Granchef (Woerndle) e Mulino Sobrino = tutto cucina; gli altri misto.
- Per riga: `dest` 'cucina' | 'negozio' | '?' / '?cucina' (da decidere, l'app non applica finché Giovanni non sceglie). Ordine: mappa voce→negozio ricordata, regola del fornitore, abbinamento sicuro (mappa voce→ingrediente), altrimenti da decidere.
- Cucina: aggiorna l'ingrediente (prezzo, formato, fornitore = nome unico, storico) oppure lo crea nuovo (nome proposto da `nomeDaVoce`). Negozio: salvato in `mappaFatture` con `negozio:true` e saltato le volte dopo.
- Per ingrediente vale una sola riga (la più recente, poi formato più grande) e mai una fattura più vecchia dell'ultimo prezzo. `ingrediente.fornitoreFisso`: le fatture di altri fornitori non cambiano il prezzo.

## File in ingresso (letti in locale)
Fatture FatturaPA .xml/.p7m/.zip (prezzo netto = PrezzoTotale/Quantita; TD04/TD05 ignorate; farine solo Mulino Sobrino; riga più recente / formato più grande), PROPOSTE della GASTRONOMIA .docx → archivio piatti e prezzo al banco, .xlsx con colonne descrizione/prezzo. PDF e foto: li elabora Claude in chat.

## Etichette
`ricetta.etichetta` = id prodotto in `etichette-magiostra-dati/archivio.json`. L'app può creare/aggiornare il testo ingredienti (ordine per peso) con merge su sha.

## Margine reale al banco (v1.4.0, 25/11/2026)
- `calc(r).banco` = {u:'kg'|'pz', lordo, netto, costo, marg, margPct, ric, ipo, diff, diffPct, unita, margTot, rifRic}. €/etto ed €/kg → al kg sul costo pieno €/kg (senza packaging); €/pz ed €/porzione → a pezzo con `confezione` g + packaging. Margine = prezzo al banco senza IVA − costo pieno; % sul prezzo senza IVA.
- Prezzo ipotetico = costo pieno × (1 + `parametri.ricaricoDef`, 70%) × (1 + IVA), sempre al 70% anche se la ricetta ha un ricarico suo (mostrato a parte). Serve solo come confronto: il prezzo al banco lo decide Giovanni.
- `c.ricReale` resta solo per €/etto ed €/kg (colonna M dell'Excel con formula). Le colonne O–T dei Prodotti sono valori scritti dall'app.
- Quadro: tabella "Margine reale al banco" con i prodotti in stato OK, dal margine più basso.
- Pezzatura predefinita 300 g: per i prodotti a €/pz va controllata (Polpette di miglio, Panna cotta, Vegan kebab risultano in perdita o quasi per questo).

## Test automatici (25/11/2026)
- `npm test` (Node 22 + Playwright, Chrome senza finestra; in locale `CHROME_PATH=/percorso/chrome npm test`). Gira anche su GitHub a ogni push (`.github/workflows/test.yml`): X rossa = non pubblicare.
- Solo dati INVENTATI in `tests/fixtures/ricettario-prova.json`: questo repository è pubblico, mai ricette o prezzi veri. I valori attesi del food cost sono calcolati a mano nei commenti del test.
- `tests/fixtures/impronta-foodcost.json`: risultato di `calc()` per ogni ricetta di prova. Se una modifica VOLUTA cambia il food cost, rigenerarla con `AGGIORNA_IMPRONTA=1 npm test` e spiegarlo nel commit.
- Dati veri, prima e dopo una modifica importante: `node tests/confronto-dati-veri.mjs <ricettario.json> tests/locale/prima.json` (cartella ignorata da git) e confrontare i file.
- v1.4.1: `baseCost()` restituisce costo nullo se la base ha prezzi mancanti (`c.manc`) o se le ricette si contengono a vicenda. Prima la ricetta che la usava risultava "OK" con costo sottostimato. Nessuna ricetta vera usava basi: risultati identici sulle 105 ricette e sui 109 fogli Excel.
