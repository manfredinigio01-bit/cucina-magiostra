# App Cucina La Magiostra – note per le modifiche

PWA (HTML/CSS/JS vanilla) per ricettario, food cost, prezzi d'acquisto e archivio piatti. Utente: Giovanni. Interfaccia in italiano. Pubblicata con GitHub Pages da `main`, root: https://manfredinigio01-bit.github.io/cucina-magiostra/
Separata dall'app etichette (repo `etichette-magiostra`): fino al 25/11/2026 stava in `etichette-magiostra/cucina/`, spostata qui perché Edge non installava un'app dentro lo scope delle etichette. Lo stesso origin (manfredinigio01-bit.github.io) mantiene IndexedDB: vault e cache restano validi.

## Struttura del codice
- **Dalla 1.5.0 (25/11/2026; versione normale dalla 1.5.1, promossa la sera del 25/11)** il codice è diviso per argomento senza cambiare una riga: `index.html` (2 KB), `stile.css`, e in `js/` nell'ordine di caricamento: `base` (PROVA, costanti, utilità, cifratura, IndexedDB), `dati` (stato, sanitize, merge, accesso), `foodcost` (calc, baseCost), `github`, `blocco-e-primo-avvio`, `schermata-quadro` (render, nav, dialoghi, quadro), `schermata-ricette`, `schermata-ingredienti-archivio-impostazioni`, `cartella-drive`, `excel`, `fatture`, `etichette`, `stampa`, `azioni-e-avvio`. Ogni file inizia con `'use strict'` (vale file per file). **L'ordine conta**: script classici con variabili globali condivise; una funzione è disponibile al caricamento solo per i file successivi. Nuovi file: aggiungerli in `index.html` e nella lista `FILES` di `sw.js`.
- Verifica della divisione: test 19/19, food cost + 109 fogli Excel delle 105 ricette vere identici, 149 schermate con i dati veri identiche (`tests/confronto-schermate.mjs`), primo avvio e funzionamento offline provati in Chrome.
- Fino alla 1.4.2: tutto in `app.js`.

