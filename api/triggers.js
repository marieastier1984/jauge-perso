// /api/triggers.js
// Lecture / ajout / suppression des facteurs déclencheurs probables
// (référentiel + personnalisés). Pas de couleur/niveau associé.
//
// GET    /api/triggers          -> liste tous les triggers (triés par position)
// POST   /api/triggers           body: { label }  -> ajoute un trigger personnalisé
// DELETE /api/triggers?id=...    -> supprime un trigger (uniquement les personnalisés)

import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return res.status(500).json({ error: "DATABASE_URL non configurée côté serveur" });
  }

  const sql = neon(connectionString);

  try {
    if (req.method === "GET") {
      const rows = await sql(
        "select id, label, confiance, custom, position from triggers_definitions order by position, created_at"
      );
      return res.status(200).json({ triggers: rows });
    }

    if (req.method === "POST") {
      const { label } = req.body || {};
      if (!label || typeof label !== "string" || !label.trim()) {
        return res.status(400).json({ error: "Le champ 'label' est requis" });
      }

      const id = `custom-${Date.now()}`;

      const posRows = await sql(
        "select coalesce(max(position), 0) + 1 as next_pos from triggers_definitions"
      );
      const position = posRows[0].next_pos;

      const rows = await sql(
        `insert into triggers_definitions (id, label, custom, position)
         values ($1, $2, true, $3)
         returning id, label, confiance, custom, position`,
        [id, label.trim(), position]
      );
      return res.status(201).json({ trigger: rows[0] });
    }

    if (req.method === "DELETE") {
      const { id } = req.query || {};
      if (!id) {
        return res.status(400).json({ error: "Paramètre 'id' requis" });
      }

      const rows = await sql(
        "delete from triggers_definitions where id = $1 and custom = true returning id",
        [id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: "Trigger personnalisé introuvable" });
      }
      return res.status(200).json({ deleted: id });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Méthode non autorisée" });
  } catch (err) {
    return res.status(500).json({ error: "Erreur serveur", detail: String(err) });
  }
}
