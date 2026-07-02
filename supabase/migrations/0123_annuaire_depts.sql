-- =====================================================================
-- 0123 — Annuaire santé : départements d'exercice (filtre de recherche)
--
-- Colonne depts = départements (2 premiers chiffres du CP) de tous les
-- lieux d'exercice, pour filtrer la recherche de la loupe par
-- département côté serveur. Remplie par le script d'import ; backfill
-- ci-dessous pour les fiches déjà importées.
-- =====================================================================

alter table public.annuaire_sante add column if not exists depts text[] not null default '{}';
create index if not exists idx_annuaire_sante_depts
  on public.annuaire_sante using gin (depts);

-- Backfill des fiches existantes depuis leurs sites.
update public.annuaire_sante a
   set depts = coalesce(
     (select array_agg(distinct left(s->>'cp', 2))
        from jsonb_array_elements(a.sites) s
       where coalesce(s->>'cp', '') <> ''),
     '{}'
   );
