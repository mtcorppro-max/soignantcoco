-- =====================================================================
-- 0066 — Corrige le cloisonnement de LECTURE des patients
--
-- BUG : la policy `patient_write_coord` était en `for all`. Son `using`
-- (prestataire entier + rôle coordinatrice) s'appliquait donc AUSSI au
-- SELECT. Les policies étant permissives (OR), une coordinatrice voyait
-- TOUS les patients de son prestataire (toutes agences / régions),
-- court-circuitant le cloisonnement par agence de `peut_voir_patient`.
--
-- Correctif : on supprime le `for all` et on le remplace par des policies
-- d'écriture dédiées qui n'élargissent PAS la visibilité en lecture.
-- La lecture reste régie uniquement par `patient_select_pro`
-- (= peut_voir_patient) et `patient_select_self`.
-- =====================================================================

-- 1) Retire la policy fautive (couvrait SELECT via son USING).
drop policy if exists patient_write_coord on public.patient;

-- 2) INSERT : une coordinatrice crée un patient dans son prestataire.
drop policy if exists patient_insert_coord on public.patient;
create policy patient_insert_coord on public.patient for insert
  with check (
    prestataire_id = public.current_prestataire_id()
    and public.current_role_pro() = 'coordinatrice'
  );

-- 3) DELETE : une coordinatrice supprime un patient de son périmètre.
drop policy if exists patient_delete_coord on public.patient;
create policy patient_delete_coord on public.patient for delete
  using (
    public.current_role_pro() = 'coordinatrice'
    and public.peut_voir_patient(id)
  );

-- 4) UPDATE : cloisonné au périmètre (agence/région/rattachement) au lieu
--    du prestataire entier. Toute édition se fait depuis la fiche patient,
--    qu'on ne peut ouvrir que si peut_voir_patient est déjà vrai → aucun
--    flux légitime cassé.
drop policy if exists patient_update_pro on public.patient;
create policy patient_update_pro on public.patient for update
  using (public.peut_voir_patient(id))
  with check (public.peut_voir_patient(id));
