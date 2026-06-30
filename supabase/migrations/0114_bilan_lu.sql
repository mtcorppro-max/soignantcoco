-- =====================================================================
-- 0114 — Accusé de lecture du bilan par le soignant
--
-- Quand l'infirmière a consulté le bilan, on note lu_le / lu_par ; le patient
-- voit alors « votre rapport a bien été reçu et lu par votre infirmière ».
-- =====================================================================

alter table public.bilan_etat
  add column if not exists lu_le  timestamptz,
  add column if not exists lu_par uuid references public.professionnel(id) on delete set null;

-- Le soignant (selon son périmètre) peut marquer le bilan comme lu.
drop policy if exists bilan_pro_update on public.bilan_etat;
create policy bilan_pro_update on public.bilan_etat for update
  using (public.peut_voir_patient(patient_id))
  with check (public.peut_voir_patient(patient_id));
