-- =====================================================================
-- 0072 — Droits du magasinier (seul à écrire stock / réappro / préparer)
--
--   stock      : lecture = magasinier + coordinatrice + livreur de l'agence ;
--                écriture = magasinier de l'agence uniquement (+ plateforme).
--   commande   : magasinier de l'agence uniquement (réappro).
--   livraison / livraison_ligne : le magasinier accède aux livraisons de son
--                agence pour les PRÉPARER (lignes + statut « preparee »).
--
-- À exécuter APRÈS 0071 (le rôle 'magasinier' doit exister).
-- =====================================================================

-- ── STOCK ───────────────────────────────────────────────────────────
-- Lecture : magasinier, coordinatrice, livreur de l'agence (+ plateforme).
drop policy if exists stock_select on public.stock;
create policy stock_select on public.stock for select
  using (
    public.current_niveau() = 0
    or (public.current_role_pro() in ('magasinier', 'coordinatrice', 'livreur')
        and agence_id = public.current_agence_id())
  );

-- Écriture : magasinier de l'agence uniquement (+ plateforme).
drop policy if exists stock_write on public.stock;
create policy stock_write on public.stock for all
  using (
    public.current_niveau() = 0
    or (public.current_role_pro() = 'magasinier' and agence_id = public.current_agence_id())
  )
  with check (
    public.current_niveau() = 0
    or (public.current_role_pro() = 'magasinier' and agence_id = public.current_agence_id())
  );

-- ── COMMANDE (réappro) : magasinier de l'agence uniquement ──────────
drop policy if exists commande_all on public.commande;
create policy commande_all on public.commande for all
  using (
    public.current_niveau() = 0
    or (public.current_role_pro() = 'magasinier' and agence_id = public.current_agence_id())
  )
  with check (
    public.current_niveau() = 0
    or (public.current_role_pro() = 'magasinier' and agence_id = public.current_agence_id())
  );

drop policy if exists commande_ligne_all on public.commande_ligne;
create policy commande_ligne_all on public.commande_ligne for all
  using (
    exists (select 1 from public.commande c where c.id = commande_id
      and (public.current_niveau() = 0
           or (public.current_role_pro() = 'magasinier' and c.agence_id = public.current_agence_id())))
  )
  with check (
    exists (select 1 from public.commande c where c.id = commande_id
      and (public.current_niveau() = 0
           or (public.current_role_pro() = 'magasinier' and c.agence_id = public.current_agence_id())))
  );

