-- =====================================================================
-- 0085 — Famille de forfait (perfusion / NEAD / NPAD)
--
-- Permet de choisir d'abord la famille, puis le forfait, au lieu de
-- parcourir tous les codes LPP. Renseignée par seed_forfaits.sql.
--   perfusion = perfusion à domicile (PERFADOM)
--   nead      = nutrition entérale à domicile
--   npad      = nutrition parentérale à domicile
-- À exécuter avant de rejouer seed_forfaits.sql.
-- =====================================================================

alter table public.lpp add column if not exists famille text;
create index if not exists idx_lpp_famille on public.lpp (famille);
