-- Table d'historique des points enregistrés dans la Jauge du système
-- À exécuter une fois dans la console SQL de Neon (ou via psql)

create table if not exists signaux_historique (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  niveau      text not null check (niveau in ('vert', 'jaune', 'orange', 'rouge')),
  signaux     jsonb not null default '[]'::jsonb  -- tableau de libellés de signaux cochés
);

create index if not exists idx_signaux_historique_created_at
  on signaux_historique (created_at desc);
