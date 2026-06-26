-- =====================================================================
-- 0028 — Heures de début / fin pour les astreintes
--
-- Sur un événement de type astreinte, on précise l'heure de début et l'heure
-- de fin (ex. 18:00 → 08:00) en plus de la plage de dates.
-- =====================================================================

alter table public.evenement_planning
  add column if not exists heure_debut text,
  add column if not exists heure_fin   text;
