const { useState, useMemo, useEffect } = React;

// --- Storage keys -----------------------------------------------------------

const STORAGE_SIGNALS = "jauge_signals_v1";

// --- Data model -----------------------------------------------------------

const LEVELS = ["vert", "jaune", "orange", "rouge"];

const LEVEL_LABELS = {
  vert:   { name: "Vert — équilibre", short: "Tout va bien" },
  jaune:  { name: "Jaune — préserver", short: "Premiers signes de déconnexion" },
  orange: { name: "Orange — recharger", short: "Activation forte, dette qui s'installe" },
  rouge:  { name: "Rouge — limiter les dégâts", short: "La capacité de compensation est dépassée" },
};

const STAR_LEVELS = { 3: "⭐⭐⭐", 2: "⭐⭐", 1: "⭐" };

// Each signal: { id, label, level, star (optional 1-3), custom (optional bool) }
const DEFAULT_SIGNALS = [
  // Vert
  { id: "v1", label: "Tu passes d'une activité à une autre sans difficulté", level: "vert" },
  { id: "v2", label: "Tu manges quand tu as faim", level: "vert" },
  { id: "v3", label: "Tu peux t'arrêter de travailler sans y retourner mentalement", level: "vert" },
  { id: "v4", label: "Les rendez-vous restent des rendez-vous", level: "vert" },
  { id: "v5", label: "Tu fais vélo / tricot / photo / travail avec plaisir, sans obsession", level: "vert" },

  // Jaune
  { id: "j1", label: "Tu n'as plus faim alors que tu as peu mangé", level: "jaune", star: 3 },
  { id: "j2", label: "Tu attends une réponse (JP, mission, projet…)", level: "jaune", star: 3 },
  { id: "j3", label: "Tu repousses un repas", level: "jaune" },
  { id: "j4", label: "Tu oublies de boire", level: "jaune" },
  { id: "j5", label: "« Encore 5 minutes » répété plusieurs fois", level: "jaune", star: 2 },
  { id: "j6", label: "Tu vérifies souvent ton téléphone", level: "jaune", star: 2 },
  { id: "j7", label: "Tu sais qu'il faudrait une pause mais tu ne la prends pas", level: "jaune" },
  { id: "j8", label: "Tu te sens plus fatiguée que l'activité ne le justifie", level: "jaune" },
  { id: "j9", label: "Tu commences à tourner en boucle sur un sujet", level: "jaune" },

  // Orange
  { id: "o1", label: "Tu arrêtes de travailler mais ton cerveau continue", level: "orange", star: 3 },
  { id: "o2", label: "Tu es en tunnel depuis plusieurs heures", level: "orange" },
  { id: "o3", label: "Série / tricot / changement de pièce… et ça continue quand même", level: "orange" },
  { id: "o4", label: "Tu ressens un « manque » quand tu arrêtes de travailler", level: "orange" },
  { id: "o5", label: "Tu as besoin d'une grosse sieste", level: "orange", star: 1 },
  { id: "o6", label: "Tu es « sur les dents », prête à réagir", level: "orange" },
  { id: "o7", label: "Mal à tolérer l'incertitude d'une réponse attendue", level: "orange" },
  { id: "o8", label: "Douleur légère derrière un œil", level: "orange", star: 2 },
  { id: "o9", label: "Bouche sèche inhabituelle", level: "orange" },
  { id: "o10", label: "Tu te demandes ce que tu as fait de mal", level: "orange" },

  // Rouge
  { id: "r1", label: "Migraine installée au réveil ou dans la journée", level: "rouge" },
  { id: "r2", label: "Douleur derrière les yeux", level: "rouge" },
  { id: "r3", label: "Voile visuel", level: "rouge" },
  { id: "r4", label: "Vomissements", level: "rouge" },
  { id: "r5", label: "Diarrhée associée", level: "rouge" },
  { id: "r6", label: "Fatigue écrasante", level: "rouge" },
  { id: "r7", label: "Annulation d'activités ou de rendez-vous", level: "rouge" },
  { id: "r8", label: "Besoin de Relpax et de dormir plusieurs heures", level: "rouge" },
  { id: "r9", label: "Difficulté à conduire, réfléchir ou décider", level: "rouge" },
];

