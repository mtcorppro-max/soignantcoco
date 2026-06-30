-- =====================================================================
-- 0110 — Date de naissance du professionnel (rappel d'anniversaire interne)
--
-- Sert au rappel d'anniversaire : les comptes INTERNES de la MÊME RÉGION sont
-- prévenus le jour J. (Lecture déjà autorisée par pro_select dans le prestataire.)
-- =====================================================================

alter table public.professionnel
  add column if not exists date_naissance date;
