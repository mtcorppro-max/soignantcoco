-- =====================================================================
-- 0056 — Livraisons (tournée du livreur)
--
-- Une livraison = un patient rattaché à un livreur. Le livreur planifie
-- lui-même sa date de livraison (date_prevue) et marque « livrée ».
--   statut : a_planifier -> planifiee -> livree
-- Une seule livraison par (patient, livreur).
-- =====================================================================

create table if not exists public.livraison (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references public.patient(id) on delete cascade,
  livreur_id     uuid not null references public.professionnel(id) on delete cascade,
  prestataire_id uuid not null references public.prestataire(id) on delete cascade,
  date_prevue    date,
  statut         text not null default 'a_planifier' check (statut in ('a_planifier', 'planifiee', 'livree')),
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (patient_id, livreur_id)
);
create index if not exists idx_livraison_livreur on public.livraison (livreur_id);
create index if not exists idx_livraison_patient on public.livraison (patient_id);

alter table public.livraison enable row level security;

-- Lecture : le livreur concerné, la coordinatrice / le manager du prestataire,
-- ou la plateforme (niveau 0).
drop policy if exists livraison_select on public.livraison;
create policy livraison_select on public.livraison for select
  using (
    public.current_niveau() = 0
    or livreur_id = public.current_professionnel_id()
    or (prestataire_id = public.current_prestataire_id()
        and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() <= 1))
  );

-- Écriture : le livreur concerné (sur un patient qu'il peut voir),
-- la coordinatrice / le manager du prestataire, ou la plateforme.
drop policy if exists livraison_write on public.livraison;
create policy livraison_write on public.livraison for all
  using (
    public.current_niveau() = 0
    or livreur_id = public.current_professionnel_id()
    or (prestataire_id = public.current_prestataire_id()
        and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() <= 1))
  )
  with check (
    public.current_niveau() = 0
    or (livreur_id = public.current_professionnel_id() and public.peut_voir_patient(patient_id))
    or (prestataire_id = public.current_prestataire_id()
        and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() <= 1))
  );
