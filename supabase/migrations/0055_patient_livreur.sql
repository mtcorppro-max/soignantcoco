-- =====================================================================
-- 0055 — Livreur rattaché au patient
--
-- Nom du livreur (compte role = 'livreur') affecté au patient. Le
-- rattachement effectif passe par patient_soignant (comme l'infirmière) ;
-- ce champ sert à l'affichage et au pré-remplissage du sélecteur.
-- =====================================================================

alter table public.patient
  add column if not exists livreur_nom text;
