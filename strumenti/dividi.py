"""Divide prova/app.js in più file per argomento (operazione una tantum del 25/11/2026).
Il contenuto non cambia: ogni file riceve 'use strict' (che in JavaScript vale file per file) e,
tolta quella riga, i file uniti nell'ordine di caricamento ridanno esattamente l'app.js originale."""
import sys, pathlib
DIR = pathlib.Path(sys.argv[1])
src = (DIR / 'app.js').read_text(encoding='utf8'); righe = src.split('\n')
def riga(m):
    idx = [i for i, r in enumerate(righe) if r.startswith(m)]; assert len(idx) == 1, (m, idx); return idx[0]
S = '/* ===================== '
tagli = [('js/base.js', 0), ('js/dati.js', riga(S + 'STATO')), ('js/foodcost.js', riga(S + 'FOOD COST')),
  ('js/github.js', riga(S + 'GITHUB')), ('js/blocco-e-primo-avvio.js', riga(S + 'BLOCCO')),
  ('js/schermata-quadro.js', riga(S + 'NAVIGAZIONE')), ('js/schermata-ricette.js', riga(S + 'RICETTE')),
  ('js/schermata-ingredienti-archivio-impostazioni.js', riga(S + 'INGREDIENTI')), ('js/cartella-drive.js', riga(S + 'CARTELLA DRIVE')),
  ('js/excel.js', riga(S + 'EXCEL')), ('js/fatture.js', riga(S + 'FATTURE')), ('js/etichette.js', riga(S + 'ETICHETTE')),
  ('js/stampa.js', riga(S + 'STAMPA')), ('js/azioni-e-avvio.js', riga(S + 'AZIONI'))]
assert [t[1] for t in tagli] == sorted(t[1] for t in tagli)
assert "'use strict';" in righe[:6]
(DIR / 'js').mkdir(exist_ok=True); pezzi = []
for k, (nome, da) in enumerate(tagli):
    a = tagli[k + 1][1] if k + 1 < len(tagli) else len(righe)
    testo = '\n'.join(righe[da:a]); pezzi.append(testo)
    (DIR / nome).write_text(("'use strict';\n" if k else '') + testo + '\n', encoding='utf8')
assert '\n'.join(pezzi) == src
(DIR / 'app.js').unlink()
print(' '.join(pathlib.Path(n).stem for n, _ in tagli))
