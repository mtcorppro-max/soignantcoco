-- =====================================================================
-- 0026 — Jours de suivi programmés du patient
--
-- Jours de suivi (ex. {1,3,5} = J1, J3, J5 après l'opération), déduits du
-- protocole du chirurgien choisi. Sert au calendrier de prise en charge
-- côté patient (visualisation des suivis programmés et fin de prise en charge).
-- =====================================================================

alter table public.patient
  add column if not exists jours_suivi int[];
