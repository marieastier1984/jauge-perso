# Jauge du système

App de suivi des signaux de fatigue / surchauffe / migraine, avec jauge visuelle, suggestions adaptées, classification par texte libre (IA) et historique daté stocké en base.

## Architecture

- **Front** : fichiers statiques (`index.html`, `style.css`, `app.js`), React + Babel via CDN, pas de build
- **API** (dossier `api/`, fonctions serverless Vercel) :
  - `api/classify.js` — appelle l'API Claude pour classer un signal décrit en texte libre dans une couleur (vert/jaune/orange/rouge)
  - `api/history.js` — lit/écrit/supprime l'historique dans Neon (Postgres)
- **Base de données** : Neon (Postgres), table `signaux_historique`

## Mise en place

### 1. Neon

1. Crée un nouveau projet (ou une nouvelle base dans un projet existant)
2. Ouvre l'éditeur SQL et exécute le contenu de `schema.sql` (crée la table `signaux_historique`)
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

- Coche les signaux ressentis dans les 4 catégories (vert/jaune/orange/rouge), ou ajoute les tiens
- **Décrire un signal** : tape une phrase libre (ex. "j'ai mal derrière l'œil gauche"), l'IA propose une couleur ; tu peux l'ajouter et la cocher directement
- La jauge se positionne sur le niveau le plus élevé coché (règle d'escalade : 3+ signaux au même niveau jaune/orange font monter d'un cran)
- Des suggestions concrètes s'affichent selon le niveau (préserver / recharger / limiter les dégâts)
- "Enregistrer ce point" sauvegarde l'état actuel (date, niveau, signaux) dans Neon, via `/api/history`
- L'onglet Historique affiche les statistiques par niveau, les signaux les plus fréquents, et permet l'export CSV/JSON

## Données

- L'historique vit dans Neon : accessible depuis n'importe quel appareil, persistant
- Les signaux personnalisés (catégories vert/jaune/orange/rouge) restent en `localStorage` du navigateur — propres à chaque appareil
- Aucune clé API n'est exposée côté client : `ANTHROPIC_API_KEY` et `DATABASE_URL` restent uniquement dans les variables d'environnement Vercel, utilisées par les fonctions serverless

## Maintenance

- Pour modifier la liste de signaux par défaut, le barème de suggestions ou les règles d'escalade : éditer `app.js` (constantes `DEFAULT_SIGNALS`, `SUGGESTIONS`, `computeOverallLevel`)
- Pour ajuster le prompt de classification IA : `api/classify.js` (constante `SYSTEM_PROMPT`)
- `service-worker.js` met en cache les fichiers statiques pour le mode hors-ligne ; incrémenter `CACHE_NAME` après toute modification de `app.js`/`style.css` pour forcer la mise à jour côté utilisateurs (les appels `/api/*` ne sont jamais mis en cache)
