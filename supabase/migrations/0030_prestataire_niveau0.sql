-- =====================================================================
-- 0030 — Le niveau 0 (super-admin plateforme) gère les prestataires
--
-- Permet à un niveau 0 (hors prestataire) de lister tous les prestataires
-- (pour y rattacher des régions) et d'en créer.
-- =====================================================================

drop policy if exists presta_select_admin on public.prestataire;
create policy presta_select_admin on public.prestataire for select
  using (public.current_niveau() = 0);

drop policy if exists presta_write_admin on public.prestataire;
create policy presta_write_admin on public.prestataire for all
  using (public.current_niveau() = 0)
  with check (public.current_niveau() = 0);
