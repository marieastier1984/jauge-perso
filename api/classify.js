// /api/classify.js
// Classe un signal décrit en texte libre dans une des 4 catégories
// (vert / jaune / orange / rouge) via l'API Claude.

const LEVELS = ["vert", "jaune", "orange", "rouge"];

const SYSTEM_PROMPT = `Tu aides une personne à classer un signal physique/mental qu'elle ressent
dans une grille de niveaux d'alerte pour la fatigue / surchauffe / migraine.

Niveaux possibles, du moins au plus inquiétant :
- vert : signe de bon équilibre, système nerveux souple, énergie disponible
- jaune : premiers signes de déconnexion du corps (repousse un repas, oublie de boire,
  attend une réponse importante, vérifie souvent son téléphone, difficulté à changer d'activité)
- orange : forte activation cognitive, dette de récupération (tunnel depuis des heures,
  cerveau qui continue après l'arrêt du travail, besoin de grosse sieste, douleur légère
  derrière un œil, bouche sèche)
- rouge : crise installée (migraine, douleur derrière les yeux, voile visuel, vomissements,
  fatigue écrasante, annulation d'activités)

Réponds UNIQUEMENT avec un objet JSON, sans aucun texte avant ou après, au format :
{"niveau": "vert" | "jaune" | "orange" | "rouge", "justification": "une phrase courte"}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { signal } = req.body || {};
  if (!signal || typeof signal !== "string" || !signal.trim()) {
    return res.status(400).json({ error: "Le champ 'signal' est requis" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Clé API non configurée côté serveur" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: `Signal décrit par la personne : "${signal.trim()}"` },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: "Erreur API Claude", detail: errText });
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock) {
      return res.status(502).json({ error: "Réponse inattendue de l'API" });
    }

    let parsed;
    try {
      const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(502).json({ error: "Réponse non interprétable", raw: textBlock.text });
    }

    if (!LEVELS.includes(parsed.niveau)) {
      return res.status(502).json({ error: "Niveau invalide retourné", raw: parsed });
    }

    return res.status(200).json({
      niveau: parsed.niveau,
      justification: parsed.justification || "",
    });
  } catch (err) {
    return res.status(500).json({ error: "Erreur serveur", detail: String(err) });
  }
}
