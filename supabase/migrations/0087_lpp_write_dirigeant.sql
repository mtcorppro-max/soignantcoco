-- =====================================================================
-- 0087 — Édition du référentiel LPP par le dirigeant (écran d'admin tarifs)
--
-- En plus de la plateforme (niveau 0) et du magasinier, le dirigeant peut
-- éditer les tarifs/forfaits LPP depuis l'écran d'administration.
-- =====================================================================

drop policy if exists lpp_write on public.lpp;
create policy lpp_write on public.lpp for all
  using (public.current_niveau() = 0 or public.current_role_pro() in ('magasinier', 'dirigeant'))
  with check (public.current_niveau() = 0 or public.current_role_pro() in ('magasinier', 'dirigeant'));
