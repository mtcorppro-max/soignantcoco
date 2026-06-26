-- =====================================================================
-- 0041 — Protocoles des soignants externes (médecin / chirurgien)
--
-- Même questionnaire de protocoles que les comptes chirurgien/médecin :
-- interventions, molécules, constantes à surveiller, soins, etc.
-- =====================================================================

alter table public.soignant_externe
  add column if not exists protocoles jsonb not null default '[]'::jsonb;