-- RPC réappro : réservé au magasinier de l'agence (+ plateforme).
create or replace function public.commande_valider(p_commande uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_agence uuid; v_statut text;
begin
  select agence_id, statut into v_agence, v_statut from public.commande where id = p_commande;
  if v_statut is null then raise exception 'Commande introuvable'; end if;
  if not (public.current_niveau() = 0
          or (public.current_role_pro() = 'magasinier' and public.current_agence_id() = v_agence)) then
    raise exception 'Non autorisé';
  end if;
  if v_statut <> 'brouillon' then raise exception 'Commande déjà validée'; end if;
  insert into public.stock (agence_id, article_code, en_commande)
  select v_agence, cl.article_code, sum(cl.quantite)
  from public.commande_ligne cl where cl.commande_id = p_commande
  group by cl.article_code
  on conflict (agence_id, article_code)
  do update set en_commande = public.stock.en_commande + excluded.en_commande, updated_at = now();
  update public.commande set statut = 'commandee', updated_at = now() where id = p_commande;
end $$;

create or replace function public.commande_receptionner(p_commande uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_agence uuid; v_statut text;
begin
  select agence_id, statut into v_agence, v_statut from public.commande where id = p_commande;
  if v_statut is null then raise exception 'Commande introuvable'; end if;
  if not (public.current_niveau() = 0
          or (public.current_role_pro() = 'magasinier' and public.current_agence_id() = v_agence)) then
    raise exception 'Non autorisé';
  end if;
  if v_statut <> 'commandee' then raise exception 'La commande doit être validée avant réception'; end if;
  insert into public.stock (agence_id, article_code, quantite)
  select v_agence, cl.article_code, sum(cl.quantite)
  from public.commande_ligne cl where cl.commande_id = p_commande
  group by cl.article_code
  on conflict (agence_id, article_code)
  do update set quantite = public.stock.quantite + excluded.quantite,
                en_commande = greatest(public.stock.en_commande - excluded.quantite, 0),
                updated_at = now();
  update public.commande set statut = 'recue', updated_at = now() where id = p_commande;
end $$;

-- ── LIVRAISON : le magasinier prépare les livraisons de son agence ──
drop policy if exists livraison_select on public.livraison;
create policy livraison_select on public.livraison for select
  using (
    public.current_niveau() = 0
    or livreur_id = public.current_professionnel_id()
    or (prestataire_id = public.current_prestataire_id()
        and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() <= 1))
    or (public.current_role_pro() = 'livreur' and public.peut_voir_patient(patient_id))
    or (public.current_role_pro() = 'infirmiere_liberale' and public.peut_voir_patient(patient_id))
    or (public.current_role_pro() = 'magasinier'
        and exists (select 1 from public.patient pa where pa.id = patient_id and pa.agence_id = public.current_agence_id()))
  );

drop policy if exists livraison_write on public.livraison;
create policy livraison_write on public.livraison for all
  using (
    public.current_niveau() = 0
    or livreur_id = public.current_professionnel_id()
    or (prestataire_id = public.current_prestataire_id()
        and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() <= 1))
    or (public.current_role_pro() = 'livreur' and public.peut_voir_patient(patient_id))
    or (public.current_role_pro() = 'magasinier'
        and exists (select 1 from public.patient pa where pa.id = patient_id and pa.agence_id = public.current_agence_id()))
  )
  with check (
    public.current_niveau() = 0
    or (prestataire_id = public.current_prestataire_id()
        and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() <= 1))
    or (public.current_role_pro() = 'livreur'
        and livreur_id = public.current_professionnel_id()
        and public.peut_voir_patient(patient_id))
    or (public.current_role_pro() = 'magasinier'
        and exists (select 1 from public.patient pa where pa.id = patient_id and pa.agence_id = public.current_agence_id()))
  );

-- Le magasinier lit le patient (nom/adresse) de son agence pour préparer la
-- livraison. Lecture de la fiche uniquement : mesures/alertes/suivis restent
-- gouvernés par peut_voir_patient (aucune branche magasinier) → pas d'accès médical.
drop policy if exists patient_select_magasinier on public.patient;
create policy patient_select_magasinier on public.patient for select
  using (public.current_role_pro() = 'magasinier' and agence_id = public.current_agence_id());

-- Lignes de livraison : ajout du magasinier (préparation : cocher les articles).
drop policy if exists livraison_ligne_all on public.livraison_ligne;
create policy livraison_ligne_all on public.livraison_ligne for all
  using (
    exists (
      select 1 from public.livraison l
      where l.id = livraison_id and (
        public.current_niveau() = 0
        or l.livreur_id = public.current_professionnel_id()
        or (l.prestataire_id = public.current_prestataire_id()
            and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() <= 1))
        or (public.current_role_pro() = 'livreur' and public.peut_voir_patient(l.patient_id))
        or (public.current_role_pro() = 'infirmiere_liberale' and public.peut_voir_patient(l.patient_id))
        or (public.current_role_pro() = 'magasinier'
            and exists (select 1 from public.patient pa where pa.id = l.patient_id and pa.agence_id = public.current_agence_id()))
      )
    )
  )
  with check (
    exists (
      select 1 from public.livraison l
      where l.id = livraison_id and (
        public.current_niveau() = 0
        or l.livreur_id = public.current_professionnel_id()
        or (l.prestataire_id = public.current_prestataire_id()
            and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() <= 1))
        or (public.current_role_pro() = 'livreur' and public.peut_voir_patient(l.patient_id))
        or (public.current_role_pro() = 'infirmiere_liberale' and public.peut_voir_patient(l.patient_id))
        or (public.current_role_pro() = 'magasinier'
            and exists (select 1 from public.patient pa where pa.id = l.patient_id and pa.agence_id = public.current_agence_id()))
      )
    )
  );
