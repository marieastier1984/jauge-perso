// /api/signals.js
// Lecture / ajout / suppression des définitions de signaux
// (catégories vert/jaune/orange/rouge, par défaut + personnalisés).
//
// GET    /api/signals          -> liste tous les signaux (triés par niveau, position)
// POST   /api/signals           body: { niveau, label }  -> ajoute un signal personnalisé
// DELETE /api/signals?id=...    -> supprime un signal (uniquement les personnalisés)

import { neon } from "@neondatabase/serverless";

const LEVELS = ["vert", "jaune", "orange", "rouge"];
const LEVEL_ORDER = { vert: 0, jaune: 1, orange: 2, rouge: 3 };

export default async function handler(req, res) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return res.status(500).json({ error: "DATABASE_URL non configurée côté serveur" });
  }

  const sql = neon(connectionString);

  try {
    if (req.method === "GET") {
      const rows = await sql(
        "select id, label, niveau, groupe, confiance, star, custom, position from signaux_definitions order by niveau, position, created_at"
      );
      rows.sort((a, b) => {
        const lv = LEVEL_ORDER[a.niveau] - LEVEL_ORDER[b.niveau];
        if (lv !== 0) return lv;
        return a.position - b.position;
      });
      return res.status(200).json({ signals: rows });
    }

    if (req.method === "POST") {
      const { niveau, label } = req.body || {};
      if (!LEVELS.includes(niveau)) {
        return res.status(400).json({ error: "Niveau invalide" });
      }
      if (!label || typeof label !== "string" || !label.trim()) {
        return res.status(400).json({ error: "Le champ 'label' est requis" });
      }

      const id = `custom-${niveau}-${Date.now()}`;

      const posRows = await sql(
        "select coalesce(max(position), 0) + 1 as next_pos from signaux_definitions where niveau = $1",
        [niveau]
      );
      const position = posRows[0].next_pos;

      const rows = await sql(
        `insert into signaux_definitions (id, label, niveau, custom, position)
         values ($1, $2, $3, true, $4)
         returning id, label, niveau, star, custom, position`,
        [id, label.trim(), niveau, position]
      );
      return res.status(201).json({ signal: rows[0] });
    }

    if (req.method === "DELETE") {
      const { id } = req.query || {};
      if (!id) {
        return res.status(400).json({ error: "Paramètre 'id' requis" });
      }

      // Only allow deleting custom signals, never the defaults.
      const rows = await sql(
        "delete from signaux_definitions where id = $1 and custom = true returning id",
        [id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Signal personnalisé introuvable" });
      }
      return res.status(200).json({ deleted: id });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Méthode non autorisée" });
  } catch (err) {
    return res.status(500).json({ error: "Erreur serveur", detail: String(err) });
  }
}
