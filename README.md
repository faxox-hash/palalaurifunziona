# PalaLauriLab - versione pronta per indicizzazione

Questa versione è pensata per il flusso reale che hai richiesto:

1. copi i documenti nella cartella `input_documents`
2. lanci l'indicizzazione locale
3. il programma genera da solo `public/data/invoices.json`
4. il programma copia i documenti pubblicabili in `public/invoices`
5. pubblichi o aggiorni il progetto online

## Cosa fa già

- interfaccia web con logo e colori PalaLauriLab
- ricerca per codice, descrizione, fornitore e numero fattura
- ordinamento per data e alfabeto
- dettaglio documento
- apertura PDF e XML quando presenti
- indicizzazione automatica di XML e PDF
- gestione base dei doppioni tramite hash documento

## Cartelle importanti

- `input_documents/` → qui metti i file da indicizzare
- `public/invoices/` → qui finiscono i documenti pubblicabili
- `public/data/invoices.json` → archivio generato automaticamente
- `scripts/build_archive.py` → motore di indicizzazione
- `scripts/run_indexing.bat` → avvio rapido su Windows

## Avvio web locale

```bash
npm install
npm run dev
```

## Build per pubblicazione

```bash
npm install
npm run build
```

## Indicizzazione automatica

### Metodo rapido Windows

Fai doppio clic su:

```text
scripts\run_indexing.bat
```

### Metodo manuale

```bash
pip install -r requirements.txt
python scripts/build_archive.py
```

## Come funziona l'indicizzazione

- se trova un file XML FatturaPA, legge fornitore, numero, data, importo e righe documento
- se trova solo il PDF, prova a leggere testo base e crea almeno una riga documento
- se trova PDF e XML con lo stesso nome base, li collega insieme
- salta i doppioni in base all'hash del documento sorgente

## Limiti attuali della versione

- l'indicizzazione viene eseguita **in locale**, non direttamente da Vercel
- i PDF senza testo leggibile possono richiedere regole aggiuntive o OCR futuro
- i campi estratti dai PDF sono base; gli XML sono molto più affidabili

## Flusso consigliato reale

1. metti PDF/XML in `input_documents`
2. esegui `scripts\run_indexing.bat`
3. controlla `public/data/invoices.json`
4. pubblica il progetto aggiornato su GitHub/Vercel
5. online premi `Aggiorna archivio` per ricaricare il JSON pubblicato

## Prossimo passo consigliato

Quando questa base ti va bene, il passo successivo naturale è aggiungere:

- regole personalizzate fornitori
- anti-doppione più evoluto
- lettura più accurata dei PDF italiani
- collegamento diretto con il tuo archivio fatture del gestionale
