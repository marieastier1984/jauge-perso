# Backlog — Jauge du système

## Saisie libre comme entrée principale (signaux + déclencheurs)

Idée : permettre de décrire en une phrase libre ce qui se passe ("j'ai mal derrière l'œil,
j'ai oublié de manger et il fait super chaud"), et que l'IA :
- identifie le ou les signaux correspondants (parmi `signaux_definitions`, ou en crée
  de nouveaux si rien ne correspond)
- identifie le ou les facteurs déclencheurs correspondants (parmi `triggers_definitions`,
  idem)
- pré-coche tout ça automatiquement, avec une étape de confirmation/ajustement avant
  d'enregistrer

Impact UI : les listes de chips (signaux + déclencheurs) deviendraient secondaires —
affichées seulement à la demande ("voir/modifier le détail"), ou seulement si l'IA n'a
rien trouvé de pertinent. Le champ "Décrire un signal" actuel (qui ne gère qu'un signal
à la fois, niveau seul) serait remplacé/élargi par ce flux.

Points à trancher avant implémentation :
- un seul appel IA qui retourne signaux + déclencheurs + niveau global en une fois,
  plutôt que des appels séparés
- gérer le cas où l'IA propose un signal/déclencheur proche d'un existant mais pas
  identique (suggérer un rapprochement plutôt que dupliquer)
- garder la possibilité de cocher manuellement pour les jours où décrire est plus
  coûteux que cocher

## Apprentissage des suggestions (quoi fonctionne / quoi pas)

Capturer un feedback léger sur les suggestions affichées ("ça a aidé" / "pas vraiment"),
stocké avec le point d'historique. Permettrait à terme de pondérer/réordonner les
actions et activités de recharge proposées selon ce qui a fonctionné par le passé.

## Intégration Garmin (Body Battery, sommeil, FC/stress) + corrélations

Objectif : enrichir l'historique avec des données objectives Garmin (Body Battery,
score de sommeil, fréquence cardiaque au repos, niveau de stress mesuré), et faire
ressortir des corrélations avec les signaux/déclencheurs/niveaux saisis manuellement
(ex. "les jours où le Body Battery du matin est bas, le niveau jaune/orange est coché
plus souvent dans les 24h").

### Étape 0 — accès aux données (bloquant, à faire avant tout code)
Garmin n'a pas d'API publique en libre accès. Options à évaluer :
- **Garmin Connect Developer Program** : accès officiel, sur demande, validation par
  Garmin (délai incertain). Le plus pérenne mais le moins rapide à obtenir.
- **Terra API / Spike API** : agrégateurs tiers qui gèrent la connexion à Garmin (et
  d'autres montres). Plus rapides à mettre en place, mais payants au-delà d'un usage
  gratuit limité — à vérifier les tarifs/quotas avant de s'engager.
- **Export manuel périodique** (fallback) : Garmin Connect permet d'exporter des
  données ; un import manuel/CSV pourrait être une première étape low-tech pour
  tester la valeur des corrélations avant d'investir dans une intégration live.

### Étape 1 — stockage
Nouvelle table `donnees_garmin` (ou `donnees_externes` plus générique si on imagine
d'autres sources type Apple Health) : date, body_battery, score_sommeil, fc_repos,
stress, etc. Une ligne par jour.

### Étape 2 — affichage informatif
Avant les corrélations, un simple affichage des données du jour à côté de la jauge
(déjà utile en soi, et permet de vérifier que les données importées sont cohérentes).

### Étape 3 — corrélations
Analyse croisant `signaux_historique` (niveaux, signaux, déclencheurs, dates) et
`donnees_garmin` sur une fenêtre glissante (ex. J-1/J/J+1). Probablement via un appel
IA périodique (résumé hebdo) plutôt qu'un calcul statistique en temps réel — à
trancher selon le volume de données disponible.

Dépend de : avoir un historique conséquent (plusieurs semaines/mois) pour que les
corrélations aient du sens.

## Patterns personnels (table `patterns_personnels`)

Détection de séquences dans le temps à partir de l'historique (signaux + déclencheurs +
niveau, datés) : ex. "attente d'une réponse → vigilance diffuse → fatigue",
"hyperfocus → repas repoussés → migraine". Nécessite une vue "tendances" qui analyse
plusieurs jours d'historique, probablement via un appel IA périodique ou à la demande
plutôt qu'en temps réel.
