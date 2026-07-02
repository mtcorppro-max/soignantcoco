-- =====================================================================
-- 0122 — Annuaire santé national (Open Data RPPS, Licence Ouverte)
--
-- Base de référence des professionnels de santé importée depuis
-- l'annuaire santé officiel (fichier PS_LibreAcces) : médecins,
-- infirmiers, pharmaciens. Permet de rechercher n'importe quel PS de
-- France via la loupe, de consulter/compléter sa fiche, de le rattacher
-- à un patient (via soignant_externe) ou de lui créer un compte
-- pré-rempli.
--
--   - rpps  : clé unique (upsert à l'import, pas de doublon)
--   - sites : lieux d'exercice multiples [{rs, adresse, cp, commune, tel}]
--   - champs complémentaires éditables par les équipes (email, secrétariat…)
--
-- Alimentée UNIQUEMENT par le script scripts/import-annuaire.mjs
-- (service_role) : pas de policy insert/delete côté client.
-- Conformité : source publique officielle ; toute demande de
-- rectification/suppression d'un PS est traitée via l'édition/suppression
-- de sa fiche (RGPD).
-- =====================================================================

create table if not exists public.annuaire_sante (
  rpps              text primary key,
  type              text not null check (type in ('medecin', 'infirmiere', 'pharmacie')),
  civilite          text,          -- Docteur / Professeur…
  nom               text not null,
  prenom            text,
  profession        text,          -- libellé officiel (Médecin, Infirmier, Pharmacien)
  specialite        text,          -- savoir-faire RPPS (Cardiologie…)
  mode_exercice     text,          -- Libéral / Salarié / Bénévole
  sites             jsonb not null default '[]'::jsonb,
  -- Champs complémentaires (non fournis par l'annuaire, saisis par l'équipe)
  telephone         text,
  email             text,
  secretariat_nom   text,
  secretariat_email text,
  secretariat_tel   text,
  notes             text,
  source            text not null default 'annuaire',
  importe_le        timestamptz not null default now(),
  modifie_le        timestamptz
);

-- Recherche par nom/prénom (ilike '%…%') : index trigram.
create extension if not exists pg_trgm;
create index if not exists idx_annuaire_sante_nom_trgm
  on public.annuaire_sante using gin ((nom || ' ' || coalesce(prenom, '')) gin_trgm_ops);
create index if not exists idx_annuaire_sante_type on public.annuaire_sante (type);

alter table public.annuaire_sante enable row level security;

-- Lecture : tout professionnel connecté (annuaire partagé, pas les patients).
drop policy if exists annuaire_select on public.annuaire_sante;
create policy annuaire_select on public.annuaire_sante for select
  using (public.current_niveau() = 0 or public.current_prestataire_id() is not null);

-- Mise à jour (compléter/corriger une fiche) : tout professionnel connecté.
drop policy if exists annuaire_update on public.annuaire_sante;
create policy annuaire_update on public.annuaire_sante for update
  using (public.current_niveau() = 0 or public.current_prestataire_id() is not null)
  with check (public.current_niveau() = 0 or public.current_prestataire_id() is not null);

-- Insert/delete : réservés au service_role (script d'import) — aucune policy.
