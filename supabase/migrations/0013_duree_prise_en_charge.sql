-- =====================================================================
-- 0013 — Durée de prise en charge
--
-- Nombre total de jours de prise en charge du patient. Permet de planifier
-- un suivi à J1 et au dernier jour (calculés depuis la date d'opération).
--
-- À exécuter dans le SQL Editor de Supabase.
-- =====================================================================

alter table public.patient
  add column if not exists duree_prise_en_charge int;
