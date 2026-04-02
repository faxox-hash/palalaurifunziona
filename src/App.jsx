import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const FALLBACK_VALUE = '-';
const STORAGE_KEY = 'palalaurilab-preview-archive-v1';
const HISTORY_KEY = 'palalaurilab-preview-history-v1';
const LOGO_KEY = 'palalaurilab-preview-logo-v1';

const archive = {
  meta: {
    archiveVersion: 'v10-stable-folder-import',
    lastUpdated: '2026-04-02T11:11:56',
    totalRows: 0,
    totalDocuments: 0,
    note: 'Base stabile per archivio fatture reale con ricerca, lista consultabile, apertura manuale e import da cartella PDF.'
  },
  items: []
};

function safeValue(value) {
  return value || FALLBACK_VALUE;
}

function formatDate(dateString) {
  if (!dateString) return FALLBACK_VALUE;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('it-IT').format(date);
}

function formatDateTime(dateString) {
  if (!dateString) return FALLBACK_VALUE;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('it-IT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function statusLabel(status) {
  switch (status) {
    case 'da_verificare':
      return 'Da verificare';
    case 'verificato':
      return 'Verificato';
    case 'completato':
      return 'Completato';
    default:
      return FALLBACK_VALUE;
  }
}

function priorityLabel(priority) {
  switch (priority) {
    case 'alta':
      return 'Alta';
    case 'media':
      return 'Media';
    case 'bassa':
      return 'Bassa';
    default:
      return FALLBACK_VALUE;
  }
}

function sourceLabel(sourceType) {
  switch (sourceType) {
    case 'pdf+xml':
      return 'PDF + XML';
    case 'pdf':
      return 'PDF';
    case 'html':
      return 'HTML';
    case 'xml':
      return 'XML';
    default:
      return safeValue(sourceType);
  }
}

function normalizeCodeInput(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function createDocumentHash(filename, size) {
  return `doc-${String(filename || '').replace(/\W+/g, '-').toLowerCase()}-${size || 0}`;
}

function documentPreviewUrl(item) {
  if (!item) return null;
  return item.pdf || item.html || item.xml || null;
}

function documentKindLabel(item) {
  if (!item) return 'Apri';
  if (item.pdf) return 'PDF';
  if (item.html) return 'HTML';
  if (item.xml) return 'XML';
  return 'Apri';
}

function runSelfChecks() {
  console.assert(normalizeCodeInput(' ab-12 cd ') === 'AB12CD', 'normalizeCodeInput failed');
  console.assert(createDocumentHash('Test File.pdf', 100) === 'doc-test-file-pdf-100', 'createDocumentHash failed');
  console.assert(statusLabel('verificato') === 'Verificato', 'statusLabel failed');
  console.assert(priorityLabel('alta') === 'Alta', 'priorityLabel failed');
}

runSelfChecks();

function Field({ label, children, hint }) {
  return (
    <label className="field">
      <div className="field-head">
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </div>
      {children}
    </label>
  );
}

function InfoCard({ label, value, compact = false }) {
  return (
    <div className={`info-card ${compact ? 'compact' : ''}`}>
      <div className="info-label">{label}</div>
      <div className="info-value">{safeValue(value)}</div>
    </div>
  );
}

function MetricCard({ label, value, caption }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-caption">{caption}</div>
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◎</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function Header({ currentSection, onNavigate, logoSrc, onLogoChange, onImportPdfFolder }) {
  return (
    <header className="topbar">
      <div className="brand-wrap">
        <div className="brand-logo image-logo-wrap">
          {logoSrc ? <img src={logoSrc} alt="Logo PalaLauriLab" className="brand-image" /> : <span>PL</span>}
        </div>
        <div>
          <p className="eyebrow">PalaLauriLab</p>
          <h1 className="brand-title">Archivio fatture</h1>
        </div>
      </div>

      <div className="top-actions-wrap">
        <label className="btn btn-soft">
          Carica logo
          <input className="hidden-input" type="file" accept="image/*" onChange={onLogoChange} />
        </label>
        <label className="btn btn-secondary">
          Importa cartella PDF
          <input
            className="hidden-input"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={onImportPdfFolder}
            webkitdirectory=""
            directory=""
          />
        </label>
        <nav className="top-nav">
          <button className={`nav-chip ${currentSection === 'dashboard' ? 'active' : ''}`} onClick={() => onNavigate('dashboard')}>
            Dashboard
          </button>
          <button className={`nav-chip ${currentSection === 'archive' ? 'active' : ''}`} onClick={() => onNavigate('archive')}>
            Archivio
          </button>
          <button className={`nav-chip ${currentSection === 'codes' ? 'active' : ''}`} onClick={() => onNavigate('codes')}>
            Codici
          </button>
        </nav>
      </div>
    </header>
  );
}

function EmbeddedViewer({ item }) {
  const url = documentPreviewUrl(item);

  if (!item) {
    return <EmptyState title="Nessun documento selezionato" text="Scegli una fattura dalla lista e premi Apri per visualizzarla qui." />;
  }

  if (!url) {
    return <EmptyState title="Nessun file collegato" text="Questo record non ha ancora un PDF, XML o HTML associato." />;
  }

  return (
    <div className="viewer-shell">
      <div className="viewer-toolbar">
        <div>
          <div className="section-kicker">Anteprima documento</div>
          <h3>{safeValue(item.filename)}</h3>
          <p className="mini-note viewer-url">{url}</p>
        </div>
        <a className="btn btn-primary" href={url} target="_blank" rel="noreferrer">
          Apri file
        </a>
      </div>
      <div className="viewer-stage">
        <iframe title={item.filename || item.id} src={url} className="viewer-frame" />
      </div>
    </div>
  );
}

function StyleBlock() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      :root {
        --panel: rgba(12, 24, 39, 0.78);
        --line: rgba(255,255,255,0.09);
        --text: #ebf3fb;
        --muted: #9bb0c3;
        --shadow: 0 24px 80px rgba(0,0,0,.28);
      }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(22,119,255,.20), transparent 28%),
          radial-gradient(circle at top right, rgba(255,156,71,.16), transparent 24%),
          linear-gradient(180deg, #07111b 0%, #0a1726 40%, #0d1828 100%);
        color: var(--text);
      }
      button, input, select, textarea { font: inherit; }
      .page-shell { min-height: 100vh; }
      .page-container { max-width: 1780px; margin: 0 auto; padding: 24px 18px 40px; }
      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 18px;
        margin-bottom: 24px;
        flex-wrap: wrap;
      }
      .brand-wrap { display: flex; align-items: center; gap: 16px; }
      .brand-logo {
        width: 64px;
        height: 64px;
        border-radius: 20px;
        display: grid;
        place-items: center;
        font-weight: 900;
        color: white;
        background: linear-gradient(135deg, #0f7bff, #ff8d32);
        box-shadow: 0 18px 40px rgba(15,123,255,.28);
        overflow: hidden;
      }
      .image-logo-wrap { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.1); }
      .brand-image { width: 100%; height: 100%; object-fit: cover; display: block; }
      .eyebrow {
        margin: 0 0 6px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: .18em;
        color: #7fa0bd;
      }
      .brand-title {
        margin: 0;
        font-size: clamp(1.35rem, 2vw, 2.2rem);
        line-height: 1.05;
        letter-spacing: -0.03em;
      }
      .top-actions-wrap { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .top-nav {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        padding: 8px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255,255,255,.04);
        backdrop-filter: blur(14px);
      }
      .nav-chip {
        min-height: 42px;
        padding: 0 18px;
        border-radius: 999px;
        border: 1px solid transparent;
        background: transparent;
        color: var(--muted);
        font-weight: 700;
        cursor: pointer;
      }
      .nav-chip.active {
        background: linear-gradient(135deg, rgba(77,163,255,.18), rgba(255,156,71,.16));
        color: #fff;
        border-color: rgba(255,255,255,.10);
      }
      .hero {
        display: grid;
        grid-template-columns: 1.4fr .8fr;
        gap: 20px;
        margin-bottom: 22px;
      }
      .hero-card,
      .panel,
      .metric-card,
      .document-card,
      .viewer-shell,
      .sidebar-card,
      .detail-shell,
      .editor-card,
      .correction-card,
      .history-card {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 28px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(16px);
      }
      .hero-card,
      .panel,
      .viewer-shell,
      .sidebar-card,
      .detail-shell,
      .editor-card,
      .correction-card,
      .history-card { padding: 22px; }
      .hero-card h2 {
        margin: 14px 0 10px;
        font-size: clamp(2rem, 3.8vw, 3.4rem);
        line-height: .96;
        letter-spacing: -.05em;
      }
      .hero-card p,
      .panel-subtitle,
      .mini-note,
      .helper-text,
      .empty-state p,
      .viewer-fallback,
      .history-item p {
        color: var(--muted);
        line-height: 1.65;
      }
      .hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.08);
        color: #d5e6f7;
        font-size: 12px;
        font-weight: 700;
      }
      .hero-actions,
      .quick-row,
      .card-actions,
      .editor-actions,
      .import-export-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .hero-actions { margin-top: 20px; }
      .metrics-grid { display: grid; gap: 16px; }
      .metric-card { padding: 22px; }
      .metric-label { color: var(--muted); font-size: 13px; margin-bottom: 8px; }
      .metric-value { font-size: 2rem; font-weight: 900; color: #fff; }
      .metric-caption { margin-top: 8px; color: #7f97ac; font-size: 13px; }
      .dashboard-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) 360px;
        gap: 20px;
        align-items: start;
      }
      .archive-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) 360px;
        gap: 20px;
        align-items: start;
      }
      .archive-main,
      .archive-side,
      .sidebar-grid,
      .history-list,
      .editor-grid,
      .correction-list,
      .documents-list {
        display: grid;
        gap: 14px;
      }
      .codes-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) 360px;
        gap: 20px;
        align-items: start;
      }
      .panel-header,
      .viewer-toolbar,
      .detail-header,
      .correction-top {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 16px;
        margin-bottom: 18px;
        flex-wrap: wrap;
      }
      .panel-title,
      .history-card h3,
      .editor-card h3,
      .viewer-shell h3,
      .detail-shell h2,
      .correction-card h3 {
        margin: 0;
      }
      .section-kicker {
        margin-bottom: 8px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: .14em;
        color: #7ca0c0;
      }
      .filters-grid {
        display: grid;
        grid-template-columns: 1.2fr .8fr .6fr .8fr .8fr;
        gap: 14px;
      }
      .field { display: flex; flex-direction: column; gap: 8px; }
      .field-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }
      .field span { font-size: 13px; font-weight: 700; color: #d8e7f5; }
      .field small { color: #7e93a7; }
      .field input,
      .field select,
      .field textarea {
        width: 100%;
        min-height: 50px;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.05);
        color: #fff;
        padding: 0 15px;
        outline: none;
      }
      .field textarea { min-height: 110px; resize: vertical; padding: 14px 15px; }
      .field input:focus,
      .field select:focus,
      .field textarea:focus {
        border-color: rgba(77,163,255,.72);
        box-shadow: 0 0 0 4px rgba(77,163,255,.14);
      }
      .btn {
        min-height: 46px;
        padding: 0 18px;
        border-radius: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        border: 1px solid transparent;
        font-weight: 800;
        cursor: pointer;
        transition: .18s ease;
        text-decoration: none;
      }
      .btn:hover { transform: translateY(-1px); }
      .btn-primary {
        background: linear-gradient(135deg, #1a7cff, #ff8e34);
        color: #fff;
        box-shadow: 0 16px 30px rgba(18,123,255,.24);
      }
      .btn-secondary { background: rgba(255,255,255,.06); color: #fff; border-color: rgba(255,255,255,.08); }
      .btn-soft { background: rgba(77,163,255,.12); color: #ddebfa; border-color: rgba(77,163,255,.16); }
      .hidden-input { display: none; }
      .results-header-row {
        display: grid;
        grid-template-columns: minmax(280px, 1.5fr) minmax(700px, 3fr) 140px;
        gap: 16px;
        padding: 0 20px 8px;
        color: #8eabc2;
        font-size: 11px;
        letter-spacing: .12em;
        text-transform: uppercase;
      }
      .document-card {
        padding: 18px 20px;
        display: grid;
        grid-template-columns: minmax(280px, 1.5fr) minmax(700px, 3fr) 140px;
        gap: 16px;
        align-items: center;
      }
      .document-title {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
        line-height: 1.3;
      }
      .result-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(120px, 1fr));
        gap: 10px;
      }
      .result-actions-col {
        display: flex;
        justify-content: flex-end;
        align-items: center;
      }
      .info-card {
        background: rgba(255,255,255,.04);
        border: 1px solid rgba(255,255,255,.06);
        border-radius: 18px;
        padding: 14px;
      }
      .info-card.compact { padding: 12px; }
      .info-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: .12em;
        color: #7f97ac;
        margin-bottom: 7px;
      }
      .info-value {
        color: #edf5fd;
        font-weight: 650;
        word-break: break-word;
      }
      .detail-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }
      .empty-state {
        border: 1px dashed rgba(255,255,255,.12);
        border-radius: 24px;
        padding: 34px 20px;
        text-align: center;
        background: rgba(255,255,255,.03);
      }
      .empty-icon {
        width: 54px;
        height: 54px;
        border-radius: 18px;
        display: grid;
        place-items: center;
        margin: 0 auto 14px;
        background: rgba(255,255,255,.05);
        color: #d9e9f7;
      }
      .history-item {
        padding: 14px;
        border-radius: 18px;
        background: rgba(255,255,255,.04);
        border: 1px solid rgba(255,255,255,.06);
      }
      .history-item strong { display: block; margin-bottom: 4px; }
      .history-item time { display: block; color: #89a4ba; font-size: 12px; margin-top: 6px; }
      .viewer-stage {
        min-height: 420px;
        border-radius: 22px;
        border: 1px solid rgba(255,255,255,.08);
        overflow: hidden;
        background: rgba(0,0,0,.12);
      }
      .viewer-frame {
        width: 100%;
        height: 560px;
        border: 0;
        background: #fff;
      }
      .viewer-message {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .viewer-fallback { padding: 28px; text-align: center; }
      .viewer-url { word-break: break-all; }
      .hash-box {
        padding: 16px;
        border-radius: 18px;
        background: rgba(255,255,255,.04);
        border: 1px solid rgba(255,255,255,.06);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
        color: #aac3d8;
      }
      .footer-note {
        margin-top: 22px;
        padding: 16px 18px;
        border-radius: 20px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04);
        color: #a8bfd2;
      }
      @media (max-width: 1500px) {
        .archive-layout,
        .dashboard-grid,
        .codes-layout { grid-template-columns: 1fr; }
      }
      @media (max-width: 1280px) {
        .results-header-row,
        .document-card { grid-template-columns: 1fr; }
        .result-actions-col { justify-content: flex-start; }
      }
      @media (max-width: 1100px) {
        .hero { grid-template-columns: 1fr; }
      }
      @media (max-width: 960px) {
        .filters-grid,
        .result-grid,
        .detail-grid { grid-template-columns: 1fr; }
        .top-actions-wrap { width: 100%; }
      }
    `}</style>
  );
}

export default function PalaLauriLabPreviewEnvironment() {
  const [section, setSection] = useState('dashboard');
  const [selectedResult, setSelectedResult] = useState(null);
  const [previewItem, setPreviewItem] = useState(null);
  const [sortBy, setSortBy] = useState('date_desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [codeSearchTerm, setCodeSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('Tutti');
  const [selectedYear, setSelectedYear] = useState('Tutti');
  const [selectedStatus, setSelectedStatus] = useState('Tutti');
  const [selectedPriority, setSelectedPriority] = useState('Tutti');
  const [items, setItems] = useState(() => {
    if (typeof window === 'undefined') return archive.items || [];
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : archive.items || [];
    } catch {
      return archive.items || [];
    }
  });
  const [history, setHistory] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem(HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [logoSrc, setLogoSrc] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(LOGO_KEY);
    } catch {
      return null;
    }
  });
  const [editorDraft, setEditorDraft] = useState(null);
  const [draftCodes, setDraftCodes] = useState({});
  const [savedMessage, setSavedMessage] = useState('');
  const [persistenceEnabled, setPersistenceEnabled] = useState(true);
  const [bootstrapLoaded, setBootstrapLoaded] = useState(false);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const objectUrlsRef = useRef([]);

  useEffect(() => {
    setDraftCodes(Object.fromEntries(items.map((item) => [item.id, item.code || ''])));
  }, [items]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      setPersistenceEnabled(true);
    } catch {
      setPersistenceEnabled(false);
    }
  }, [items]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
    } catch {
      setPersistenceEnabled(false);
    }
  }, [history]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (logoSrc) {
        window.localStorage.setItem(LOGO_KEY, logoSrc);
      } else {
        window.localStorage.removeItem(LOGO_KEY);
      }
    } catch {
      setPersistenceEnabled(false);
    }
  }, [logoSrc]);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      objectUrlsRef.current = [];
    };
  }, []);

  const loadInitialArchive = useCallback(async () => {
    if (typeof window === 'undefined') return;
    setBootstrapLoading(true);
    try {
      const response = await fetch(`/data/invoices.json?v=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const nextItems = Array.isArray(data?.items) ? data.items : [];
      if (nextItems.length) {
        setItems(nextItems);
        setSavedMessage(`Archivio iniziale caricato: ${nextItems.length} documenti.`);
        setSection('archive');
      } else {
        setSavedMessage('Archivio iniziale disponibile ma senza documenti.');
      }
    } catch {
      setSavedMessage('Archivio iniziale non disponibile. Importa una cartella PDF o un export JSON.');
    } finally {
      setBootstrapLoaded(true);
      setBootstrapLoading(false);
    }
  }, []);

  useEffect(() => {
    if (bootstrapLoaded || typeof window === 'undefined') return;
    if (items.length > 0) {
      setBootstrapLoaded(true);
      return;
    }

    loadInitialArchive();
  }, [bootstrapLoaded, items.length, loadInitialArchive]);

  const suppliers = useMemo(() => {
    const uniqueSuppliers = Array.from(new Set(items.map((item) => item.supplier).filter(Boolean)));
    return ['Tutti', ...uniqueSuppliers.sort((a, b) => a.localeCompare(b, 'it'))];
  }, [items]);

  const years = useMemo(() => {
    const uniqueYears = Array.from(new Set(items.map((item) => String(item.date || '').slice(0, 4)).filter(Boolean)));
    return ['Tutti', ...uniqueYears.sort((a, b) => b.localeCompare(a, 'it'))];
  }, [items]);

  const filteredResults = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const normalizedQ = normalizeCodeInput(searchTerm);

    return items.filter((item) => {
      const normalizedCode = normalizeCodeInput(item.code);
      const matchesSearch =
        !q ||
        String(item.code || '').toLowerCase().includes(q) ||
        (normalizedQ && normalizedCode.includes(normalizedQ)) ||
        String(item.description || '').toLowerCase().includes(q) ||
        String(item.invoice || '').toLowerCase().includes(q) ||
        String(item.supplier || '').toLowerCase().includes(q) ||
        String(item.filename || '').toLowerCase().includes(q);

      const matchesSupplier = selectedSupplier === 'Tutti' || item.supplier === selectedSupplier;
      const matchesYear = selectedYear === 'Tutti' || String(item.date || '').startsWith(selectedYear);
      const matchesStatus = selectedStatus === 'Tutti' || item.status === selectedStatus;
      const matchesPriority = selectedPriority === 'Tutti' || item.priority === selectedPriority;

      return matchesSearch && matchesSupplier && matchesYear && matchesStatus && matchesPriority;
    });
  }, [items, searchTerm, selectedSupplier, selectedYear, selectedStatus, selectedPriority]);

  const sortedResults = useMemo(() => {
    const copy = [...filteredResults];
    if (sortBy === 'date_desc') return copy.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    if (sortBy === 'date_asc') return copy.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
    if (sortBy === 'alpha_asc') return copy.sort((a, b) => String(a.description || '').localeCompare(String(b.description || ''), 'it'));
    if (sortBy === 'alpha_desc') return copy.sort((a, b) => String(b.description || '').localeCompare(String(a.description || ''), 'it'));
    if (sortBy === 'priority') {
      const order = { alta: 0, media: 1, bassa: 2 };
      return copy.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));
    }
    return copy;
  }, [filteredResults, sortBy]);

  const pendingCodes = useMemo(() => items.filter((item) => !item.code), [items]);
  const completionCount = items.filter((item) => item.code).length;
  const highPriorityItems = items.filter((item) => item.priority === 'alta').length;

  function pushHistory(action, item, details = '') {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      action,
      itemId: item?.id || null,
      title: item?.description || item?.filename || 'Record',
      details,
      createdAt: new Date().toISOString()
    };
    setHistory((prev) => [entry, ...prev].slice(0, 50));
  }

  function openRecord(item) {
    setSelectedResult(item);
    setEditorDraft({ ...item });
    setPreviewItem(item);
    setSavedMessage('');
  }

  function updateEditorField(field, value) {
    setEditorDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function syncSelectedRecord(updatedItem) {
    if (selectedResult?.id === updatedItem.id) setSelectedResult(updatedItem);
    if (previewItem?.id === updatedItem.id) setPreviewItem(updatedItem);
    if (editorDraft?.id === updatedItem.id) setEditorDraft(updatedItem);
  }

  function saveEditorDraft() {
    if (!editorDraft) return;
    const updatedItem = {
      ...editorDraft,
      code: normalizeCodeInput(editorDraft.code) || null
    };
    setItems((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
    syncSelectedRecord(updatedItem);
    pushHistory('Modifica scheda', updatedItem, `Stato: ${statusLabel(updatedItem.status)} · Priorità: ${priorityLabel(updatedItem.priority)}`);
    setSavedMessage(`Scheda aggiornata: ${safeValue(updatedItem.description)}`);
  }

  function saveCode(itemId) {
    const item = items.find((row) => row.id === itemId);
    if (!item) return;
    const normalized = normalizeCodeInput(draftCodes[itemId]);
    const updatedItem = {
      ...item,
      code: normalized || null,
      status: normalized ? 'verificato' : 'da_verificare'
    };
    setItems((prev) => prev.map((row) => (row.id === itemId ? updatedItem : row)));
    syncSelectedRecord(updatedItem);
    pushHistory('Salvataggio codice', updatedItem, normalized ? `Nuovo codice: ${normalized}` : 'Codice rimosso');
    setSavedMessage(normalized ? `Codice salvato: ${normalized}` : 'Codice rimosso.');
  }

  function handleLogoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setLogoSrc(String(reader.result || ''));
      setSavedMessage('Logo aggiornato con successo.');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  function importPdfFolder(event) {
    const files = Array.from(event.target.files || []);
    const pdfFiles = files.filter((file) => String(file.name || '').toLowerCase().endsWith('.pdf'));

    if (!pdfFiles.length) {
      setSavedMessage('Nessun PDF trovato nella cartella selezionata.');
      event.target.value = '';
      return;
    }

    const importedAt = new Date().toISOString().slice(0, 10);
    const existingHashes = new Set(items.map((item) => item.documentHash).filter(Boolean));

    const newItems = pdfFiles
      .map((file, index) => {
        const previewUrl = URL.createObjectURL(file);
        const relativePath = file.webkitRelativePath || file.name;
        const baseName = file.name.replace(/\.pdf$/i, '');
        const hash = createDocumentHash(relativePath, file.size);

        if (existingHashes.has(hash)) {
          try {
            URL.revokeObjectURL(previewUrl);
          } catch {}
          return null;
        }

        objectUrlsRef.current.push(previewUrl);
        existingHashes.add(hash);

        return {
          id: `pdf-${Date.now()}-${index}-${Math.random().toString(16).slice(2, 6)}`,
          code: null,
          description: baseName,
          supplier: '',
          invoice: '',
          date: importedAt,
          amount: null,
          type: 'Documento',
          pdf: previewUrl,
          html: null,
          xml: null,
          filename: file.name,
          relativePath,
          sourceType: 'pdf',
          documentHash: hash,
          status: 'da_verificare',
          priority: 'media',
          notes: 'Importato da cartella PDF.'
        };
      })
      .filter(Boolean);

    if (!newItems.length) {
      setSavedMessage('I PDF selezionati erano già presenti in archivio.');
      event.target.value = '';
      return;
    }

    setItems((prev) => [...newItems, ...prev]);
    setSelectedResult(newItems[0]);
    setPreviewItem(newItems[0]);
    setEditorDraft({ ...newItems[0] });
    newItems.forEach((item) => pushHistory('Import cartella PDF', item, `File importato: ${item.relativePath || item.filename}`));
    setSection('archive');
    setSavedMessage(`${newItems.length} PDF importati dalla cartella.`);
    event.target.value = '';
  }

  function exportArchive() {
    if (typeof window === 'undefined') return;
    const payload = {
      exportedAt: new Date().toISOString(),
      archiveVersion: archive.meta.archiveVersion,
      items,
      history,
      logoSrc
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `palalaurilab-archive-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setSavedMessage('Esportazione archivio completata.');
  }

  function importArchive(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const nextItems = Array.isArray(parsed.items) ? parsed.items : [];
        const nextHistory = Array.isArray(parsed.history) ? parsed.history : [];
        setItems(nextItems);
        setHistory(nextHistory);
        setLogoSrc(parsed.logoSrc || null);
        setSelectedResult(null);
        setPreviewItem(null);
        setEditorDraft(null);
        setSavedMessage('Import archivio completato con successo.');
      } catch {
        setSavedMessage('Import non riuscito: file non valido.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  const dashboardContent = (
    <>
      <section className="hero">
        <div className="hero-card">
          <span className="hero-badge">Archivio minimale</span>
          <h2>Cerca la fattura o il codice e scegli tu quale aprire.</h2>
          <p>
            Questa versione è pensata per consultare una lista chiara, filtrare velocemente e aprire solo il record che ti interessa.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => setSection('archive')}>Apri archivio</button>
          </div>
        </div>

        <div className="metrics-grid">
          <MetricCard label="Documenti" value={items.length} caption="Record attualmente in archivio." />
          <MetricCard label="Codici mancanti" value={pendingCodes.length} caption="Documenti da completare." />
          <MetricCard label="Alta priorità" value={highPriorityItems} caption="Elementi da controllare prima." />
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="history-card">
          <div className="panel-header">
            <div>
              <div className="section-kicker">Import export</div>
              <h3>Controllo archivio locale</h3>
              <p className="panel-subtitle">I dati restano nel browser e possono essere esportati o reimportati.</p>
            </div>
          </div>
          <div className="import-export-actions">
            <button className="btn btn-primary" onClick={exportArchive}>Esporta archivio</button>
            <button className="btn btn-soft" onClick={loadInitialArchive}>
              {bootstrapLoading ? 'Caricamento archivio...' : 'Carica archivio esempio'}
            </button>
            <label className="btn btn-secondary">
              Importa archivio
              <input className="hidden-input" type="file" accept="application/json" onChange={importArchive} />
            </label>
            <label className="btn btn-soft">
              Importa cartella PDF
              <input
                className="hidden-input"
                type="file"
                accept="application/pdf,.pdf"
                multiple
                onChange={importPdfFolder}
                webkitdirectory=""
                directory=""
              />
            </label>
          </div>
          <div className="sidebar-grid" style={{ marginTop: 18 }}>
            <InfoCard label="Persistenza locale" value={persistenceEnabled ? 'Attiva' : 'Non disponibile'} />
            <InfoCard label="Storico modifiche" value={history.length} />
            <InfoCard label="Versione archivio" value={archive.meta.archiveVersion} />
          </div>
        </div>

        <aside className="history-card">
          <div className="section-kicker">Cronologia</div>
          <h3>Ultime modifiche</h3>
          <div className="history-list" style={{ marginTop: 16 }}>
            {history.length ? history.slice(0, 5).map((entry) => (
              <div key={entry.id} className="history-item">
                <strong>{entry.action}</strong>
                <p>{entry.title}</p>
                <p>{entry.details}</p>
                <time>{formatDateTime(entry.createdAt)}</time>
              </div>
            )) : <p className="mini-note">Nessuna modifica registrata.</p>}
          </div>
        </aside>
      </section>
    </>
  );

  const filteredCodeItems = useMemo(() => {
    const q = codeSearchTerm.trim().toLowerCase();
    const normalizedQ = normalizeCodeInput(codeSearchTerm);

    if (!q) return items;

    return items.filter((item) => {
      const normalizedCode = normalizeCodeInput(item.code);
      return (
        String(item.code || '').toLowerCase().includes(q) ||
        (normalizedQ && normalizedCode.includes(normalizedQ)) ||
        String(item.description || '').toLowerCase().includes(q) ||
        String(item.invoice || '').toLowerCase().includes(q) ||
        String(item.supplier || '').toLowerCase().includes(q) ||
        String(item.filename || '').toLowerCase().includes(q)
      );
    });
  }, [items, codeSearchTerm]);

  const archiveContent = (
    <section className="archive-layout">
      <div className="archive-main">
        <div className="panel">
          <div className="panel-header">
            <div>
              <div className="section-kicker">Archivio consultabile</div>
              <h2 className="panel-title">Cerca, filtra e apri dalla lista</h2>
              <p className="panel-subtitle">La lista resta consultabile. Apri solo il record che scegli tu.</p>
            </div>
          </div>

          <div className="filters-grid">
            <Field label="Cerca" hint="codice, fattura, file">
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Cerca nell'archivio" />
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
            <Field label="Stato">
              <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="Tutti">Tutti</option>
                <option value="da_verificare">Da verificare</option>
                <option value="verificato">Verificato</option>
                <option value="completato">Completato</option>
              </select>
            </Field>
            <Field label="Priorità">
              <select value={selectedPriority} onChange={(e) => setSelectedPriority(e.target.value)}>
                <option value="Tutti">Tutti</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="bassa">Bassa</option>
              </select>
            </Field>
          </div>

          <div className="quick-row" style={{ marginTop: 14 }}>
            <Field label="Ordina per">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="date_desc">Data più recente</option>
                <option value="date_asc">Data più vecchia</option>
                <option value="alpha_asc">Alfabeto A-Z</option>
                <option value="alpha_desc">Alfabeto Z-A</option>
                <option value="priority">Priorità</option>
              </select>
            </Field>
          </div>

          <div className="results-header-row">
            <div>Documento</div>
            <div>Dati principali</div>
            <div>Apri</div>
          </div>

          <div className="documents-list">
            {sortedResults.length ? (
              sortedResults.map((item) => (
                <article key={item.id} className="document-card">
                  <div>
                    <h3 className="document-title">{safeValue(item.description || item.filename)}</h3>
                  </div>

                  <div className="result-grid">
                    <InfoCard label="Fornitore" value={item.supplier} compact />
                    <InfoCard label="Fattura" value={item.invoice} compact />
                    <InfoCard label="Data" value={formatDate(item.date)} compact />
                    <InfoCard label="Importo" value={item.amount ? `Euro ${item.amount}` : FALLBACK_VALUE} compact />
                    <InfoCard label="Codice" value={item.code} compact />
                  </div>

                  <div className="result-actions-col">
                    <button className="btn btn-primary" onClick={() => openRecord(item)}>
                      Apri {documentKindLabel(item)}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState title="Nessun risultato" text="Prova a cambiare filtri o termine di ricerca." />
            )}
          </div>
        </div>

        <EmbeddedViewer item={previewItem} />
      </div>

      <div className="archive-side">
        <aside className="sidebar-card">
          {selectedResult ? (
            <div className="detail-shell">
              <div className="detail-header">
                <div>
                  <div className="section-kicker">Scheda documento</div>
                  <h2>{safeValue(selectedResult.description || selectedResult.filename)}</h2>
                </div>
              </div>

              <div className="detail-grid">
                <InfoCard label="Codice" value={selectedResult.code} />
                <InfoCard label="Tipo" value={selectedResult.type} />
                <InfoCard label="Fornitore" value={selectedResult.supplier} />
                <InfoCard label="Fattura" value={selectedResult.invoice} />
                <InfoCard label="Data" value={formatDate(selectedResult.date)} />
                <InfoCard label="Importo" value={selectedResult.amount ? `Euro ${selectedResult.amount}` : FALLBACK_VALUE} />
                <InfoCard label="Stato" value={statusLabel(selectedResult.status)} />
                <InfoCard label="Priorità" value={priorityLabel(selectedResult.priority)} />
                <InfoCard label="File origine" value={selectedResult.relativePath || selectedResult.filename} />
                <InfoCard label="Tipo sorgente" value={sourceLabel(selectedResult.sourceType)} />
              </div>

              <p className="mini-note" style={{ marginTop: 16 }}>Hash documento</p>
              <div className="hash-box">{safeValue(selectedResult.documentHash)}</div>
            </div>
          ) : (
            <EmptyState title="Nessun record aperto" text="Usa il pulsante Apri nella lista per visualizzare una fattura." />
          )}
        </aside>

        <aside className="editor-card">
          <div className="section-kicker">Editor scheda</div>
          <h3>Modifica record selezionato</h3>
          {editorDraft ? (
            <div className="editor-grid" style={{ marginTop: 16 }}>
              <Field label="Descrizione">
                <input value={editorDraft.description || ''} onChange={(e) => updateEditorField('description', e.target.value)} />
              </Field>
              <Field label="Codice" hint="normalizzato al salvataggio">
                <input value={editorDraft.code || ''} onChange={(e) => updateEditorField('code', e.target.value)} />
              </Field>
              <Field label="Stato">
                <select value={editorDraft.status || 'da_verificare'} onChange={(e) => updateEditorField('status', e.target.value)}>
                  <option value="da_verificare">Da verificare</option>
                  <option value="verificato">Verificato</option>
                  <option value="completato">Completato</option>
                </select>
              </Field>
              <Field label="Priorità">
                <select value={editorDraft.priority || 'media'} onChange={(e) => updateEditorField('priority', e.target.value)}>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="bassa">Bassa</option>
                </select>
              </Field>
              <Field label="Note operative">
                <textarea value={editorDraft.notes || ''} onChange={(e) => updateEditorField('notes', e.target.value)} />
              </Field>
              <div className="editor-actions">
                <button className="btn btn-primary" onClick={saveEditorDraft}>Salva scheda</button>
              </div>
            </div>
          ) : (
            <p className="mini-note" style={{ marginTop: 16 }}>
              Apri un record dalla lista per modificarne i dati.
            </p>
          )}
        </aside>
      </div>
    </section>
  );

  const codesContent = (
    <section className="codes-layout">
      <div className="panel">
        <div className="panel-header">
          <div>
            <div className="section-kicker">Correzione codici</div>
            <h2 className="panel-title">Assegna o correggi il codice articolo</h2>
            <p className="panel-subtitle">Qui completi solo i codici, senza confondere la consultazione dell'archivio.</p>
          </div>
        </div>

        <div className="correction-list">
          <div className="quick-row">
            <Field label="Cerca codice" hint="ricerca rapida per codice o documento">
              <input
                value={codeSearchTerm}
                onChange={(e) => setCodeSearchTerm(e.target.value)}
                placeholder="Es: AB12CD oppure numero fattura"
              />
            </Field>
          </div>

          {filteredCodeItems.length ? (
            filteredCodeItems.map((item) => {
              const currentDraft = draftCodes[item.id] ?? '';
              return (
                <article key={item.id} className="correction-card">
                  <div className="correction-top">
                    <div>
                      <h3>{safeValue(item.description || item.filename)}</h3>
                      <p className="helper-text">
                        Fornitore: <strong>{safeValue(item.supplier)}</strong> · Fattura: <strong>{safeValue(item.invoice)}</strong> · Stato: <strong>{statusLabel(item.status)}</strong>
                      </p>
                    </div>
                    <div className="card-actions">
                      <button className="btn btn-secondary" onClick={() => openRecord(item)}>
                        Apri record
                      </button>
                    </div>
                  </div>

                  <div className="quick-row">
                    <Field label="Codice articolo" hint="modifica manuale">
                      <input
                        value={currentDraft}
                        onChange={(e) => setDraftCodes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="Inserisci il codice"
                      />
                    </Field>
                    <div className="editor-actions">
                      <button className="btn btn-primary" onClick={() => saveCode(item.id)}>
                        Salva codice
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <EmptyState
              title={items.length ? 'Nessun codice trovato' : 'Archivio vuoto'}
              text={items.length ? 'Prova con un altro termine di ricerca.' : 'Importa una cartella PDF o un archivio JSON per iniziare.'}
            />
          )}
        </div>
      </div>

      <aside className="sidebar-card">
        <div className="section-kicker">Riepilogo</div>
        <h3>Situazione codici</h3>
        <div className="sidebar-grid" style={{ marginTop: 14 }}>
          <InfoCard label="Totale documenti" value={items.length} />
          <InfoCard label="Codici presenti" value={completionCount} />
          <InfoCard label="Codici mancanti" value={pendingCodes.length} />
        </div>
      </aside>
    </section>
  );

  return (
    <div className="page-shell">
      <StyleBlock />
      <div className="page-container">
        <Header
          currentSection={section}
          onNavigate={setSection}
          logoSrc={logoSrc}
          onLogoChange={handleLogoChange}
          onImportPdfFolder={importPdfFolder}
        />

        {savedMessage ? <div className="footer-note" style={{ marginTop: 0, marginBottom: 20 }}>{savedMessage}</div> : null}

        {section === 'dashboard' ? dashboardContent : null}
        {section === 'archive' ? archiveContent : null}
        {section === 'codes' ? codesContent : null}

        <div className="footer-note">
          <strong>Base stabile:</strong> archivio consultabile, ricerca, scelta manuale del record, viewer separato, editor laterale e import diretto da cartella PDF.
        </div>
      </div>
    </div>
  );
}
