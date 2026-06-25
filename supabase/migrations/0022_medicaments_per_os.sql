-- =====================================================================
-- 0022 — Médicaments Per os à commander (structurés)
--
-- Remplace le texte libre par une liste structurée molécule + posologie :
--   [{ "nom": "Paracétamol", "posologie": "1 g x3/j" }, …]
-- =====================================================================

alter table public.professionnel
  add column if not exists medicaments_per_os jsonb;
