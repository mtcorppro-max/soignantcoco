-- =====================================================================
-- 0059 — Délégué médical rattaché à plusieurs agences
--
-- Un délégué médical peut couvrir plusieurs agences. On stocke la liste
-- dans `agences` (tableau d'UUID). `agence_id` reste l'agence principale
-- (la première) pour la compatibilité (regroupements existants).
-- Les autres rôles continuent d'utiliser `agence_id` seul.
-- =====================================================================

alter table public.professionnel
  add column if not exists agences uuid[];
