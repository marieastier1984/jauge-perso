# Jauge du système

App de suivi des signaux de fatigue / surchauffe / migraine, avec jauge visuelle, suggestions adaptées, classification par texte libre (IA) et historique daté stocké en base.

## Architecture

- **Front** : fichiers statiques (`index.html`, `style.css`, `app.js`), React + Babel via CDN, pas de build
- **API** (dossier `api/`, fonctions serverless Vercel) :
  - `api/classify.js` — appelle l'API Claude pour classer un signal décrit en texte libre dans une couleur (vert/jaune/orange/rouge)
  - `api/history.js` — lit/écrit/supprime l'historique dans Neon (Postgres)
  - `api/signals.js` — lit/ajoute/supprime les définitions de signaux (catégories vert/jaune/orange/rouge, par défaut + personnalisés) dans Neon
  - `api/suggestions.js` — lit les actions par niveau, les activités de recharge (efficaces vs trompeuses) et les phrases anti-culpabilité
- **Base de données** : Neon (Postgres), tables `signaux_historique`, `signaux_definitions`, `actions_reference`, `recharge_effective`, `phrases_anti_culpabilite`

## Mise en place

### 1. Neon

1. Crée un nouveau projet (ou une nouvelle base dans un projet existant)
2. Ouvre l'éditeur SQL et exécute le contenu de `schema.sql` (crée toutes les tables et insère les données de référence — signaux, actions, recharge, phrases — de façon idempotente)
3. Récupère la chaîne de connexion (`postgres://...`) depuis le dashboard Neon

### 2. Vercel

1. Pousse ce dossier sur un repo GitHub
2. Sur Vercel : "Add New Project" → importer le repo
3. Aucune configuration de build nécessaire (statique + fonctions serverless détectées automatiquement via le dossier `api/`)
4. Dans **Settings → Environment Variables**, ajoute :
   - `DATABASE_URL` = la chaîne de connexion Neon (étape précédente)
   - `ANTHROPIC_API_KEY` = ta clé API Anthropic (console.anthropic.com)
5. Déployer

L'app sera disponible sur `https://<projet>.vercel.app`.

### 3. Installation sur le téléphone

- **iOS (Safari)** : ouvrir l'URL → Partager → "Sur l'écran d'accueil"
- **Android (Chrome)** : ouvrir l'URL → menu ⋮ → "Installer l'application"

## Fonctionnement

- Coche les signaux ressentis dans les 4 catégories (vert/jaune/orange/rouge), ou ajoute les tiens — la liste est partagée entre tous tes appareils (stockée dans Neon). Chaque signal porte un groupe thématique (corps, travail, relationnel, migraine) et un niveau de confiance.
- **Décrire un signal** : tape une phrase libre (ex. "j'ai mal derrière l'œil gauche"), l'IA propose une couleur ; tu peux l'ajouter et la cocher directement (il est alors enregistré comme signal personnalisé)
- La jauge se positionne sur le niveau le plus élevé coché (règle d'escalade : 3+ signaux au même niveau jaune/orange font monter d'un cran)
- Les suggestions affichées selon le niveau combinent :
  - une liste d'**actions concrètes** (avec un indicateur de coût énergétique pour jaune/orange)
  - pour le niveau orange, une distinction entre ce qui **recharge vraiment** et ce qui **ressemble à du repos mais recharge peu**
  - une **phrase anti-culpabilité**, qui change chaque jour
- "Enregistrer ce point" sauvegarde l'état actuel (date, niveau, signaux) dans Neon, via `/api/history`
- L'onglet Historique affiche les statistiques par niveau, les signaux les plus fréquents, et permet l'export CSV/JSON

## Données

Tout vit dans Neon, donc accessible et cohérent depuis n'importe quel appareil :
- `signaux_historique` : chaque point enregistré (date, niveau, signaux cochés)
- `signaux_definitions` : la liste complète des signaux (par défaut + personnalisés), avec catégorie/couleur, groupe thématique et niveau de confiance
- `actions_reference` : actions suggérées par niveau, avec coût énergétique
- `recharge_effective` : activités efficaces vs trompeuses pour recharger
- `phrases_anti_culpabilite` : phrases affichées en rotation

Aucune clé API n'est exposée côté client : `ANTHROPIC_API_KEY` et `DATABASE_URL` restent uniquement dans les variables d'environnement Vercel, utilisées par les fonctions serverless.

Les signaux par défaut (non personnalisés) ne peuvent pas être supprimés via l'interface — seuls les signaux personnalisés (`custom = true`) le peuvent.

## Maintenance

- Pour modifier la liste de signaux par défaut, le barème de suggestions ou les règles d'escalade : éditer `app.js` (constante `SUGGESTIONS`, fonction `computeOverallLevel`) côté front, et la table `signaux_definitions` côté données (via l'app ou directement en SQL)
- Pour ajuster le prompt de classification IA : `api/classify.js` (constante `SYSTEM_PROMPT`)
- `service-worker.js` met en cache les fichiers statiques pour le mode hors-ligne ; incrémenter `CACHE_NAME` après toute modification de `app.js`/`style.css` pour forcer la mise à jour côté utilisateurs (les appels `/api/*` ne sont jamais mis en cache)

## Mise à jour depuis une version précédente

Si tu avais déjà déployé une version antérieure de la base :

1. Réexécute `schema.sql` dans l'éditeur SQL Neon :
   - les nouvelles tables (`actions_reference`, `recharge_effective`, `phrases_anti_culpabilite`) sont créées et peuplées
   - `signaux_definitions` est mise à jour : les anciens signaux par défaut (`custom = false`) sont remplacés par le nouveau référentiel (groupe thématique + niveau de confiance) ; tes signaux personnalisés (`custom = true`) sont conservés tels quels
   - `signaux_historique` n'est pas touchée
2. Redéploie le code (nouveaux fichiers `api/suggestions.js`, `api/signals.js` et `app.js` mis à jour)

Note : les libellés exacts des anciens signaux par défaut changent légèrement (reformulations, regroupements). Si ton historique référence un ancien libellé qui n'existe plus dans `signaux_definitions`, il reste affiché tel quel dans l'historique (texte libre), mais ne correspondra plus à une case à cocher actuelle.
