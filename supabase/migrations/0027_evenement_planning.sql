-- =====================================================================
-- 0027 — Planning des coordinatrices (événements typés)
--
-- Une ligne par coordinatrice dans le calendrier d'organisation.
-- Chaque événement a un type (astreinte, congés, arrêt maladie, formation,
-- autre), une plage de dates, et un remplaçant éventuel (vers qui rerouter
-- les alertes / suivis / tâches pendant l'absence — effectif avec le module SMS).
-- =====================================================================

create table if not exists public.evenement_planning (
  id               uuid primary key default gen_random_uuid(),
  prestataire_id   uuid not null references public.prestataire(id) on delete cascade,
  professionnel_id uuid not null references public.professionnel(id) on delete cascade,
  type             text not null check (type in ('astreinte','conges','arret_maladie','formation','autre')),
  date_debut       date not null,
  date_fin         date not null,
  remplacant_id    uuid references public.professionnel(id) on delete set null,
  note             text,
  created_at       timestamptz not null default now()
);

create index if not exists idx_evt_planning_presta on public.evenement_planning (prestataire_id, date_debut);
create index if not exists idx_evt_planning_pro on public.evenement_planning (professionnel_id);

alter table public.evenement_planning enable row level security;

-- Lecture : tous les pros du prestataire
drop policy if exists evt_select_pro on public.evenement_planning;
create policy evt_select_pro on public.evenement_planning for select
  using (prestataire_id = public.current_prestataire_id());

-- Écriture : coordinatrice ou compte de niveau 1 du prestataire
drop policy if exists evt_write_gestion on public.evenement_planning;
create policy evt_write_gestion on public.evenement_planning for all
  using (
    prestataire_id = public.current_prestataire_id()
    and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() = 1)
  )
  with check (
    prestataire_id = public.current_prestataire_id()
    and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() = 1)
  );
