-- =====================================================================
-- 0067 — Magasin : catalogue d'articles + stock par agence
--
--   article : catalogue partagé (code + désignation).
--   stock   : quantité d'un article DANS une agence (un stock par agence).
--
-- Accès au stock : coordinatrices et livreurs de l'agence (lecture +
-- écriture) ; la plateforme (niveau 0) voit tout.
-- =====================================================================

-- Catalogue d'articles (code = référence unique).
create table if not exists public.article (
  code        text primary key,
  designation text not null,
  created_at  timestamptz not null default now()
);
alter table public.article enable row level security;

-- Lecture du catalogue : tout professionnel connecté.
drop policy if exists article_select on public.article;
create policy article_select on public.article for select
  using (public.current_professionnel_id() is not null);

-- Écriture du catalogue : plateforme (le seed passe par le service_role).
drop policy if exists article_write on public.article;
create policy article_write on public.article for all
  using (public.current_niveau() = 0)
  with check (public.current_niveau() = 0);

-- Stock : une ligne par (agence, article).
create table if not exists public.stock (
  id           uuid primary key default gen_random_uuid(),
  agence_id    uuid not null references public.agence(id) on delete cascade,
  article_code text not null references public.article(code) on delete cascade,
  quantite     integer not null default 0,
  updated_at   timestamptz not null default now(),
  unique (agence_id, article_code)
);
create index if not exists idx_stock_agence on public.stock (agence_id);
alter table public.stock enable row level security;

-- Lecture du stock : coordinatrices et livreurs de l'agence (+ plateforme).
drop policy if exists stock_select on public.stock;
create policy stock_select on public.stock for select
  using (
    public.current_niveau() = 0
    or (public.current_role_pro() in ('coordinatrice', 'livreur')
        and agence_id = public.current_agence_id())
  );

-- Écriture du stock : mêmes droits (ajuster les quantités).
drop policy if exists stock_write on public.stock;
create policy stock_write on public.stock for all
  using (
    public.current_niveau() = 0
    or (public.current_role_pro() in ('coordinatrice', 'livreur')
        and agence_id = public.current_agence_id())
  )
  with check (
    public.current_niveau() = 0
    or (public.current_role_pro() in ('coordinatrice', 'livreur')
        and agence_id = public.current_agence_id())
  );
