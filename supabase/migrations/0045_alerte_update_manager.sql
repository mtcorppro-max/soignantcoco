-- =====================================================================
-- 0045 — Traitement des alertes : coordinatrice + manager (+ plateforme)
-- Le manager agit comme une infirmière coordinatrice.
-- =====================================================================

drop policy if exists alerte_update_coord on public.alerte;
create policy alerte_update_coord on public.alerte for update
  using (
    public.current_niveau() = 0
    or (public.patient_dans_mon_prestataire(patient_id) and public.current_role_pro() in ('coordinatrice', 'manager'))
  )
  with check (
    public.current_niveau() = 0
    or (public.patient_dans_mon_prestataire(patient_id) and public.current_role_pro() in ('coordinatrice', 'manager'))
  );