const SUGGESTIONS = {
  vert: {
    title: "Continue comme ça",
    question: "Rien à ajuster pour l'instant.",
    items: [
      "Profite de cette marge : c'est le bon moment pour les choses qui demandent de l'énergie.",
      "Repère ce qui te fait du bien aujourd'hui — ça aide à le reconnaître plus tard.",
    ],
  },
  jaune: {
    title: "Préserver — dépenser un peu moins d'énergie",
    question: "Qu'est-ce que je peux faire pour dépenser un peu moins d'énergie pendant les 2 prochaines heures ?",
    items: [
      "Commander plutôt que cuisiner",
      "Remettre une tâche à demain",
      "Réunion téléphonique au lieu d'un déplacement",
      "Boire avant d'avoir soif, manger avant d'avoir faim",
      "Pas besoin de tout arrêter : juste freiner la dépense",
    ],
  },
  orange: {
    title: "Recharger — vraiment, pas juste faire une pause",
    question: "Qu'est-ce qui recharge vraiment mes batteries, là, maintenant ?",
    items: [
      "Dormir, même brièvement",
      "Lire au lit",
      "Une balade sans rien à produire",
      "Voir quelqu'un avec qui tu n'as rien à prouver",
      "Vélo vécu comme une aventure, pas comme une tâche",
      "Éviter : série en pensant au travail, tricot en surveillant le téléphone, pause en attendant un message — ça ne recharge pas",
    ],
  },
  rouge: {
    title: "Limiter les dégâts",
    question: "Comment je me soigne et je récupère, maintenant ?",
    items: [
      "Relpax si besoin",
      "Repos, dans le noir si possible",
      "Annule ou décale sans culpabiliser",
      "Hydratation",
      "Pas le moment de comprendre — juste de récupérer",
    ],
  },
};

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

function loadSignals() {
  try {
    const raw = localStorage.getItem(STORAGE_SIGNALS);
    if (!raw) return DEFAULT_SIGNALS;
    const stored = JSON.parse(raw);
    if (!Array.isArray(stored) || stored.length === 0) return DEFAULT_SIGNALS;
    return stored;
  } catch (e) {
    return DEFAULT_SIGNALS;
  }
}

async function apiGetHistory() {
  const res = await fetch("/api/history");
  if (!res.ok) throw new Error("Échec du chargement de l'historique");
  const data = await res.json();
  return data.history || [];
}

async function apiAddHistory(niveau, signaux) {
  const res = await fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ niveau, signaux }),
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
  const rows = [["date", "niveau", "signaux"]];
  history.forEach(entry => {
    rows.push([
      entry.created_at,
      entry.niveau,
      (entry.signaux || []).join(" | "),
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

function SuggestionCard({ level }) {
  const data = SUGGESTIONS[level];
  return (
    <div className={`sugg-card level-${level}`}>
      <h3>{data.title}</h3>
      <p className="question">{data.question}</p>
      <ul>
        {data.items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
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
  const [signals, setSignals] = useState(loadSignals);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_SIGNALS, JSON.stringify(signals));
  }, [signals]);

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
    const id = `custom-${level}-${Date.now()}`;
    setSignals(prev => [...prev, { id, label, level, custom: true }]);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    return id;
  };

  const addSignalFromClassify = (level, label) => {
    addSignal(level, label);
  };

  const deleteSignal = (id) => {
    setSignals(prev => prev.filter(s => s.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const resetAll = () => setSelectedIds(new Set());

  const selectedSignals = useMemo(
    () => signals.filter(s => selectedIds.has(s.id)),
    [signals, selectedIds]
  );

  const level = useMemo(() => computeOverallLevel(selectedSignals), [selectedSignals]);

  const groupedByLevel = useMemo(() => {
    const grouped = {};
    LEVELS.forEach(l => { grouped[l] = signals.filter(s => s.level === l); });
    return grouped;
  }, [signals]);

  const savePoint = () => {
    setSaveError(null);
    apiAddHistory(level, selectedSignals.map(s => s.label))
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
              <SuggestionCard level={level} />
            </div>
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
