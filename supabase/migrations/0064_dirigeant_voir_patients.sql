-- =====================================================================
-- 0064 — Vue nationale du dirigeant pour la PEC
--
-- Le dirigeant voit TOUS les patients de son prestataire (toutes régions /
-- agences), sans niveau d'accès opérationnel. Cela alimente sa PEC à
-- l'échelle nationale. Les autres lectures dont la PEC a besoin
-- (professionnel, agence, patient_soignant) sont déjà au périmètre
-- prestataire entier.
--
-- À exécuter APRÈS 0063 (le rôle 'dirigeant' doit exister).
-- =====================================================================

create or replace function public.peut_voir_patient(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    -- Niveau 0 : super-admin plateforme, voit tout (tous prestataires)
    when public.current_niveau() = 0 then true
    else exists (
      select 1
      from public.patient pa
      left join public.agence ag on ag.id = pa.agence_id
      where pa.id = p
        and pa.prestataire_id = public.current_prestataire_id()   -- cloisonné par prestataire
        and (
          -- Dirigeant : vue nationale = tout le prestataire
          public.current_role_pro() = 'dirigeant'
          or (public.current_niveau() = 1 and ag.region_id = public.current_region_id())
          or (public.current_niveau() = 2 and pa.agence_id = public.current_agence_id())
          or (public.current_niveau() = 3 and exists (
                select 1 from public.patient_soignant ps
                 where ps.patient_id = p
                   and ps.professionnel_id = public.current_professionnel_id()
             ))
        )
    )
  end
$$;
