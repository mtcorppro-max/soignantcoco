-- =====================================================================
-- 0042 — Cabinets & secrétariat des soignants externes (médecin/chirurgien)
-- Mêmes coordonnées que les comptes chirurgien/médecin.
-- =====================================================================

alter table public.soignant_externe
  add column if not exists cabinets         text,
  add column if not exists secretariat_nom   text,
  add column if not exists secretariat_email text,
  add column if not exists secretariat_tel   text;
