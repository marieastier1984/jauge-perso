// /api/suggestions.js
// Renvoie les données de référence pour les suggestions :
// actions par niveau, activités de recharge (efficaces vs trompeuses),
// et phrases anti-culpabilité.
//
// GET /api/suggestions -> { actions, recharge, phrases }

import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return res.status(500).json({ error: "DATABASE_URL non configurée côté serveur" });
  }

  const sql = neon(connectionString);

  try {
    const [actions, recharge, phrases] = await Promise.all([
      sql("select id, label, niveau, cout, position from actions_reference order by niveau, position"),
      sql("select id, activite, efficace, confiance, position from recharge_effective order by efficace desc, position"),
      sql("select id, phrase from phrases_anti_culpabilite order by id"),
    ]);

    return res.status(200).json({ actions, recharge, phrases });
  } catch (err) {
    return res.status(500).json({ error: "Erreur serveur", detail: String(err) });
  }
}
