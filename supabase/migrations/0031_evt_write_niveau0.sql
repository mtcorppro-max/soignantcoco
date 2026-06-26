-- =====================================================================
-- 0031 — Écriture du planning : autoriser le niveau 0 (super-admin)
--
-- La policy d'origine (0027) n'autorisait que coordinatrice ou niveau 1,
-- ce qui bloquait silencieusement les insertions d'un niveau 0.
-- On autorise : niveau 0 (partout) OU, dans son prestataire, coordinatrice/niveau ≤ 1.
-- Idem pour la table de liaison patient_soignant.
-- =====================================================================

drop policy if exists evt_write_gestion on public.evenement_planning;
create policy evt_write_gestion on public.evenement_planning for all
  using (
    public.current_niveau() = 0
    or (prestataire_id = public.current_prestataire_id()
        and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() <= 1))
  )
  with check (
    public.current_niveau() = 0
    or (prestataire_id = public.current_prestataire_id()
        and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() <= 1))
  );

drop policy if exists ps_write_gestion on public.patient_soignant;
create policy ps_write_gestion on public.patient_soignant for all
  using (
    public.current_niveau() = 0
    or (public.patient_dans_mon_prestataire(patient_id)
        and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() <= 1))
  )
  with check (
    public.current_niveau() = 0
    or (public.patient_dans_mon_prestataire(patient_id)
        and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() <= 1))
  );
