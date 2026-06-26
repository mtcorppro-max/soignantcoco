-- =====================================================================
-- 0040 — Soignants externes (sans compte AS2CŒUR)
--
-- Médecins / chirurgiens / infirmières libérales hors entreprise, enregistrés
-- comme référence (pas de compte de connexion). Réutilisables dans les fiches
-- patient (sélecteur chirurgien/médecin et infirmière libérale).
--   type = 'medecin'    -> médecin / chirurgien (avec spécialité)
--   type = 'infirmiere' -> infirmière libérale (avec zone d'exercice)
-- =====================================================================

create table if not exists public.soignant_externe (
  id             uuid primary key default gen_random_uuid(),
  prestataire_id uuid not null references public.prestataire(id) on delete cascade,
  type           text not null check (type in ('medecin', 'infirmiere')),
  titre          text,
  prenom         text,
  nom            text not null,
  specialite     text,
  telephone      text,
  email          text,
  zone_exercice  text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_soignant_externe_presta on public.soignant_externe (prestataire_id);

alter table public.soignant_externe enable row level security;

drop policy if exists se_select on public.soignant_externe;
create policy se_select on public.soignant_externe for select
  using (public.current_niveau() = 0 or prestataire_id = public.current_prestataire_id());

drop policy if exists se_write on public.soignant_externe;
create policy se_write on public.soignant_externe for all
  using (public.current_niveau() = 0 or prestataire_id = public.current_prestataire_id())
  with check (public.current_niveau() = 0 or prestataire_id = public.current_prestataire_id());
