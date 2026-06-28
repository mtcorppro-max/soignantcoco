-- =====================================================================
-- SEED — Régions & Agences (carte de France)
--
-- Crée les 12 régions et les 40 agences correspondant aux villes de la
-- carte. Languedoc-Roussillon est remplacé par « Occitanie ».
--
-- À exécuter dans le SQL Editor de Supabase.
-- Idempotent : ne recrée pas une région / agence déjà présente.
--
-- ⚠️ Le script cible le PREMIER prestataire (le plus ancien). Si tu as
--    plusieurs entreprises, décommente le filtre `where nom = '...'`
--    dans le bloc `presta` ci-dessous.
-- =====================================================================

with presta as (
  select id from public.prestataire
  -- where nom = 'AS2CŒUR'        -- 👈 décommente/adapte si plusieurs prestataires
  order by created_at
  limit 1
),

-- 1) Régions manquantes pour ce prestataire
reg_ins as (
  insert into public.region (prestataire_id, nom)
  select presta.id, v.nom
  from presta
  cross join (values
    ('Bretagne'),
    ('Pays de la Loire'),
    ('Centre-Val de Loire'),
    ('Normandie'),
    ('Hauts-de-France'),
    ('Île-de-France'),
    ('Grand Est'),
    ('Bourgogne-Franche-Comté'),
    ('Auvergne-Rhône-Alpes'),
    ('Nouvelle-Aquitaine'),
    ('Occitanie'),
    ('Provence-Alpes-Côte d''Azur')
  ) as v(nom)
  where not exists (
    select 1 from public.region r
    where r.prestataire_id = presta.id and r.nom = v.nom
  )
  returning id, nom
),

-- Régions effectives = nouvellement créées + déjà existantes
reg_all as (
  select id, nom from reg_ins
  union
  select r.id, r.nom
  from public.region r, presta
  where r.prestataire_id = presta.id
)

-- 2) Agences manquantes, rattachées à leur région par le nom
insert into public.agence (region_id, nom)
select reg_all.id, v.nom
from (values
  ('Bretagne','Brest'),
  ('Bretagne','Saint-Brieuc'),
  ('Bretagne','Rennes'),
  ('Pays de la Loire','Nantes'),
  ('Pays de la Loire','Angers'),
  ('Centre-Val de Loire','Tours'),
  ('Centre-Val de Loire','Montargis'),
  ('Normandie','Caen'),
  ('Normandie','Rouen'),
  ('Hauts-de-France','Boulogne-sur-Mer'),
  ('Hauts-de-France','Lille'),
  ('Hauts-de-France','Amiens'),
  ('Île-de-France','Paris'),
  ('Grand Est','Reims'),
  ('Grand Est','Troyes'),
  ('Grand Est','Metz'),
  ('Grand Est','Nancy'),
  ('Grand Est','Strasbourg'),
  ('Grand Est','Mulhouse'),
  ('Bourgogne-Franche-Comté','Nevers'),
  ('Bourgogne-Franche-Comté','Dijon'),
  ('Bourgogne-Franche-Comté','Chalon-sur-Saône'),
  ('Bourgogne-Franche-Comté','Besançon'),
  ('Auvergne-Rhône-Alpes','Clermont-Ferrand'),
  ('Auvergne-Rhône-Alpes','Saint-Étienne'),
  ('Auvergne-Rhône-Alpes','Lyon'),
  ('Auvergne-Rhône-Alpes','Chambéry'),
  ('Auvergne-Rhône-Alpes','Grenoble'),
  ('Nouvelle-Aquitaine','Bordeaux'),
  ('Nouvelle-Aquitaine','Brive-la-Gaillarde'),
  ('Nouvelle-Aquitaine','Agen'),
  ('Occitanie','Tarbes'),
  ('Occitanie','Toulouse'),
  ('Occitanie','Montpellier'),
  ('Occitanie','Perpignan'),
  ('Provence-Alpes-Côte d''Azur','Avignon'),
  ('Provence-Alpes-Côte d''Azur','Manosque'),
  ('Provence-Alpes-Côte d''Azur','Aix-en-Provence'),
  ('Provence-Alpes-Côte d''Azur','Nice'),
  ('Provence-Alpes-Côte d''Azur','Toulon')
) as v(region, nom)
join reg_all on reg_all.nom = v.region
where not exists (
  select 1 from public.agence a
  where a.region_id = reg_all.id and a.nom = v.nom
);
