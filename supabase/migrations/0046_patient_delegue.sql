-- =====================================================================
-- 0046 — Délégué médical rattaché au patient
-- =====================================================================

alter table public.patient
  add column if not exists delegue_nom text;
