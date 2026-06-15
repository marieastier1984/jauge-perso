// /api/history.js
// Lecture / écriture / suppression de l'historique dans Neon (Postgres).
//
// GET    /api/history          -> liste tout l'historique (trié par date desc)
// POST   /api/history           body: { niveau, signaux: string[] }  -> ajoute un point
// DELETE /api/history?id=...    -> supprime un point
// DELETE /api/history?all=true  -> efface tout l'historique

import { neon } from "@neondatabase/serverless";

const LEVELS = ["vert", "jaune", "orange", "rouge"];

export default async function handler(req, res) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return res.status(500).json({ error: "DATABASE_URL non configurée côté serveur" });
  }

  const sql = neon(connectionString);

  try {
    if (req.method === "GET") {
      const rows = await sql(
        "select id, created_at, niveau, signaux from signaux_historique order by created_at desc"
      );
      return res.status(200).json({ history: rows });
    }

    if (req.method === "POST") {
      const { niveau, signaux } = req.body || {};
      if (!LEVELS.includes(niveau)) {
        return res.status(400).json({ error: "Niveau invalide" });
      }
      if (!Array.isArray(signaux)) {
        return res.status(400).json({ error: "Le champ 'signaux' doit être un tableau" });
      }

      const rows = await sql(
        "insert into signaux_historique (niveau, signaux) values ($1, $2::jsonb) returning id, created_at, niveau, signaux",
        [niveau, JSON.stringify(signaux)]
      );
      return res.status(201).json({ entry: rows[0] });
    }

    if (req.method === "DELETE") {
      const { id, all } = req.query || {};

      if (all === "true") {
        await sql("delete from signaux_historique");
        return res.status(200).json({ deleted: "all" });
      }

      if (!id) {
        return res.status(400).json({ error: "Paramètre 'id' ou 'all' requis" });
      }

      await sql("delete from signaux_historique where id = $1", [id]);
      return res.status(200).json({ deleted: id });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Méthode non autorisée" });
  } catch (err) {
    return res.status(500).json({ error: "Erreur serveur", detail: String(err) });
  }
}
