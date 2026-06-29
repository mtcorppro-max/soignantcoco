-- =====================================================================
-- 0065 — Livraisons : l'infirmière libérale programme pour SES patients
--
-- En plus des règles 0060, une infirmière libérale peut lire et programmer
-- les livraisons des patients qu'elle suit (peut_voir_patient = rattachés).
-- Elle peut désigner le livreur (livreur_id renseigné lors de la
-- programmation) ; c'est contrôlé applicativement (livreur ou coordinatrice
-- de l'agence).
-- =====================================================================

drop policy if exists livraison_select on public.livraison;
create policy livraison_select on public.livraison for select
  using (
    public.current_niveau() = 0
    or livreur_id = public.current_professionnel_id()
    or (prestataire_id = public.current_prestataire_id()
        and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() <= 1))
    or (public.current_role_pro() = 'livreur' and public.peut_voir_patient(patient_id))
    or (public.current_role_pro() = 'infirmiere_liberale' and public.peut_voir_patient(patient_id))
  );

drop policy if exists livraison_write on public.livraison;
create policy livraison_write on public.livraison for all
  using (
    public.current_niveau() = 0
    or livreur_id = public.current_professionnel_id()
    or (prestataire_id = public.current_prestataire_id()
        and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() <= 1))
    or (public.current_role_pro() = 'livreur' and public.peut_voir_patient(patient_id))
    or (public.current_role_pro() = 'infirmiere_liberale' and public.peut_voir_patient(patient_id))
  )
  with check (
    public.current_niveau() = 0
    or (prestataire_id = public.current_prestataire_id()
        and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() <= 1))
    or (public.current_role_pro() = 'livreur'
        and livreur_id = public.current_professionnel_id()
        and public.peut_voir_patient(patient_id))
    or (public.current_role_pro() = 'infirmiere_liberale'
        and prestataire_id = public.current_prestataire_id()
        and public.peut_voir_patient(patient_id))
  );
