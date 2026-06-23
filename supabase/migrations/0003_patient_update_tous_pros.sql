-- =====================================================================
-- 0003 — Modification de la fiche patient par tous les professionnels
--
-- Jusqu'ici seule la coordinatrice pouvait écrire sur `patient`
-- (politique patient_write_coord, for all). On autorise désormais TOUS
-- les professionnels du prestataire (coordinatrice, chirurgien, délégué)
-- à mettre à jour les coordonnées et contacts du patient.
--
-- Les politiques étant permissives (OR), cette nouvelle règle UPDATE
-- s'ajoute à l'existante : l'insertion/suppression reste réservée à la
-- coordinatrice, mais la mise à jour devient accessible à toute l'équipe.
--
-- À exécuter dans le SQL Editor de Supabase.
-- =====================================================================

create policy patient_update_pro on public.patient for update
  using (prestataire_id = public.current_prestataire_id())
  with check (prestataire_id = public.current_prestataire_id());
