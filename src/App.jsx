import { useEffect, useMemo, useState } from 'react';

const emptyArchive = {
  meta: {
    archiveVersion: 'v2-ready',
    lastUpdated: null,
    totalRows: 0,
    totalDocuments: 0,
    suppliers: [],
    years: [],
    duplicatesSkipped: 0,
    note: 'Archivio vuoto. Carica i documenti in input_documents e lancia lo script di indicizzazione.'
  },
  items: []
};

function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('it-IT').format(date);
}

function App() {
  const [archive, setArchive] = useState(emptyArchive);
  const [view, setView] = useState('home');
  const [selectedResult, setSelectedResult] = useState(null);
  const [sortBy, setSortBy] = useState('date_desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('Tutti');
  const [selectedYear, setSelectedYear] = useState('Tutti');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  async function loadArchive({ showRefreshing = false } = {}) {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await fetch(`/data/invoices.json?v=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setArchive(data?.items ? data : emptyArchive);
      setLoadError('');
    } catch (error) {
      setArchive(emptyArchive);
      setLoadError('Archivio non disponibile o non ancora indicizzato.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadArchive();
  }, []);

  const results = archive.items ?? [];

  const suppliers = useMemo(
    () => ['Tutti', ...Array.from(new Set(results.map((item) => item.supplier).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'it'))],
    [results]
  );

  const years = useMemo(
    () => ['Tutti', ...Array.from(new Set(results.map((item) => String(item.date || '').slice(0, 4)).filter(Boolean))).sort((a, b) => b.localeCompare(a, 'it'))],
    [results]
  );

  const filteredResults = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return results.filter((item) => {
      const matchesSearch =
        !q ||
        String(item.code || '').toLowerCase().includes(q) ||
        String(item.description || '').toLowerCase().includes(q) ||
        String(item.invoice || '').toLowerCase().includes(q) ||
        String(item.supplier || '').toLowerCase().includes(q) ||
        String(item.filename || '').toLowerCase().includes(q);

      const matchesSupplier = selectedSupplier === 'Tutti' || item.supplier === selectedSupplier;
      const matchesYear = selectedYear === 'Tutti' || String(item.date || '').startsWith(selectedYear);

      return matchesSearch && matchesSupplier && matchesYear;
    });
  }, [results, searchTerm, selectedSupplier, selectedYear]);

  const sortedResults = useMemo(() => {
    const copy = [...filteredResults];

    if (sortBy === 'date_desc') return copy.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    if (sortBy === 'date_asc') return copy.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    if (sortBy === 'alpha_asc') return copy.sort((a, b) => String(a.description || '').localeCompare(String(b.description || ''), 'it'));
    return copy.sort((a, b) => String(b.description || '').localeCompare(String(a.description || ''), 'it'));
  }, [filteredResults, sortBy]);

  function openResultDetails(item) {
    setSelectedResult(item);
    setView('detail');
  }

  function Header() {
    return (
      <header className="topbar">
        <div className="brand-wrap">
          <img src="/assets/logo-palalaurilab.jpeg" alt="PalaLauriLab" className="brand-logo" />
          <div>
            <p className="eyebrow">PalaLauriLab</p>
            <h1 className="brand-title">Analisi fatture e archivio documentale</h1>
          </div>
        </div>
        <div className="tag">Archivio reale aggiornabile</div>
      </header>
    );
  }

  if (view === 'detail' && selectedResult) {
    return (
      <div className="page-shell">
        <div className="page-container">
          <Header />
          <section className="section-card detail-card">
            <div className="detail-top">
              <div>
                <div className="pill-row">
                  <span className="pill pill-blue">{selectedResult.code || 'Senza codice'}</span>
                  <span className="pill pill-orange">{selectedResult.type || 'Documento'}</span>
                </div>
                <h2 className="detail-title">{selectedResult.description || selectedResult.filename || 'Documento'}</h2>
              </div>
              <button className="btn btn-light" onClick={() => setView('results')}>Torna ai risultati</button>
            </div>

            <div className="grid two-cols">
              <InfoCard label="Fornitore" value={selectedResult.supplier} />
              <InfoCard label="Numero fattura" value={selectedResult.invoice} />
              <InfoCard label="Data" value={formatDate(selectedResult.date)} />
              <InfoCard label="Importo" value={selectedResult.amount ? `€ ${selectedResult.amount}` : '—'} />
              <InfoCard label="Quantità" value={selectedResult.quantity ?? '—'} />
              <InfoCard label="Prezzo unitario" value={selectedResult.unitPrice ? `€ ${selectedResult.unitPrice}` : '—'} />
            </div>

            <div className="note-box">
              <strong>Origine:</strong> {selectedResult.filename || '—'}<br />
              <strong>Tipo sorgente:</strong> {selectedResult.sourceType || '—'}<br />
              <strong>Hash documento:</strong> <span className="mono">{selectedResult.documentHash || '—'}</span>
            </div>

            <div className="action-row">
              <a className={`btn btn-light ${!selectedResult.pdf ? 'disabled' : ''}`} href={selectedResult.pdf || '#'} target="_blank" rel="noreferrer">
                Apri PDF
              </a>
              <a className={`btn btn-primary ${!selectedResult.pdf ? 'disabled' : ''}`} href={selectedResult.pdf || '#'} target="_blank" rel="noreferrer">
                Apri fattura completa
              </a>
              {selectedResult.xml ? (
                <a className="btn btn-outline" href={selectedResult.xml} target="_blank" rel="noreferrer">Apri XML</a>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (view === 'results') {
    return (
      <div className="page-shell">
        <div className="page-container">
          <Header />

          <section className="section-card filters-card">
            <div className="grid search-grid">
              <Field label="Cerca">
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Codice, descrizione, fattura o fornitore" />
              </Field>
              <Field label="Fornitore">
                <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)}>
                  {suppliers.map((supplier) => <option key={supplier}>{supplier}</option>)}
                </select>
              </Field>
              <Field label="Anno">
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                  {years.map((year) => <option key={year}>{year}</option>)}
                </select>
              </Field>
            </div>
          </section>

          <section className="section-card results-toolbar">
            <div>
              <p className="toolbar-label">Archivio filtrato</p>
              <p className="toolbar-subtitle">{sortedResults.length} risultati trovati</p>
            </div>
            <div className="toolbar-actions">
              <Field label="Ordina per">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="date_desc">Data più recente</option>
                  <option value="date_asc">Data più vecchia</option>
                  <option value="alpha_asc">Alfabeto A-Z</option>
                  <option value="alpha_desc">Alfabeto Z-A</option>
                </select>
              </Field>
              <button className="btn btn-light" onClick={() => loadArchive({ showRefreshing: true })}>
                {refreshing ? 'Aggiornamento...' : 'Aggiorna archivio'}
              </button>
            </div>
          </section>

          {sortedResults.length === 0 ? <EmptyState loadError={loadError} /> : null}

          <div className="results-list">
            {sortedResults.map((item) => (
              <article key={item.id} className="result-card">
                <div className="result-main">
                  <div className="pill-row">
                    <span className="pill pill-blue">{item.code || 'Senza codice'}</span>
                    <span className="pill pill-orange">{item.type || 'Documento'}</span>
                  </div>
                  <h3 className="result-title">{item.description || item.filename || 'Documento'}</h3>
                  <div className="grid result-grid">
                    <InfoCard label="Fornitore" value={item.supplier} compact />
                    <InfoCard label="Fattura" value={item.invoice} compact />
                    <InfoCard label="Data" value={formatDate(item.date)} compact />
                    <InfoCard label="Importo" value={item.amount ? `€ ${item.amount}` : '—'} compact />
                  </div>
                </div>
                <div className="result-actions">
                  <a className={`btn btn-light ${!item.pdf ? 'disabled' : ''}`} href={item.pdf || '#'} target="_blank" rel="noreferrer">Apri PDF</a>
                  <button className="btn btn-primary" onClick={() => openResultDetails(item)}>Dettaglio</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-container">
        <Header />

        <section className="hero-layout">
          <div className="hero-card">
            <span className="hero-badge">Versione pronta per indicizzazione</span>
            <h2>Archivio fatture PalaLauriLab</h2>
            <p>
              Questa versione è già predisposta per leggere un archivio generato automaticamente. Carica i documenti nella cartella
              <strong> input_documents</strong>, esegui lo script locale di indicizzazione e pubblica il progetto aggiornato.
            </p>
          </div>

          <div className="stats-column">
            <StatCard label="Righe indicizzate" value={archive.meta?.totalRows ?? 0} />
            <StatCard label="Documenti" value={archive.meta?.totalDocuments ?? 0} />
            <StatCard label="Versione archivio" value={archive.meta?.archiveVersion || 'v2-ready'} />
          </div>
        </section>

        <section className="section-card home-search-card">
          <div className="grid search-grid">
            <Field label="Cerca nell'archivio">
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Codice, descrizione, fattura o fornitore" />
            </Field>
            <Field label="Fornitore">
              <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)}>
                {suppliers.map((supplier) => <option key={supplier}>{supplier}</option>)}
              </select>
            </Field>
            <Field label="Anno">
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                {years.map((year) => <option key={year}>{year}</option>)}
              </select>
            </Field>
          </div>

          <div className="home-actions">
            <button className="btn btn-light" onClick={() => loadArchive({ showRefreshing: true })}>
              {refreshing ? 'Aggiornamento...' : 'Aggiorna archivio'}
            </button>
            <button className="btn btn-primary" onClick={() => setView('results')}>Vai ai risultati</button>
          </div>

          <p className="archive-note">
            {loadError || archive.meta?.note || 'Archivio pronto.'}
            <br />
            Ultima indicizzazione: <strong>{archive.meta?.lastUpdated ? new Date(archive.meta.lastUpdated).toLocaleString('it-IT') : 'mai eseguita'}</strong>
          </p>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function InfoCard({ label, value, compact = false }) {
  return (
    <div className={`info-card ${compact ? 'compact' : ''}`}>
      <div className="info-label">{label}</div>
      <div className="info-value">{value || '—'}</div>
    </div>
  );
}

function EmptyState({ loadError }) {
  return (
    <section className="section-card empty-state">
      <h3>Nessun risultato disponibile</h3>
      <p>
        {loadError || 'L’archivio è vuoto oppure i filtri escludono tutti i documenti. Esegui prima l’indicizzazione locale.'}
      </p>
    </section>
  );
}

export default App;
