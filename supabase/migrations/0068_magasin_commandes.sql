-- =====================================================================
-- 0068 — Magasin : états du stock + réapprovisionnement (bons de commande)
--
-- États du stock (par agence/article) :
--   quantite     = disponible (physiquement présent)
--   en_commande  = commandé au fournisseur, pas encore reçu (transit entrant)
--   reserve      = réservé pour des livraisons patients (transit sortant)  [étape 2]
--   seuil_alerte = seuil bas par article → alerte « stock bas »
--
-- Réappro : bon de commande (brouillon → commandée → reçue).
--   commande_valider()       → en_commande += quantités  (« en transit »)
--   commande_receptionner()  → quantite += , en_commande -=  (réception = bon de livraison)
-- =====================================================================

alter table public.stock
  add column if not exists en_commande  integer not null default 0,
  add column if not exists reserve      integer not null default 0,
  add column if not exists seuil_alerte integer not null default 10;

-- ── Bon de commande (réapprovisionnement d'une agence) ──────────────
create table if not exists public.commande (
  id             uuid primary key default gen_random_uuid(),
  agence_id      uuid not null references public.agence(id) on delete cascade,
  prestataire_id uuid not null references public.prestataire(id) on delete cascade,
  reference      text,
  statut         text not null default 'brouillon'
                 check (statut in ('brouillon', 'commandee', 'recue', 'annulee')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_commande_agence on public.commande (agence_id);
alter table public.commande enable row level security;

create table if not exists public.commande_ligne (
  id           uuid primary key default gen_random_uuid(),
  commande_id  uuid not null references public.commande(id) on delete cascade,
  article_code text not null references public.article(code) on delete cascade,
  quantite     integer not null check (quantite > 0)
);
create index if not exists idx_commande_ligne_cmd on public.commande_ligne (commande_id);
alter table public.commande_ligne enable row level security;

-- ── RLS : coordinatrices & livreurs de l'agence (+ plateforme) ──────
drop policy if exists commande_all on public.commande;
create policy commande_all on public.commande for all
  using (
    public.current_niveau() = 0
    or (public.current_role_pro() in ('coordinatrice', 'livreur') and agence_id = public.current_agence_id())
  )
  with check (
    public.current_niveau() = 0
    or (public.current_role_pro() in ('coordinatrice', 'livreur') and agence_id = public.current_agence_id())
  );

drop policy if exists commande_ligne_all on public.commande_ligne;
create policy commande_ligne_all on public.commande_ligne for all
  using (
    exists (
      select 1 from public.commande c
      where c.id = commande_id
        and (public.current_niveau() = 0
             or (public.current_role_pro() in ('coordinatrice', 'livreur') and c.agence_id = public.current_agence_id()))
    )
  )
  with check (
    exists (
      select 1 from public.commande c
      where c.id = commande_id
        and (public.current_niveau() = 0
             or (public.current_role_pro() in ('coordinatrice', 'livreur') and c.agence_id = public.current_agence_id()))
    )
  );

-- ── Transitions atomiques ───────────────────────────────────────────

-- Valide un bon de commande : passe « brouillon → commandee » et ajoute
-- les quantités en « en_commande » (transit entrant).
create or replace function public.commande_valider(p_commande uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_agence uuid; v_statut text;
begin
  select agence_id, statut into v_agence, v_statut from public.commande where id = p_commande;
  if v_statut is null then raise exception 'Commande introuvable'; end if;
  if not (public.current_niveau() = 0
          or (public.current_role_pro() in ('coordinatrice', 'livreur') and public.current_agence_id() = v_agence)) then
    raise exception 'Non autorisé';
  end if;
  if v_statut <> 'brouillon' then raise exception 'Commande déjà validée'; end if;

  insert into public.stock (agence_id, article_code, en_commande)
  select v_agence, cl.article_code, sum(cl.quantite)
  from public.commande_ligne cl
  where cl.commande_id = p_commande
  group by cl.article_code
  on conflict (agence_id, article_code)
  do update set en_commande = public.stock.en_commande + excluded.en_commande, updated_at = now();

  update public.commande set statut = 'commandee', updated_at = now() where id = p_commande;
end $$;

-- Réceptionne (= bon de livraison) : « commandee → recue », ajoute au stock
-- disponible et solde le « en_commande ».
create or replace function public.commande_receptionner(p_commande uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_agence uuid; v_statut text;
begin
  select agence_id, statut into v_agence, v_statut from public.commande where id = p_commande;
  if v_statut is null then raise exception 'Commande introuvable'; end if;
  if not (public.current_niveau() = 0
          or (public.current_role_pro() in ('coordinatrice', 'livreur') and public.current_agence_id() = v_agence)) then
    raise exception 'Non autorisé';
  end if;
  if v_statut <> 'commandee' then raise exception 'La commande doit être validée avant réception'; end if;

  insert into public.stock (agence_id, article_code, quantite)
  select v_agence, cl.article_code, sum(cl.quantite)
  from public.commande_ligne cl
  where cl.commande_id = p_commande
  group by cl.article_code
  on conflict (agence_id, article_code)
  do update set quantite = public.stock.quantite + excluded.quantite,
                en_commande = greatest(public.stock.en_commande - excluded.quantite, 0),
                updated_at = now();

  update public.commande set statut = 'recue', updated_at = now() where id = p_commande;
end $$;
