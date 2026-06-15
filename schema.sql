-- =============================================================================
-- Jauge du système — schéma Neon
-- À exécuter dans l'éditeur SQL de Neon. Idempotent : peut être relancé sans
-- dupliquer les données (les inserts utilisent ON CONFLICT DO NOTHING, et le
-- delete ne touche que les anciens signaux non-personnalisés).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Historique des points enregistrés
-- -----------------------------------------------------------------------------

create table if not exists signaux_historique (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  niveau      text not null check (niveau in ('vert', 'jaune', 'orange', 'rouge')),
  signaux     jsonb not null default '[]'::jsonb,  -- tableau de libellés de signaux cochés
  triggers    jsonb not null default '[]'::jsonb   -- tableau de libellés de facteurs déclencheurs cochés
);

-- Si la table existait déjà sans la colonne triggers (mise à jour) :
alter table signaux_historique add column if not exists triggers jsonb not null default '[]'::jsonb;

create index if not exists idx_signaux_historique_created_at
  on signaux_historique (created_at desc);

-- -----------------------------------------------------------------------------
-- Définitions de signaux (catégories vert/jaune/orange/rouge)
-- Basé sur signal_reference : id stables, groupe thématique, niveau de
-- confiance. Une seule source de vérité, partagée entre tous les appareils.
-- -----------------------------------------------------------------------------

create table if not exists signaux_definitions (
  id          text primary key,           -- ex: "SIG_FAIM_DISPARUE", "custom-jaune-1718300000000"
  label       text not null,
  niveau      text not null check (niveau in ('vert', 'jaune', 'orange', 'rouge')),
  groupe      text,                        -- ex: "corps", "travail", "relationnel", "migraine"
  confiance   text check (confiance in ('faible', 'moyenne', 'forte', 'très forte')),
  star        int check (star between 1 and 3),
  custom      boolean not null default false,
  created_at  timestamptz not null default now(),
  position    int not null default 0       -- ordre d'affichage au sein du niveau
);

create index if not exists idx_signaux_definitions_niveau
  on signaux_definitions (niveau, position);

-- Si la table contient encore l'ancien jeu de données (signaux par défaut
-- non-custom), on les retire avant de réinsérer le nouveau référentiel.
-- Les signaux personnalisés (custom = true) sont conservés.
delete from signaux_definitions where custom = false;

