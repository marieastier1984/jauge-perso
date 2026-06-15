const { useState, useMemo, useEffect } = React;

// --- Data model -----------------------------------------------------------

const LEVELS = ["vert", "jaune", "orange", "rouge"];

const LEVEL_LABELS = {
  vert:   { name: "Vert — équilibre", short: "Tout va bien" },
  jaune:  { name: "Jaune — préserver", short: "Premiers signes de déconnexion" },
  orange: { name: "Orange — recharger", short: "Activation forte, dette qui s'installe" },
  rouge:  { name: "Rouge — limiter les dégâts", short: "La capacité de compensation est dépassée" },
};

const STAR_LEVELS = { 3: "⭐⭐⭐", 2: "⭐⭐", 1: "⭐" };

const SUGGESTION_FRAMING = {
  vert: {
    title: "Continue comme ça",
    question: "Rien à ajuster pour l'instant.",
  },
  jaune: {
    title: "Préserver — dépenser un peu moins d'énergie",
    question: "Qu'est-ce que je peux faire pour dépenser un peu moins d'énergie pendant les 2 prochaines heures ?",
  },
  orange: {
    title: "Recharger — vraiment, pas juste faire une pause",
    question: "Qu'est-ce qui recharge vraiment mes batteries, là, maintenant ?",
  },
  rouge: {
    title: "Limiter les dégâts",
    question: "Comment je me soigne et je récupère, maintenant ?",
  },
};

const VERT_TIPS = [
  "Profite de cette marge : c'est le bon moment pour les choses qui demandent de l'énergie.",
  "Repère ce qui te fait du bien aujourd'hui — ça aide à le reconnaître plus tard.",
];

const LEVEL_INDEX = { vert: 0, jaune: 1, orange: 2, rouge: 3 };
const LEVEL_FILL = { vert: 100, jaune: 68, orange: 38, rouge: 12 };
const LEVEL_MARKER = { vert: 84, jaune: 53, orange: 25, rouge: 6 };

function computeOverallLevel(selectedSignals) {
  if (selectedSignals.length === 0) return "vert";
  let maxIdx = 0;
  selectedSignals.forEach(s => {
    const idx = LEVEL_INDEX[s.level];
    if (idx > maxIdx) maxIdx = idx;
  });
  if (maxIdx > 0 && maxIdx < 3) {
    const countAtMax = selectedSignals.filter(s => LEVEL_INDEX[s.level] === maxIdx).length;
    if (countAtMax >= 3) {
      maxIdx = Math.min(maxIdx + 1, 3);
    }
  }
  return LEVELS[maxIdx];
}

async function apiGetSuggestions() {
  const res = await fetch("/api/suggestions");
  if (!res.ok) throw new Error("Échec du chargement des suggestions");
  return res.json();
}

async function apiGetSignals() {
  const res = await fetch("/api/signals");
  if (!res.ok) throw new Error("Échec du chargement des signaux");
  const data = await res.json();
  // Normalize 'niveau' (DB) -> 'level' (front-end naming)
  return (data.signals || []).map(s => ({
    id: s.id,
    label: s.label,
    level: s.niveau,
    star: s.star || undefined,
    custom: !!s.custom,
  }));
}

async function apiAddSignal(niveau, label) {
  const res = await fetch("/api/signals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ niveau, label }),
  });
  if (!res.ok) throw new Error("Échec de l'ajout du signal");
  const data = await res.json();
  const s = data.signal;
  return { id: s.id, label: s.label, level: s.niveau, star: s.star || undefined, custom: !!s.custom };
}

