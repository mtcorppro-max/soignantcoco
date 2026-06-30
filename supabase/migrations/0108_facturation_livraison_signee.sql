-- =====================================================================
-- 0108 — Facturation à l'unité : uniquement sur livraison LIVRÉE + SIGNÉE
--
-- Les consommables (articles à code LPP) ne sont facturés / comptés dans le CA
-- prévisionnel qu'à partir de leur SORTIE DE STOCK = bon de livraison signé
-- (livraison.statut = 'livree' ET livraison.signature renseignée).
-- (Les forfaits récurrents restent calculés sur la durée de PEC, inchangés.)
-- =====================================================================

create or replace function public.generer_factures_previsionnelles()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_taux_defaut numeric := coalesce((select taux_secu_defaut from public.facturation_param where id), 0.6);
  v_cree int := 0;
  l record; o record; p record; fo record; d date;
  v_base numeric; v_baseht numeric; v_secu numeric; v_mut numeric; v_pat numeric; v_taux numeric;
  v_prix numeric; v_per text; v_tva numeric; v_step interval; v_fin date; v_id uuid;
begin
  -- 1) Annulations : la livraison n'est plus livrée+signée, ou forfait inactif.
  update public.facture_previsionnelle f set statut = 'annulee'
    where f.statut = 'a_facturer' and f.source = 'unite' and f.livraison_id is not null
      and not exists (select 1 from public.livraison lv where lv.id = f.livraison_id and lv.statut = 'livree' and lv.signature is not null);
  update public.facture_previsionnelle f set statut = 'annulee'
    where f.statut = 'a_facturer' and f.source = 'forfait'
      and not exists (select 1 from public.patient_forfait pf where pf.id = f.forfait_id and pf.actif);

  -- 2) À l'unité : seulement les livraisons LIVRÉES + SIGNÉES (sorties de stock).
  for l in
    select liv.id, liv.patient_id, liv.livree_le from public.livraison liv
    where liv.statut = 'livree' and liv.signature is not null
      and not exists (select 1 from public.facture_previsionnelle f where f.livraison_id = liv.id)
  loop
    select pa.id, pa.agence_id, pa.prestataire_id, pa.ald, pa.a_mutuelle, pa.taux_mutuelle into p from public.patient pa where pa.id = l.patient_id;
    if p.id is null then continue; end if;
    select ord.id, ord.destinataire_id, ord.signataire_nom into o from public.ordonnance ord
      where ord.patient_id = l.patient_id and ord.statut = 'signee' order by ord.signee_le desc nulls last, ord.created_at desc limit 1;
    if o.id is null then continue; end if;
    select coalesce(sum(ll.quantite * lp.prix_ttc), 0),
           coalesce(sum(ll.quantite * lp.prix_ttc / (1 + coalesce(lp.taux_tva, 0.2))), 0)
      into v_base, v_baseht
      from public.livraison_ligne ll join public.article a on a.code = ll.article_code join public.lpp lp on lp.code = a.lpp_code
      where ll.livraison_id = l.id and lp.prix_ttc is not null;
    if v_base is null or v_base = 0 then continue; end if;
    v_taux := case when p.ald then 1.0 else v_taux_defaut end;
    v_secu := round(v_base * v_taux, 2);
    v_mut  := case when p.a_mutuelle then round((v_base - v_secu) * coalesce(p.taux_mutuelle, 1.0), 2) else 0 end;
    v_pat  := round(v_base - v_secu - v_mut, 2);
    insert into public.facture_previsionnelle
      (patient_id, agence_id, prestataire_id, medecin_id, medecin_nom, livraison_id, ordonnance_id, periode_debut, periode_fin, montant_base, montant_ht, part_secu, part_mutuelle, part_patient, statut, source)
    values (p.id, p.agence_id, p.prestataire_id, o.destinataire_id, o.signataire_nom, l.id, o.id, l.livree_le::date, l.livree_le::date, v_base, round(v_baseht, 2), v_secu, v_mut, v_pat, 'a_facturer', 'unite')
    returning id into v_id;
    insert into public.facture_ligne (facture_id, article_code, lpp_code, designation, quantite, prix_unitaire, montant)
    select v_id, ll.article_code, a.lpp_code, a.designation, ll.quantite, lp.prix_ttc, ll.quantite * lp.prix_ttc
      from public.livraison_ligne ll join public.article a on a.code = ll.article_code join public.lpp lp on lp.code = a.lpp_code
      where ll.livraison_id = l.id and lp.prix_ttc is not null;
    v_cree := v_cree + 1;
  end loop;

  -- 3) Forfaits récurrents (durée de PEC) — inchangé.
  for fo in
    select pf.id, pf.patient_id, pf.lpp_code, pf.date_debut, pf.date_fin,
           pa.agence_id, pa.prestataire_id, pa.ald, pa.a_mutuelle, pa.taux_mutuelle
    from public.patient_forfait pf join public.patient pa on pa.id = pf.patient_id
    where pf.actif
  loop
    select lp.prix_ttc, lp.periodicite, coalesce(lp.taux_tva, 0.2) into v_prix, v_per, v_tva from public.lpp lp where lp.code = fo.lpp_code;
    if v_prix is null then continue; end if;
    select ord.id, ord.destinataire_id, ord.signataire_nom into o from public.ordonnance ord
      where ord.patient_id = fo.patient_id and ord.statut = 'signee' order by ord.signee_le desc nulls last, ord.created_at desc limit 1;
    if o.id is null then continue; end if;

    v_taux := case when fo.ald then 1.0 else v_taux_defaut end;
    v_secu := round(v_prix * v_taux, 2);
    v_mut  := case when fo.a_mutuelle then round((v_prix - v_secu) * coalesce(fo.taux_mutuelle, 1.0), 2) else 0 end;
    v_pat  := round(v_prix - v_secu - v_mut, 2);
    v_fin  := least(current_date, fo.date_fin);
    v_step := case v_per when 'journalier' then interval '1 day' when 'hebdomadaire' then interval '7 days' when 'mensuel' then interval '1 month' else null end;

    for d in
      select g::date from generate_series(fo.date_debut, case when v_step is null then fo.date_debut else v_fin end, coalesce(v_step, interval '1000 years')) g
      where g::date <= v_fin
    loop
      if not exists (select 1 from public.facture_previsionnelle f where f.forfait_id = fo.id and f.periode_debut = d) then
        insert into public.facture_previsionnelle
          (patient_id, agence_id, prestataire_id, medecin_id, medecin_nom, ordonnance_id, periode_debut, periode_fin, montant_base, montant_ht, part_secu, part_mutuelle, part_patient, statut, source, lpp_code, forfait_id)
        values (fo.patient_id, fo.agence_id, fo.prestataire_id, o.destinataire_id, o.signataire_nom, o.id, d,
                case when v_step is null then d else (d + v_step - interval '1 day')::date end,
                v_prix, round(v_prix / (1 + v_tva), 2), v_secu, v_mut, v_pat, 'a_facturer', 'forfait', fo.lpp_code, fo.id);
        v_cree := v_cree + 1;
      end if;
    end loop;
  end loop;

  return v_cree;
end $$;

-- Cohérence immédiate : annuler les factures à l'unité dont la livraison
-- n'est pas (ou plus) livrée + signée.
update public.facture_previsionnelle f set statut = 'annulee'
  where f.source = 'unite' and f.statut = 'a_facturer' and f.livraison_id is not null
    and not exists (select 1 from public.livraison lv where lv.id = f.livraison_id and lv.statut = 'livree' and lv.signature is not null);
