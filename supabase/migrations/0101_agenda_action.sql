-- =====================================================================
-- 0101 — Agenda individuel : actions / rendez-vous planifiés
--
-- Chaque interne dispose d'un agenda (jour/semaine) qui agrège ses suivis et
-- livraisons (calculés) + ses propres actions planifiées (cette table) :
-- suivi/livraison à mener, réunion, autre.
-- =====================================================================

create table if not exists public.agenda_action (
  id               uuid primary key default gen_random_uuid(),
  prestataire_id   uuid not null references public.prestataire(id) on delete cascade,
  professionnel_id uuid not null references public.professionnel(id) on delete cascade,
  patient_id       uuid references public.patient(id) on delete set null,
  type             text not null default 'autre'
                   check (type in ('suivi', 'livraison', 'reunion', 'autre')),
  titre            text not null,
  date             date not null,
  heure            time,
  description      text,
  fait             boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists idx_agenda_action_pro_date on public.agenda_action (professionnel_id, date);

alter table public.agenda_action enable row level security;

drop policy if exists aa_select on public.agenda_action;
create policy aa_select on public.agenda_action for select
  using (professionnel_id = public.current_professionnel_id() or public.current_niveau() = 0);

drop policy if exists aa_write on public.agenda_action;
create policy aa_write on public.agenda_action for all
  using (professionnel_id = public.current_professionnel_id())
  with check (professionnel_id = public.current_professionnel_id()
              and prestataire_id = public.current_prestataire_id());