async function apiDeleteSignal(id) {
  const res = await fetch(`/api/signals?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Échec de la suppression du signal");
}

async function apiGetTriggers() {
  const res = await fetch("/api/triggers");
  if (!res.ok) throw new Error("Échec du chargement des facteurs déclencheurs");
  const data = await res.json();
  return data.triggers || [];
}

async function apiAddTrigger(label) {
  const res = await fetch("/api/triggers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  if (!res.ok) throw new Error("Échec de l'ajout du facteur déclencheur");
  const data = await res.json();
  return data.trigger;
}

async function apiDeleteTrigger(id) {
  const res = await fetch(`/api/triggers?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Échec de la suppression du facteur déclencheur");
}

async function apiGetHistory() {
  const res = await fetch("/api/history");
  if (!res.ok) throw new Error("Échec du chargement de l'historique");
  const data = await res.json();
  return data.history || [];
}

async function apiAddHistory(niveau, signaux, triggers) {
  const res = await fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ niveau, signaux, triggers }),
  });
  if (!res.ok) throw new Error("Échec de l'enregistrement");
  const data = await res.json();
  return data.entry;
}

async function apiDeleteHistory(id) {
  const res = await fetch(`/api/history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Échec de la suppression");
}

async function apiClearHistory() {
  const res = await fetch("/api/history?all=true", { method: "DELETE" });
  if (!res.ok) throw new Error("Échec de l'effacement");
}

async function apiClassify(text) {
  const res = await fetch("/api/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signal: text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Échec de la classification");
  }
  return res.json();
}

function formatDateTime(iso) {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timePart = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const str = String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportJSON(history) {
  const content = JSON.stringify(history, null, 2);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(`jauge-historique-${stamp}.json`, content, "application/json");
}

function exportCSV(history) {
  const rows = [["date", "niveau", "signaux", "triggers"]];
  history.forEach(entry => {
    rows.push([
      entry.created_at,
      entry.niveau,
      (entry.signaux || []).join(" | "),
      (entry.triggers || []).join(" | "),
    ]);
  });
  const content = rows.map(row => row.map(csvEscape).join(";")).join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  downloadFile(`jauge-historique-${stamp}.csv`, "\uFEFF" + content, "text/csv;charset=utf-8");
}

// --- Components --------------------------------------------------------------

function Jauge({ level, selectedCount }) {
  const fill = LEVEL_FILL[level];
  const markerBottom = LEVEL_MARKER[level];
  return (
    <section className="jauge-section">
      <div className="jauge-track">
        <div className="jauge-mask" style={{ height: `${100 - fill}%` }} />
        <div className="jauge-marker" style={{ bottom: `${markerBottom}%` }} />
      </div>
      <div className="jauge-info">
        <div className={`jauge-level display level-${level}`}>{LEVEL_LABELS[level].name}</div>
        <div className="jauge-sub">
          {selectedCount === 0
            ? "Aucun signal sélectionné — coche ce que tu remarques en ce moment."
            : LEVEL_LABELS[level].short}
        </div>
      </div>
    </section>
  );
}

function SignalSection({ level, signals, selectedIds, onToggle, onAdd, onDelete }) {
  const [draft, setDraft] = useState("");
  const selectedCount = signals.filter(s => selectedIds.has(s.id)).length;

  const handleAdd = () => {
    const text = draft.trim();
    if (!text) return;
    onAdd(level, text);
    setDraft("");
  };

  return (
    <div className="section">
      <div className="section-head">
        <h2><span className={`dot dot-${level}`} />{LEVEL_LABELS[level].name}</h2>
        <span className="count-pill">{selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}</span>
      </div>
      <div className="chip-grid">
        {signals.map(s => (
          <button
            key={s.id}
            className={`chip cat-${level} ${selectedIds.has(s.id) ? "selected" : ""}`}
            onClick={() => onToggle(s.id)}
            aria-pressed={selectedIds.has(s.id)}
          >
            {s.label}
            {s.star ? <span className="chip-star">{STAR_LEVELS[s.star]}</span> : null}
            {s.custom ? (
              <span
                className="chip-del"
                onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                role="button"
                aria-label={`Supprimer ${s.label}`}
              >✕</span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="add-row">
        <input
          type="text"
          placeholder="Ajouter un signal personnel…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
        />
        <button onClick={handleAdd}>Ajouter</button>
      </div>
    </div>
  );
}

function TriggersSection({ triggers, selectedIds, onToggle, onAdd, onDelete }) {
  const [draft, setDraft] = useState("");
  const selectedCount = triggers.filter(t => selectedIds.has(t.id)).length;

  const handleAdd = () => {
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft("");
  };

  return (
    <div className="section">
      <div className="section-head">
        <h2>Facteurs déclencheurs probables</h2>
        <span className="count-pill">{selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}</span>
      </div>
      <div className="chip-grid">
        {triggers.map(t => (
          <button
            key={t.id}
            className={`chip cat-trigger ${selectedIds.has(t.id) ? "selected" : ""}`}
            onClick={() => onToggle(t.id)}
            aria-pressed={selectedIds.has(t.id)}
          >
            {t.label}
            {t.custom ? (
              <span
                className="chip-del"
                onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                role="button"
                aria-label={`Supprimer ${t.label}`}
              >✕</span>
            ) : null}
          </button>
        ))}
      </div>
      <div className="add-row">
        <input
          type="text"
          placeholder="Ajouter un facteur déclencheur…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
        />
        <button onClick={handleAdd}>Ajouter</button>
      </div>
    </div>
  );
}

function SuggestionCard({ level, suggestions }) {
  const framing = SUGGESTION_FRAMING[level];
  const actions = (suggestions.actions || []).filter(a => a.niveau === level);
  const recharge = suggestions.recharge || [];
  const phrases = suggestions.phrases || [];

  // Pick a stable-ish phrase: rotate by day so it doesn't change on every render
  const phrase = useMemo(() => {
    if (phrases.length === 0) return null;
    const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    return phrases[dayIndex % phrases.length];
  }, [phrases]);

  if (level === "vert") {
    return (
      <div className={`sugg-card level-${level}`}>
        <h3>{framing.title}</h3>
        <p className="question">{framing.question}</p>
        <ul>
          {VERT_TIPS.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </div>
    );
  }

  return (
    <div className={`sugg-card level-${level}`}>
      <h3>{framing.title}</h3>
      <p className="question">{framing.question}</p>

      {actions.length > 0 && (
        <ul>
          {actions.map(a => (
            <li key={a.id}>
              {a.label}
              {a.cout ? <span className="action-cost"> {"·".repeat(a.cout)}</span> : null}
            </li>
          ))}
        </ul>
      )}

      {level === "orange" && recharge.length > 0 && (
        <div className="recharge-block">
          <p className="recharge-label recharge-yes">Ce qui recharge vraiment :</p>
          <ul>
            {recharge.filter(r => r.efficace).map(r => <li key={r.id}>{r.activite}</li>)}
          </ul>
          <p className="recharge-label recharge-no">Ressemble à du repos mais recharge peu :</p>
          <ul className="recharge-no-list">
            {recharge.filter(r => !r.efficace).map(r => <li key={r.id}>{r.activite}</li>)}
          </ul>
        </div>
      )}

      {phrase && (
        <p className="pac-phrase">{phrase.phrase}</p>
      )}
    </div>
  );
}

function HistoryView({ history, onDelete, onClear, loading, error }) {
  const stats = useMemo(() => {
    const counts = { vert: 0, jaune: 0, orange: 0, rouge: 0 };
    history.forEach(h => { counts[h.niveau] = (counts[h.niveau] || 0) + 1; });
    return counts;
  }, [history]);

  const topSignals = useMemo(() => {
    const counts = {};
    history.forEach(h => {
      (h.signaux || []).forEach(label => {
        counts[label] = (counts[label] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [history]);

  const topTriggers = useMemo(() => {
    const counts = {};
    history.forEach(h => {
      (h.triggers || []).forEach(label => {
        counts[label] = (counts[label] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [history]);

  if (loading) {
    return (
      <div className="history-section">
        <div className="history-empty">Chargement de l'historique…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="history-section">
        <div className="history-empty">
          Impossible de charger l'historique pour le moment.<br />
          ({error})
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="history-section">
        <div className="history-empty">
          Aucun point enregistré encore.<br />
          Reviens sur l'onglet « Maintenant », coche tes signaux, puis appuie sur « Enregistrer ce point ».
        </div>
      </div>
    );
  }

  return (
    <div className="history-section">
      <div className="export-row">
        <button className="btn-secondary" onClick={() => exportCSV(history)}>Exporter en CSV</button>
        <button className="btn-secondary" onClick={() => exportJSON(history)}>Exporter en JSON</button>
      </div>

      <div className="history-stats">
        {LEVELS.map(l => (
          <div className="stat-card" key={l}>
            <div className={`stat-num level-${l} display`}>{stats[l]}</div>
            <div className="stat-label">{LEVEL_LABELS[l].name.split(" — ")[0]}</div>
          </div>
        ))}
      </div>

      {topSignals.length > 0 && (
        <div className="top-signals">
          <h2 className="display">Signaux les plus fréquents</h2>
          {topSignals.map(([label, count]) => (
            <div className="top-signal-row" key={label}>
              <span>{label}</span>
              <span className="top-signal-count">{count}×</span>
            </div>
          ))}
        </div>
      )}

      {topTriggers.length > 0 && (
        <div className="top-signals">
          <h2 className="display">Facteurs déclencheurs les plus fréquents</h2>
          {topTriggers.map(([label, count]) => (
            <div className="top-signal-row" key={label}>
              <span>{label}</span>
              <span className="top-signal-count">{count}×</span>
            </div>
          ))}
        </div>
      )}

      <h2 className="display" style={{ marginTop: 20 }}>Historique</h2>
      {history.map(entry => (
        <div className={`history-entry level-${entry.niveau}`} key={entry.id}>
          <div className="history-entry-head">
            <span className="history-entry-date">{formatDateTime(entry.created_at)}</span>
            <span>
              <span className={`history-entry-level level-${entry.niveau}`}>
                {LEVEL_LABELS[entry.niveau].name.split(" — ")[0]}
              </span>
              <button className="history-entry-del" onClick={() => onDelete(entry.id)}>supprimer</button>
            </span>
          </div>
          <div className="history-entry-signals">
            {(entry.signaux && entry.signaux.length > 0) ? entry.signaux.join(" · ") : "Aucun signal coché"}
          </div>
          {(entry.triggers && entry.triggers.length > 0) && (
            <div className="history-entry-triggers">
              Facteurs : {entry.triggers.join(" · ")}
            </div>
          )}
        </div>
      ))}

      <button className="clear-history-btn" onClick={onClear}>Effacer tout l'historique</button>
    </div>
  );
}

function ClassifySignal({ onAddAsSelected }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { niveau, justification }
  const [error, setError] = useState(null);

  const handleClassify = async () => {
    const value = text.trim();
    if (!value) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiClassify(value);
      setResult(data);
    } catch (e) {
      setError(e.message || "Erreur lors de la classification");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (!result) return;
    onAddAsSelected(result.niveau, text.trim());
    setText("");
    setResult(null);
  };

  return (
    <div className="section classify-section">
      <div className="section-head">
        <h2>Décrire un signal</h2>
      </div>
      <div className="add-row">
        <input
          type="text"
          placeholder="Ex : j'ai mal derrière l'œil gauche…"
          value={text}
          onChange={e => { setText(e.target.value); setResult(null); setError(null); }}
          onKeyDown={e => { if (e.key === "Enter") handleClassify(); }}
        />
        <button onClick={handleClassify} disabled={loading || !text.trim()}>
          {loading ? "…" : "Analyser"}
        </button>
      </div>

      {error && <p className="classify-error">{error}</p>}

      {result && (
        <div className={`classify-result level-${result.niveau}`}>
          <div className={`classify-badge level-${result.niveau}`}>
            <span className={`dot dot-${result.niveau}`} />
            {LEVEL_LABELS[result.niveau].name}
          </div>
          {result.justification && <p className="classify-justification">{result.justification}</p>}
          <button className="btn-secondary classify-add-btn" onClick={handleAdd}>
            Ajouter et cocher ce signal
          </button>
        </div>
      )}
    </div>
  );
}

function App() {
  const [tab, setTab] = useState("now"); // "now" | "history"
  const [signals, setSignals] = useState([]);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [signalsError, setSignalsError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [triggers, setTriggers] = useState([]);
  const [triggersLoading, setTriggersLoading] = useState(true);
  const [triggersError, setTriggersError] = useState(null);
  const [selectedTriggerIds, setSelectedTriggerIds] = useState(new Set());
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [suggestions, setSuggestions] = useState({ actions: [], recharge: [], phrases: [] });

  useEffect(() => {
    apiGetSuggestions()
      .then(data => setSuggestions(data))
      .catch(() => {}); // non-bloquant : la carte reste utilisable sans, juste plus sobre
  }, []);

  useEffect(() => {
    setSignalsLoading(true);
    setSignalsError(null);
    apiGetSignals()
      .then(rows => setSignals(rows))
      .catch(e => setSignalsError(e.message || "Erreur inconnue"))
      .finally(() => setSignalsLoading(false));
  }, []);

  useEffect(() => {
    setTriggersLoading(true);
    setTriggersError(null);
    apiGetTriggers()
      .then(rows => setTriggers(rows))
      .catch(e => setTriggersError(e.message || "Erreur inconnue"))
      .finally(() => setTriggersLoading(false));
  }, []);

  const refreshHistory = () => {
    setHistoryLoading(true);
    setHistoryError(null);
    apiGetHistory()
      .then(rows => setHistory(rows))
      .catch(e => setHistoryError(e.message || "Erreur inconnue"))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    refreshHistory();
  }, []);

  const toggle = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addSignal = (level, label) => {
    apiAddSignal(level, label)
      .then(newSignal => {
        setSignals(prev => [...prev, newSignal]);
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.add(newSignal.id);
          return next;
        });
      })
      .catch(e => setSignalsError(e.message || "Erreur lors de l'ajout"));
  };

  const addSignalFromClassify = (level, label) => {
    addSignal(level, label);
  };

  const deleteSignal = (id) => {
    apiDeleteSignal(id)
      .then(() => {
        setSignals(prev => prev.filter(s => s.id !== id));
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      })
      .catch(e => setSignalsError(e.message || "Erreur lors de la suppression"));
  };

  const toggleTrigger = (id) => {
    setSelectedTriggerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addTrigger = (label) => {
    apiAddTrigger(label)
      .then(newTrigger => {
        setTriggers(prev => [...prev, newTrigger]);
        setSelectedTriggerIds(prev => {
          const next = new Set(prev);
          next.add(newTrigger.id);
          return next;
        });
      })
      .catch(e => setTriggersError(e.message || "Erreur lors de l'ajout"));
  };

  const deleteTrigger = (id) => {
    apiDeleteTrigger(id)
      .then(() => {
        setTriggers(prev => prev.filter(t => t.id !== id));
        setSelectedTriggerIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      })
      .catch(e => setTriggersError(e.message || "Erreur lors de la suppression"));
  };

  const resetAll = () => {
    setSelectedIds(new Set());
    setSelectedTriggerIds(new Set());
  };

  const selectedSignals = useMemo(
    () => signals.filter(s => selectedIds.has(s.id)),
    [signals, selectedIds]
  );

  const selectedTriggers = useMemo(
    () => triggers.filter(t => selectedTriggerIds.has(t.id)),
    [triggers, selectedTriggerIds]
  );

  const level = useMemo(() => computeOverallLevel(selectedSignals), [selectedSignals]);

  const groupedByLevel = useMemo(() => {
    const grouped = {};
    LEVELS.forEach(l => { grouped[l] = signals.filter(s => s.level === l); });
    return grouped;
  }, [signals]);

  const savePoint = () => {
    setSaveError(null);
    apiAddHistory(level, selectedSignals.map(s => s.label), selectedTriggers.map(t => t.label))
      .then(entry => {
        setHistory(prev => [entry, ...prev]);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
      })
      .catch(e => setSaveError(e.message || "Erreur lors de l'enregistrement"));
  };

  const deleteHistoryEntry = (id) => {
    apiDeleteHistory(id)
      .then(() => setHistory(prev => prev.filter(e => e.id !== id)))
      .catch(e => setHistoryError(e.message || "Erreur lors de la suppression"));
  };

  const clearHistory = () => {
    if (window.confirm("Effacer tout l'historique ? Cette action est irréversible.")) {
      apiClearHistory()
        .then(() => setHistory([]))
        .catch(e => setHistoryError(e.message || "Erreur lors de l'effacement"));
    }
  };

  return (
    <div>
      <header className="top">
        <h1 className="display">Jauge du système</h1>
        <p className="tagline">Coche les signaux que tu remarques. La jauge t'indique où tu en es, et ce qui peut aider.</p>
        <div className="tabs">
          <button className={`tab ${tab === "now" ? "active" : ""}`} onClick={() => setTab("now")}>Maintenant</button>
          <button className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>Historique</button>
        </div>
      </header>

      {tab === "now" && (
        <React.Fragment>
          <Jauge level={level} selectedCount={selectedSignals.length} />

          <ClassifySignal onAddAsSelected={addSignalFromClassify} />

          {selectedSignals.length > 0 && (
            <div className="suggestions">
              <h2 className="display">Ce qui peut aider</h2>
              <p className="lead">
                {level === "vert"
                  ? "Pas de signal d'alerte particulier."
                  : "D'après les signaux cochés, voici une piste."}
              </p>
              <SuggestionCard level={level} suggestions={suggestions} />
            </div>
          )}

          {signalsLoading && (
            <p className="signal-source-note">Chargement des signaux…</p>
          )}
          {signalsError && (
            <p className="save-error">Impossible de charger les signaux ({signalsError})</p>
          )}

          {LEVELS.map(l => (
            <SignalSection
              key={l}
              level={l}
              signals={groupedByLevel[l]}
              selectedIds={selectedIds}
              onToggle={toggle}
              onAdd={addSignal}
              onDelete={deleteSignal}
            />
          ))}

          {triggersLoading && (
            <p className="signal-source-note">Chargement des facteurs déclencheurs…</p>
          )}
          {triggersError && (
            <p className="save-error">Impossible de charger les facteurs déclencheurs ({triggersError})</p>
          )}

          <TriggersSection
            triggers={triggers}
            selectedIds={selectedTriggerIds}
            onToggle={toggleTrigger}
            onAdd={addTrigger}
            onDelete={deleteTrigger}
          />

          <div className="actions-row">
            <button className="btn-primary" onClick={savePoint}>Enregistrer ce point</button>
            <button className="btn-secondary" onClick={resetAll}>Tout désélectionner</button>
          </div>
          {savedFlash && <p className="save-confirm">Point enregistré dans l'historique.</p>}
          {saveError && <p className="save-error">{saveError}</p>}

          <p className="signal-source-note">
            ⭐ = signal identifié comme particulièrement prédictif chez toi (12 à 48h avant une migraine).
          </p>

          <footer className="foot">
            L'historique est enregistré sur le serveur (Neon) et accessible depuis n'importe quel appareil.
          </footer>
        </React.Fragment>
      )}

      {tab === "history" && (
        <HistoryView
          history={history}
          onDelete={deleteHistoryEntry}
          onClear={clearHistory}
          loading={historyLoading}
          error={historyError}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
