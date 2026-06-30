-- =====================================================================
-- 0097 — Marketing : congrès & événements (Lot 0)
--
-- Table des événements (congrès, soirées scientifiques, ateliers…). Sert de
-- socle à la rubrique Marketing « Congrès & événements » et, plus tard, de
-- rattachement aux lignes de notes de frais (avantages DMOS).
-- Accès : dirigeant, RH, manager, délégué du prestataire (+ admin niveau 0).
-- =====================================================================

create table if not exists public.evenement_marketing (
  id              uuid primary key default gen_random_uuid(),
  prestataire_id  uuid not null references public.prestataire(id) on delete cascade,
  nom             text not null,
  type            text not null default 'congres'
                  check (type in ('congres', 'soiree_scientifique', 'atelier', 'autre')),
  date_debut      date not null,
  date_fin        date,
  lieu            text,
  organisateur    text,
  description     text,
  created_by      uuid references public.professionnel(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_evenement_marketing_presta
  on public.evenement_marketing (prestataire_id, date_debut desc);

alter table public.evenement_marketing enable row level security;

drop policy if exists evt_mkt_select on public.evenement_marketing;
create policy evt_mkt_select on public.evenement_marketing for select
  using (
    public.current_niveau() = 0
    or (prestataire_id = public.current_prestataire_id()
        and public.current_role_pro() in ('dirigeant', 'rh', 'manager', 'delegue'))
  );

drop policy if exists evt_mkt_write on public.evenement_marketing;
create policy evt_mkt_write on public.evenement_marketing for all
  using (
    public.current_niveau() = 0
    or (prestataire_id = public.current_prestataire_id()
        and public.current_role_pro() in ('dirigeant', 'rh', 'manager', 'delegue'))
  )
  with check (
    public.current_niveau() = 0
    or (prestataire_id = public.current_prestataire_id()
        and public.current_role_pro() in ('dirigeant', 'rh', 'manager', 'delegue'))
  );
