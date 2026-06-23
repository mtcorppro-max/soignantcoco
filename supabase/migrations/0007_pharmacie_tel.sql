-- =====================================================================
-- 0007 — Téléphone de la pharmacie
--
-- Ajoute le numéro de téléphone de la pharmacie de retrait des médicaments.
-- Facultatif (nullable).
--
-- À exécuter dans le SQL Editor de Supabase.
-- =====================================================================

alter table public.patient
  add column if not exists pharmacie_tel text;  -- tél. de la pharmacie