insert into signaux_definitions (id, label, niveau, groupe, confiance, position)
values
  -- Vert (équilibre — pas de signal_reference dédié, on garde des repères positifs)
  ('SIG_TRANSITION_OK',  'Tu passes d''une activité à une autre sans difficulté', 'vert', 'corps', 'forte', 1),
  ('SIG_FAIM_OK',        'Tu manges quand tu as faim', 'vert', 'corps', 'forte', 2),
  ('SIG_ARRET_OK',       'Tu peux t''arrêter de travailler sans y retourner mentalement', 'vert', 'travail', 'forte', 3),
  ('SIG_RDV_OK',         'Les rendez-vous restent des rendez-vous', 'vert', 'relationnel', 'forte', 4),
  ('SIG_PLAISIR_OK',     'Tu fais vélo / tricot / photo / travail avec plaisir, sans obsession', 'vert', 'corps', 'forte', 5),

  -- Corps
  ('SIG_FAIM_DISPARUE',        'Je n''ai plus faim alors que j''ai peu mangé', 'jaune', 'corps', 'forte', 10),
  ('SIG_REPAS_REPOUSSE',       'Je repousse le repas', 'jaune', 'corps', 'forte', 11),
  ('SIG_OUBLI_BOIRE',          'J''oublie de boire', 'jaune', 'corps', 'forte', 12),
  ('SIG_FATIGUE_INHABITUELLE', 'Fatigue plus forte que l''effort fourni', 'jaune', 'corps', 'forte', 13),
  ('SIG_BOUCHE_SECHE',         'Bouche sèche inhabituelle', 'orange', 'corps', 'forte', 14),
  ('SIG_BESOIN_SIESTE',        'Besoin de sieste important', 'orange', 'corps', 'forte', 15),
  ('SIG_DOULEUR_OEIL',         'Douleur derrière un œil', 'orange', 'corps', 'forte', 16),
  ('SIG_EQUILIBRE_BIZARRE',    'Sensation d''équilibre perturbé', 'orange', 'corps', 'moyenne', 17),
  ('SIG_FROID_PARADOXAL',      'Sensation inhabituelle de froid', 'orange', 'corps', 'faible', 18),

  -- Travail / cognition
  ('SIG_ENCORE_5_MIN',         'Encore 5 minutes', 'jaune', 'travail', 'forte', 20),
  ('SIG_TRANSITION_DIFFICILE', 'Difficulté à changer d''activité', 'jaune', 'travail', 'forte', 21),
  ('SIG_VERIFICATION_TEL',     'Vérification fréquente du téléphone', 'jaune', 'travail', 'forte', 22),
  ('SIG_DECISION_IMPOSSIBLE',  'Tout paraît compliqué à décider', 'jaune', 'travail', 'moyenne', 23),
  ('SIG_TUNNEL',               'Je suis en tunnel', 'orange', 'travail', 'forte', 24),
  ('SIG_CERVEAU_CONTINUE',     'J''ai arrêté mais mon cerveau continue', 'orange', 'travail', 'très forte', 25),
  ('SIG_MANQUE_ARRET',         'Sensation de manque quand j''arrête', 'orange', 'travail', 'forte', 26),
  ('SIG_RETOUR_TRAVAIL',       'Envie de retourner travailler après avoir arrêté', 'orange', 'travail', 'forte', 27),
  ('SIG_HYPERFOCUS',           'Perte de notion du temps', 'orange', 'travail', 'forte', 28),

  -- Relationnel / émotionnel
  ('SIG_ATTENTE_RETOUR',     'Attente active d''une réponse', 'jaune', 'relationnel', 'très forte', 30),
  ('SIG_ON_MY_TOES',         'Je reste prête à réagir', 'orange', 'relationnel', 'très forte', 31),
  ('SIG_RYTHME_AUTRE',       'Mon énergie dépend du rythme de quelqu''un d''autre', 'orange', 'relationnel', 'forte', 32),
  ('SIG_PEUR_ERREUR',        'Qu''ai-je fait de mal ?', 'orange', 'relationnel', 'très forte', 33),
  ('SIG_RECHERCHE_CAUSE',    'Je cherche absolument une cause unique', 'orange', 'relationnel', 'forte', 34),
  ('SIG_IMPRESSION_URGENCE', 'Tout paraît urgent', 'orange', 'relationnel', 'moyenne', 35),

  -- Migraine
  ('SIG_MIGRAINE_REVEIL',   'Migraine au réveil', 'rouge', 'migraine', 'forte', 40),
  ('SIG_VOILE_VISUEL',      'Voile visuel', 'rouge', 'migraine', 'forte', 41),
  ('SIG_VOMISSEMENTS',      'Vomissements', 'rouge', 'migraine', 'forte', 42),
  ('SIG_DIARRHEE',          'Diarrhée associée', 'rouge', 'migraine', 'moyenne', 43),
  ('SIG_RELPAX_NECESSAIRE', 'Besoin de Relpax', 'rouge', 'migraine', 'forte', 44),
  ('SIG_ANNULATION_RDV',    'Obligation d''annuler', 'rouge', 'migraine', 'forte', 45)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Facteurs déclencheurs probables (triggers_probables)
-- Référentiel + ajouts personnels. Cochés dans l'historique comme les signaux,
-- mais sans couleur/niveau associé.
-- -----------------------------------------------------------------------------

create table if not exists triggers_definitions (
  id          text primary key,           -- ex: "TRG_METEO", "custom-1718300000000"
  label       text not null,
  confiance   text check (confiance in ('faible', 'moyenne', 'forte', 'très forte')),
  custom      boolean not null default false,
  created_at  timestamptz not null default now(),
  position    int not null default 0
);

create index if not exists idx_triggers_definitions_position
  on triggers_definitions (position);

delete from triggers_definitions where custom = false;

insert into triggers_definitions (id, label, confiance, position) values
  ('TRG_METEO',           'Changement météo', 'forte', 1),
  ('TRG_CHALEUR',         'Chaleur', 'forte', 2),
  ('TRG_ACCUMULATION',    'Accumulation de fatigue', 'forte', 3),
  ('TRG_DECOMPRESSION',   'Décompression après une période intense', 'forte', 4),
  ('TRG_HYPERFOCUS_LONG', 'Hyperfocus prolongé', 'moyenne', 5),
  ('TRG_STRESS_EMOTION',  'Stress émotionnel (deuil, inquiétude…)', 'moyenne', 6),
  ('TRG_LONG_VOYAGE',     'Long voyage', 'moyenne', 7),
  ('TRG_EFFORT_CHALEUR',  'Effort physique + chaleur', 'moyenne', 8)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Actions suggérées par niveau (remplace les listes statiques de "SUGGESTIONS")
-- -----------------------------------------------------------------------------

create table if not exists actions_reference (
  id          text primary key,    -- ex: "ACT_BOIRE"
  label       text not null,
  niveau      text not null check (niveau in ('jaune', 'orange', 'rouge')),
  cout        int,                 -- coût énergétique estimé (1 = très léger, 2 = léger), null pour rouge
  position    int not null default 0
);

