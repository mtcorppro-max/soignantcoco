-- =====================================================================
-- 0076 — Unifie le catalogue : le matériel de location EST un article
--
-- Plus de catalogue séparé : on marque les articles de location dans
-- `article` (est_location + règles maintenance/durée). `equipement` (appareil
-- sérialisé) référence un `article`. Le panier de livraison (livraison_ligne)
-- contient TOUT ; pour une ligne de location, le magasinier affecte un n° de
-- série (livraison_ligne.equipement_id).
-- À exécuter APRÈS 0074/0075.
-- =====================================================================

-- 1) Drapeau + règles sur l'article.
alter table public.article
  add column if not exists est_location        boolean not null default false,
  add column if not exists maintenance_jours   integer not null default 365,
  add column if not exists location_max_jours  integer default 90;

-- Pré-marquage par mots-clés (perfusion/nutrition + cryothérapie).
update public.article
set est_location = true
where designation ilike 'POMPE%'
   or designation ilike '%CRYONOV%'
   or designation ilike '%GAMEREADY%'
   or designation ilike '%GAME READY%'
   or designation ilike 'ATTELLE%';

-- Le magasinier peut modifier le catalogue (cocher « location », etc.).
drop policy if exists article_write on public.article;
create policy article_write on public.article for all
  using (public.current_niveau() = 0 or public.current_role_pro() = 'magasinier')
  with check (public.current_niveau() = 0 or public.current_role_pro() = 'magasinier');

-- 2) equipement → référence article (au lieu d'equipement_type).
alter table public.equipement add column if not exists article_code text references public.article(code) on delete restrict;
alter table public.equipement drop column if exists type_id;
create index if not exists idx_equipement_article on public.equipement (article_code);

-- 3) livraison_ligne : n° de série affecté (lignes de location).
alter table public.livraison_ligne add column if not exists equipement_id uuid references public.equipement(id) on delete set null;

-- 4) Suppression des doublons.
drop table if exists public.livraison_equipement cascade;
drop table if exists public.equipement_type cascade;

-- 5) Trigger livraison : consommables (stock) + location (chez_patient).
create or replace function public.trg_livraison_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_agence uuid;
begin
  if NEW.statut = OLD.statut then return NEW; end if;
  select agence_id into v_agence from public.patient where id = NEW.patient_id;

  if NEW.statut = 'livree' and OLD.statut <> 'livree' then
    -- Consommables (articles NON location) : sortie de stock.
    if v_agence is not null then
      insert into public.stock (agence_id, article_code, quantite)
      select v_agence, cl.article_code, -sum(cl.quantite)
      from public.livraison_ligne cl join public.article a on a.code = cl.article_code
      where cl.livraison_id = NEW.id and a.est_location = false group by cl.article_code
      on conflict (agence_id, article_code) do update set quantite = public.stock.quantite + excluded.quantite, updated_at = now();
    end if;
    -- Location : appareil affecté → chez le patient.
    update public.equipement e
      set statut = 'chez_patient', patient_actuel_id = NEW.patient_id, chez_patient_depuis = now(), livraison_id = NEW.id, updated_at = now()
      from public.livraison_ligne cl where cl.livraison_id = NEW.id and cl.equipement_id = e.id and e.statut in ('affecte', 'disponible');
    insert into public.equipement_mouvement (equipement_id, type_mouvement, patient_id, livraison_id)
      select cl.equipement_id, 'livraison', NEW.patient_id, NEW.id
      from public.livraison_ligne cl where cl.livraison_id = NEW.id and cl.equipement_id is not null;

  elsif OLD.statut = 'livree' and NEW.statut <> 'livree' then
    if v_agence is not null then
      insert into public.stock (agence_id, article_code, quantite)
      select v_agence, cl.article_code, sum(cl.quantite)
      from public.livraison_ligne cl join public.article a on a.code = cl.article_code
      where cl.livraison_id = NEW.id and a.est_location = false group by cl.article_code
      on conflict (agence_id, article_code) do update set quantite = public.stock.quantite + excluded.quantite, updated_at = now();
    end if;
    update public.equipement e
      set statut = 'affecte', patient_actuel_id = null, chez_patient_depuis = null, updated_at = now()
      from public.livraison_ligne cl where cl.livraison_id = NEW.id and cl.equipement_id = e.id and e.statut = 'chez_patient';
  end if;

  return NEW;
end $$;

-- 6) « Réservé » : consommables uniquement (le matériel de location n'est pas du stock quantitatif).
create or replace function public.stock_reserve()
returns table(article_code text, qte bigint)
language sql stable security definer set search_path = public as $$
  select cl.article_code, sum(cl.quantite)::bigint
  from public.livraison_ligne cl
  join public.article a on a.code = cl.article_code
  join public.livraison l on l.id = cl.livraison_id
  join public.patient pa on pa.id = l.patient_id
  where pa.agence_id = public.current_agence_id()
    and a.est_location = false
    and l.statut in ('a_programmer', 'a_planifier', 'planifiee')
  group by cl.article_code;
$$;
