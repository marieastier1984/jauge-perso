# Jauge du système

App de suivi des signaux de fatigue / surchauffe / migraine, avec jauge visuelle, suggestions adaptées et historique daté.

## Contenu

- `index.html` — page principale
- `style.css` — styles
- `app.js` — logique (React, chargé via CDN + Babel standalone, pas de build nécessaire)
- `manifest.json` — manifeste PWA (icône, nom, mode standalone)
- `service-worker.js` — cache offline
- `icon-192.png`, `icon-512.png` — icônes de l'app

## Déploiement

Aucun build requis : ce sont des fichiers statiques.

### Option GitHub Pages

1. Crée un repo (ou un dossier dans un repo existant, ex. `jauge/`)
2. Pousse tous ces fichiers à la racine du repo (ou du dossier choisi)
3. Dans les Settings du repo → Pages → source = branche `main`, dossier `/` (ou `/jauge` si sous-dossier)
4. L'app sera accessible à `https://<utilisateur>.github.io/<repo>/`

### Option même pipeline que phecile.fr (FTP/OVH)

Réutilise le même workflow GitHub Actions avec `SamKirkland/FTP-Deploy-Action` : pointe `server-dir` vers le dossier de destination sur le serveur OVH, et copie l'ensemble de ces fichiers.

### Installation sur le téléphone

Une fois l'app accessible via une URL HTTPS :
- **iOS (Safari)** : ouvrir l'URL → bouton Partager → "Sur l'écran d'accueil"
- **Android (Chrome)** : ouvrir l'URL → menu ⋮ → "Ajouter à l'écran d'accueil" / "Installer l'application"

Le `manifest.json` + `service-worker.js` permettent l'installation en PWA et un fonctionnement hors-ligne une fois la première visite effectuée.

⚠️ Le service worker met en cache les fichiers locaux. Si tu modifies `app.js` ou `style.css` après déploiement, incrémente `CACHE_NAME` dans `service-worker.js` (ex. `jauge-cache-v2`) pour forcer la mise à jour côté utilisateurs.

## Données

Tout est stocké en local sur l'appareil (`localStorage`) :
- les signaux personnalisés que tu ajoutes
- l'historique des points enregistrés (date, niveau, signaux cochés)

Rien n'est envoyé sur un serveur. Si tu changes de téléphone ou vides les données du navigateur, l'historique est perdu (pas de synchronisation prévue pour l'instant).

## Fonctionnement

- Coche les signaux ressentis dans les 4 catégories (vert/jaune/orange/rouge)
- La jauge se positionne automatiquement sur le niveau le plus élevé coché
- Règle d'escalade : 3+ signaux cochés au même niveau (jaune ou orange) font monter la jauge d'un cran
- Des suggestions concrètes s'affichent selon le niveau (préserver / recharger / limiter les dégâts)
- "Enregistrer ce point" sauvegarde l'état actuel avec horodatage dans l'onglet Historique
- L'onglet Historique montre les statistiques par niveau et les signaux les plus fréquents
