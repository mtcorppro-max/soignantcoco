-- 0121 : ajout du service « commercial » aux comptes « Personnel (autre fonction) ».
-- Étend la contrainte de la migration 0111 (marketing, rh, comptabilité,
-- logistique, informatique) avec la nouvelle valeur « commercial ».
alter table professionnel drop constraint if exists professionnel_service_check;
alter table professionnel add constraint professionnel_service_check
  check (service in ('marketing', 'rh', 'comptabilite', 'logistique', 'informatique', 'commercial'));