## Pubblicare (dal 25/11/2026: sempre passando dalla versione di PROVA, vedi `PROVA.md`)
1. Modificare SOLO i file in `prova/` (https://manfredinigio01-bit.github.io/cucina-magiostra/prova/). Se non è allineata: `node strumenti/versioni.mjs nuova-prova`.
2. `node strumenti/versioni.mjs alza X.Y.Z "nota"` alza la versione nei tre punti (`APP_VERSION`, `version.json`, numero della `CACHE` in `sw.js`).
3. `APP_DIR=prova npm test`, commit e push; Giovanni prova.
4. Approvato: salvare la versione in uso nel Drive `software` (1-IN-USO → 2-PRECEDENTE → storico), `node strumenti/versioni.mjs promuovi`, `npm test`, commit e push.
- In prova (`PROVA` = percorso con `/prova/`): IndexedDB `prova_cucina-magiostra` e chiavi `prova_cuc_*` (`PFX`), `gh()` blocca ogni richiesta che non sia GET (finta risposta ok + avviso), niente cartella Drive (`dirInit`), fascia `#provabar`, niente manifest. `sw.js` unico: con scope `/prova/` cache `prova-cucina-vN`; quello normale ignora `/prova/`.

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
- Dati veri, prima e dopo una modifica importante: `node tests/confronto-dati-veri.mjs <ricettario.json> tests/locale/prima.json` (food cost + Excel) e `node tests/confronto-schermate.mjs <ricettario.json> tests/locale/schermate.json` (tutte le schermate), cartella ignorata da git; con `APP_DIR=prova` per la prova. Confrontare i file prima/dopo.
- v1.4.1: `baseCost()` restituisce costo nullo se la base ha prezzi mancanti (`c.manc`) o se le ricette si contengono a vicenda. Prima la ricetta che la usava risultava "OK" con costo sottostimato. Nessuna ricetta vera usava basi: risultati identici sulle 105 ricette e sui 109 fogli Excel.

## Etichette: surgelati, composti, semilavorati (1.5.1, 25/11/2026, promossa con le Etichette 0.8.1)
- Ingrediente: `surgelato` (bool), `nomeEtichetta` (nome in etichetta se diverso), `composizione` (ingredienti del prodotto composto, es. margarina; solo per l'etichetta, mai nel ricettario). In `sanitize`.
- `etiRighe(r)` / `etiTesto(r)`: testo ingredienti in ordine di peso; riga base (`ric`) → "nome base (suoi ingredienti)" ricorsivo con protezione dai cicli (dal nome della base si tolgono le parentesi); ingrediente composto → "nome (composizione)"; surgelato → "nome*". `warn` = ingredienti che sembrano composti (`COMPOSTI_PROB`) senza composizione.
- L'asterisco attaccato alla parola è il segno di "surgelato" nell'app etichette dalla PROVA 0.8.1, che aggiunge da sola "*Ingrediente surgelato.". L'app etichette 0.7.1 (normale) legge due asterischi come grassetto: promuovere le due prove insieme.

## Etichette automatiche (1.5.2, 26/11/2026, promossa con le Etichette 0.8.2)
- Prodotto dell'archivio etichette con `fonte:'cucina'` + `ricetta:<id>` = testo ingredienti gestito dalla Cucina. Dopo ogni sincronizzazione riuscita `etiAutoMaybe()` (solo se i testi generati sono cambiati, o ogni 5 min) → `etiAuto()`: rilegge l'archivio etichette, e per ogni prodotto automatico con testo diverso da `etiTesto(r).txt` lo riscrive (`ingAt`=`updatedAt` monotono, `updatedBy` 'App Cucina (automatico)'), un solo commit, merge su sha (`etiApply`). In prova non scrive (toast "avrei aggiornato").
- Si diventa automatici solo per scelta: "Rendi automatica…" nella scheda ricetta (dialogo con testo attuale e testo generato), "Rendile automatiche" nel Quadro per quelle già uguali, oppure etichetta nuova creata dalla Cucina col testo generato. "Rendi manuale" / "Modifica a mano" (app etichette) → `fonte:''`, la Cucina non la tocca più.
- Un prodotto collegato a più ricette non può essere automatico (`etiStato` = 'doppia').
- Nella `composizione` degli ingredienti gli asterischi (sulle confezioni = biologico) vengono tolti dal testo dell'etichetta, con avviso nella scheda.
- 26/11 sui dati veri: 31 ricette collegate, solo 1 con testo identico (Insalata russa); le altre vanno riviste una per una.

## Comodità (1.5.3, 26/11/2026, promossa con la 1.5.4)
- Aggiornamenti: `checkUpdate()` gira all'apertura (anche sulla schermata della password), ogni 5 minuti e quando l'app torna in primo piano; mostra la barra gialla `#updbar` in cima ("Aggiorna ora"). Prima era un pulsantino nell'intestazione aggiunto solo dopo lo sblocco.
- "Ricorda questo computer per 30 giorni" (casella nella schermata della password, scelta di Giovanni per il suo Mac): la `CryptoKey` (non esportabile) va in IndexedDB `ricorda` {key, scade}; all'avvio `ricordaApri()` apre senza password; con `RICORDATO` il blocco dopo 30 minuti non scatta. "Dimentica questo computer" in Impostazioni → Sicurezza. Cambio password: la chiave ricordata viene aggiornata. Scollega: cancellata. Chi usa quel computer con quell'account apre la Cucina: da NON attivare sui PC del negozio.
- Collegare un'etichetta: niente più menu a tendina; `etiPicker`/`etiCerca` = campo di ricerca (tutte le parole, accenti ignorati) con risultati scorrevoli, Invio sceglie il primo; senza testo prima quelle col nome più simile alla ricetta; segnala "già collegata a…". Pulsanti Cambia / Scollega.

## Interfaccia (1.5.4, 26/11/2026, dopo revisione UI; promossa il 26/11 con le Etichette 0.8.3)
- Menu: `nav button{flex:0 0 auto}` (con `*{min-width:0}` le voci si schiacciavano e si sovrapponevano sotto i 700 px).
- Modifica ricetta: barra `.savebar` fissa in basso (Salva/Annulla); su telefono `.card:has(.savebar){overflow:visible}` altrimenti lo sticky non funziona.
- Telefono: colonne `.hm` nascoste (€/unità, Fornitore nella scheda; Costo pieno, Ipotetico, Ricarico reale nel Quadro); pulsanti ≥40 px.
- Contrasto: `--w` #8a5600 (era #a86b00, 3,85:1); sottotitoli della voce selezionata più scuri.
- Tastiera: `:focus-visible` blu; in `afterRender` le voci cliccabili non-pulsante (data-ric/ing/go/filt) ricevono tabindex+role=button e si aprono con Invio/Spazio; campi delle tabelle con aria-label dalla colonna; ricerca con aria-label; ✕ con aria-label.
- Campi allineati in basso (`label.f{justify-content:flex-end}`); "Prezzo al banco" e "Unità prezzo" sulla stessa riga.
- Verificato a 375/768/800/1280/1366/1536@125%/1920: niente scorrimento laterale, barra Salva visibile a metà modulo, Tab+Invio apre le ricette.

## Etichette senza ricetta e modifiche nelle Etichette (PROVA 1.5.5, 27/11/2026)
- Regola concordata con Giovanni: ogni informazione ha un solo padrone. L'app Etichette comanda su nome, prezzo, peso, conservazione, diciture; la Cucina su dosi, costi e (solo per le etichette automatiche) sul testo ingredienti. Le Etichette NON accedono al ricettario (lo staff non deve vedere costi): il collegamento etichetta↔ricetta si fa solo dalla Cucina.
- Quadro, in cima: `etiModCard()` "Modifiche nelle Etichette" = differenze tra l'archivio etichette di adesso e la foto salvata su questo computer (`localStorage` `cuc_eti_foto`, campi `ETI_CAMPI`), escluse le modifiche con `updatedBy` "App Cucina…"; `etiDiff()` mostra solo il pezzo cambiato; "Segna tutte come viste" = nuova foto. Prima volta su un computer: foto senza avvisi. Avviso (toast) all'apertura (`etiModAvviso`).
- `etiNoRicCard()` "Etichette senza ricetta": prodotti non collegati a nessuna ricetta; Collega (`etiNoRicLinkDlg`, ricerca `#ricq`), Crea ricetta (`etiNoRicNew`: ricetta nuova in modifica con nome, prezzo al banco €/kg o €/pz e collegamento; ingredienti dell'etichetta nelle note), Non serve (`S.etiNoRic` [{id,updatedAt,deleted}], in `sanitize` e `merge`, sincronizzato). "nuova" = mai vista su questo computer (`cuc_eti_viste`), avviso all'apertura.
- `etiAuto`: dopo l'aggiornamento automatico delle etichette ricorda di rietichettare le confezioni già in banco.
- Verifica 27/11 sui dati veri (106 ricette, 90 etichette, 32 collegate): 16 controlli ok (`tests/locale/prova-etinoric.mjs`, fuori da git), food cost ed Excel identici tra normale e prova, npm test 19/19.