insert into actions_reference (id, label, niveau, cout, position) values
  -- Jaune : préserver
  ('ACT_BOIRE',              'Boire immédiatement un verre d''eau', 'jaune', 1, 1),
  ('ACT_MANGER_SIMPLE',      'Manger quelque chose sans cuisiner', 'jaune', 1, 2),
  ('ACT_TIMER_20',           'Mettre un timer de 20 minutes', 'jaune', 1, 3),
  ('ACT_CHECK_BESOINS',      'Vérifier faim / soif / fatigue', 'jaune', 1, 4),
  ('ACT_REPORTER_UNE_TACHE', 'Reporter une tâche non critique', 'jaune', 2, 5),
  ('ACT_REDUIRE_STIMULI',    'Fermer une source de stimulation', 'jaune', 1, 6),
  ('ACT_SORTIE_10MIN',       'Petite marche sans objectif', 'jaune', 2, 7),

  -- Orange : recharger
  ('ACT_LIRE_LIT',            'Lire au lit', 'orange', 1, 1),
  ('ACT_SIESTE',              'Faire une sieste', 'orange', 1, 2),
  ('ACT_VELO_DOUX',           'Vélo balade sans objectif', 'orange', 2, 3),
  ('ACT_PHOTO_SANS_RESULTAT', 'Sortie photo sans chercher LA photo', 'orange', 2, 4),
  ('ACT_CHAUD_CALME',         'Thé, plaid, calme', 'orange', 1, 5),
  ('ACT_NOTE_PARKING',        'Noter les pensées pour demain', 'orange', 1, 6),
  ('ACT_COUPER_NOTIFICATION', 'Couper les notifications 1h', 'orange', 1, 7),
  ('ACT_CONTACT_SECURISANT',  'Échanger avec quelqu''un où tu n''as rien à prouver', 'orange', 2, 8),

  -- Rouge : crise
  ('ACT_RELPAX',          'Relpax selon protocole', 'rouge', null, 1),
  ('ACT_NOIR_CALME',      'Pièce sombre et calme', 'rouge', null, 2),
  ('ACT_DORMIR',          'Dormir', 'rouge', null, 3),
  ('ACT_ANNULER',         'Annuler ce qui doit l''être', 'rouge', null, 4),
  ('ACT_PETITES_GORGEES', 'Boire par petites gorgées', 'rouge', null, 5),
  ('ACT_PAS_ANALYSER',    'Reporter l''analyse au lendemain', 'rouge', null, 6)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Activités de recharge : ce qui recharge vraiment vs ce qui y ressemble
-- -----------------------------------------------------------------------------

create table if not exists recharge_effective (
  id          serial primary key,
  activite    text not null unique,
  efficace    boolean not null,     -- true = "recharge vraiment", false = "ressemble à du repos mais recharge peu"
  confiance   text check (confiance in ('faible', 'faible à moyenne', 'moyenne', 'forte')),
  position    int not null default 0
);

insert into recharge_effective (activite, efficace, confiance, position) values
  -- Recharge vraiment
  ('Dormir', true, 'forte', 1),
  ('Lire dans le lit', true, 'forte', 2),
  ('Vélo vécu comme une aventure', true, 'moyenne', 3),
  ('Tricot tranquille sans pression de finir', true, 'moyenne', 4),
  ('Discussion sincère avec quelqu''un de confiance', true, 'moyenne', 5),
  ('Sortie photo sans objectif de performance', true, 'faible à moyenne', 6),
  ('Temps avec Mémé (historiquement)', true, 'moyenne', 7),

  -- Ressemble à du repos mais recharge peu
  ('Série + téléphone', false, null, 10),
  ('Série + travail dans la tête', false, null, 11),
  ('Tricot + surveillance du téléphone', false, null, 12),
  ('Pause où tu attends un message', false, null, 13),
  ('Réseaux sociaux en mode automatique', false, null, 14),
  ('Chercher la solution parfaite', false, null, 15),
  ('Optimiser ton avenir à 22h30', false, null, 16)
on conflict (activite) do nothing;

-- -----------------------------------------------------------------------------
-- Phrases anti-culpabilité
-- -----------------------------------------------------------------------------

create table if not exists phrases_anti_culpabilite (
  id      text primary key,   -- ex: "PAC_001"
  phrase  text not null
);

insert into phrases_anti_culpabilite (id, phrase) values
  ('PAC_001', 'Ce n''est pas une faute, c''est un seuil.'),
  ('PAC_002', 'Mon corps ne me punit pas, il me renseigne.'),
  ('PAC_003', 'Je peux être fatiguée sans avoir mal géré.'),
  ('PAC_004', 'Comprendre n''est pas obligatoire aujourd''hui.'),
  ('PAC_005', 'Réduire la dépense d''énergie est une action utile.'),
  ('PAC_006', 'Je n''ai pas besoin d''optimiser ma récupération pour récupérer.')
on conflict (id) do nothing;
