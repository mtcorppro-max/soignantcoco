-- =====================================================================
-- 0073 — Panier (livraison_ligne) : composition réservée aux coordinatrices
--
-- Seule la coordinatrice COMPOSE le panier (ajout/retrait d'articles).
-- Le magasinier ne fait que la PRÉPARATION (cocher = UPDATE prepare).
-- Lecture : tous ceux qui accèdent à la livraison.
-- (Remplace la policy unique livraison_ligne_all de 0069/0072.)
-- =====================================================================

drop policy if exists livraison_ligne_all on public.livraison_ligne;

-- Lecture : accès à la livraison parente.
drop policy if exists livraison_ligne_select on public.livraison_ligne;
create policy livraison_ligne_select on public.livraison_ligne for select
  using (
    exists (select 1 from public.livraison l where l.id = livraison_id and (
      public.current_niveau() = 0
      or l.livreur_id = public.current_professionnel_id()
      or (l.prestataire_id = public.current_prestataire_id() and (public.current_role_pro() = 'coordinatrice' or public.current_niveau() <= 1))
      or (public.current_role_pro() = 'livreur' and public.peut_voir_patient(l.patient_id))
      or (public.current_role_pro() = 'infirmiere_liberale' and public.peut_voir_patient(l.patient_id))
      or (public.current_role_pro() = 'magasinier' and exists (select 1 from public.patient pa where pa.id = l.patient_id and pa.agence_id = public.current_agence_id()))
    ))
  );

-- Composition (INSERT) : coordinatrice uniquement (+ plateforme).
drop policy if exists livraison_ligne_insert on public.livraison_ligne;
create policy livraison_ligne_insert on public.livraison_ligne for insert
  with check (
    public.current_niveau() = 0
    or (public.current_role_pro() = 'coordinatrice'
        and exists (select 1 from public.livraison l where l.id = livraison_id and l.prestataire_id = public.current_prestataire_id()))
  );

-- Retrait (DELETE) : coordinatrice uniquement (+ plateforme).
drop policy if exists livraison_ligne_delete on public.livraison_ligne;
create policy livraison_ligne_delete on public.livraison_ligne for delete
  using (
    public.current_niveau() = 0
    or (public.current_role_pro() = 'coordinatrice'
        and exists (select 1 from public.livraison l where l.id = livraison_id and l.prestataire_id = public.current_prestataire_id()))
  );

-- Mise à jour : coordinatrice (quantité du panier) + magasinier (cocher préparé).
drop policy if exists livraison_ligne_update on public.livraison_ligne;
create policy livraison_ligne_update on public.livraison_ligne for update
  using (
    exists (select 1 from public.livraison l where l.id = livraison_id and (
      public.current_niveau() = 0
      or (public.current_role_pro() = 'coordinatrice' and l.prestataire_id = public.current_prestataire_id())
      or (public.current_role_pro() = 'magasinier' and exists (select 1 from public.patient pa where pa.id = l.patient_id and pa.agence_id = public.current_agence_id()))
    ))
  )
  with check (
    exists (select 1 from public.livraison l where l.id = livraison_id and (
      public.current_niveau() = 0
      or (public.current_role_pro() = 'coordinatrice' and l.prestataire_id = public.current_prestataire_id())
      or (public.current_role_pro() = 'magasinier' and exists (select 1 from public.patient pa where pa.id = l.patient_id and pa.agence_id = public.current_agence_id()))
    ))
  );
