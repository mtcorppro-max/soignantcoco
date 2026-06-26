-- =====================================================================
-- 0034 — Rattachement d'un professionnel à une région (niveau 1 / manager)
--
-- Un niveau 1 (manager) est rattaché à une RÉGION (pas à une agence).
-- current_region_id() renvoie la région directe si définie, sinon la région
-- de l'agence du professionnel.
-- =====================================================================

alter table public.professionnel
  add column if not exists region_id uuid references public.region(id) on delete set null;
create index if not exists idx_pro_region on public.professionnel (region_id);

create or replace function public.current_region_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select region_id from public.professionnel where user_id = auth.uid()),
    (select a.region_id
       from public.professionnel p
       left join public.agence a on a.id = p.agence_id
      where p.user_id = auth.uid())
  )
$$;
