-- =====================================================================
-- 0005 — Nom des destinataires d'alerte
--
-- Associe un nom à chaque numéro d'alerte (n°1 principal, n°2 backup),
-- pour savoir qui est contacté lors d'une escalade. Facultatif (nullable).
--
-- À exécuter dans le SQL Editor de Supabase.
-- =====================================================================

alter table public.patient
  add column if not exists alerte_1_nom text,  -- nom du destinataire de l'alerte 1
  add column if not exists alerte_2_nom text;  -- nom du destinataire de l'alerte 2
