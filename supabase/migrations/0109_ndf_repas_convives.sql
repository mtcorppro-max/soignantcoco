-- =====================================================================
-- 0109 — Notes de frais : convives d'un repas + seuil DMOS par personne
--
-- Un repas compte l'auteur de la note (d'office) + des invités (DMOS ou non).
-- Le montant retenu pour le DMOS = coût PAR PERSONNE = montant_ttc / nb total.
-- Le repas est un avantage PS s'il y a au moins un invité « professionnel de
-- santé » ; le bénéficiaire principal de la ligne = le 1er invité PS.
--
-- convives : jsonb [{ nom, dmos, pro_id, externe_id, rpps, specialite }]
-- montant_dmos : montant retenu pour les seuils/plafonds (par personne si repas).
-- =====================================================================

alter table public.note_de_frais_ligne
  add column if not exists convives     jsonb not null default '[]'::jsonb,
  add column if not exists montant_dmos numeric(10,2);

create or replace function public.dmos_qualifier_ligne()
returns trigger language plpgsql security definer set search_path = public as $$
declare sd numeric; sa numeric; m numeric; conv jsonb; prem jsonb; nb int;
begin
  -- ── REPAS : DMOS déduit des convives, seuil par personne ──────────────────
  if NEW.type = 'repas' then
    conv := coalesce(NEW.convives, '[]'::jsonb);
    nb := 1 + jsonb_array_length(conv);             -- +1 = auteur de la note
    select c into prem from jsonb_array_elements(conv) c
      where coalesce((c->>'dmos')::boolean, false) limit 1;
    if prem is null then
      NEW.est_avantage_ps := false; NEW.usage_pedagogique := false;
      NEW.beneficiaire_pro_id := null; NEW.beneficiaire_externe_id := null;
      NEW.beneficiaire_nom := null; NEW.beneficiaire_rpps := null; NEW.beneficiaire_specialite := null;
      NEW.dmos_regime := null; NEW.montant_dmos := null;
      return NEW;
    end if;
    NEW.est_avantage_ps := true;
    NEW.beneficiaire_pro_id     := nullif(prem->>'pro_id', '')::uuid;
    NEW.beneficiaire_externe_id := nullif(prem->>'externe_id', '')::uuid;
    NEW.beneficiaire_nom        := prem->>'nom';
    NEW.beneficiaire_rpps       := prem->>'rpps';
    NEW.beneficiaire_specialite := prem->>'specialite';
    NEW.montant_dmos := round(NEW.montant_ttc / nullif(nb, 0), 2);
    if NEW.usage_pedagogique then
      NEW.dmos_regime := null;
    else
      select seuil_declaration, seuil_autorisation into sd, sa from public.dmos_bareme
        where type_avantage = 'repas' and actif and date_effet <= coalesce(NEW.date_depense, current_date)
        order by date_effet desc limit 1;
      m := NEW.montant_dmos;
      if sd is not null and m < sd then NEW.dmos_regime := null;
      elsif sa is not null and m >= sa then NEW.dmos_regime := 'autorisation';
      else NEW.dmos_regime := 'declaration';
      end if;
    end if;
    return NEW;
  end if;

  -- ── AUTRES TYPES : bénéficiaire unique, seuil sur le montant total ────────
  if not NEW.est_avantage_ps then
    NEW.dmos_regime := null; NEW.montant_dmos := null; NEW.usage_pedagogique := false;
    NEW.beneficiaire_pro_id := null; NEW.beneficiaire_externe_id := null;
    NEW.beneficiaire_nom := null; NEW.beneficiaire_rpps := null; NEW.beneficiaire_specialite := null;
  elsif NEW.usage_pedagogique then
    NEW.dmos_regime := null; NEW.montant_dmos := NEW.montant_ttc;
  else
    NEW.montant_dmos := NEW.montant_ttc;
    select seuil_declaration, seuil_autorisation into sd, sa from public.dmos_bareme
      where type_avantage = NEW.type and actif and date_effet <= coalesce(NEW.date_depense, current_date)
      order by date_effet desc limit 1;
    if sd is not null and NEW.montant_ttc < sd then NEW.dmos_regime := null;
    elsif sa is not null and NEW.montant_ttc >= sa then NEW.dmos_regime := 'autorisation';
    else NEW.dmos_regime := 'declaration';
    end if;
  end if;
  return NEW;
end;
$$;

-- Plafond : comparer le montant DMOS retenu (par personne pour un repas).
create or replace function public.ndf_bloquer_validation_dmos()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; lim_nb int; lim_montant numeric; cnt int; tot numeric; an int;
begin
  if NEW.statut = 'validee' and OLD.statut is distinct from 'validee' then
    if exists (
      select 1 from public.note_de_frais_ligne l
       where l.note_id = NEW.id and l.est_avantage_ps and not l.usage_pedagogique
         and l.dmos_regime = 'autorisation' and coalesce(l.decision, '') not in ('autorise', 'tacite')
    ) then
      raise exception 'Validation impossible : un avantage dépasse le seuil DMOS et nécessite une autorisation préalable (voir Suivi DMOS).';
    end if;

    if exists (
      select 1 from public.note_de_frais_ligne l
       where l.note_id = NEW.id and l.est_avantage_ps and not l.usage_pedagogique
         and coalesce(l.montant_dmos, l.montant_ttc) > coalesce((
           select b.seuil_max from public.dmos_bareme b
            where b.type_avantage = l.type and b.actif and b.seuil_max is not null
              and b.date_effet <= coalesce(l.date_depense, current_date)
            order by b.date_effet desc limit 1
         ), 'infinity'::numeric)
    ) then
      raise exception 'Validation impossible : un montant dépasse le plafond autorisé pour ce type de dépense (DMOS).';
    end if;

    for r in select * from public.note_de_frais_ligne where note_id = NEW.id and est_avantage_ps and not usage_pedagogique loop
      select b.limite_an_nb, b.limite_an_montant into lim_nb, lim_montant from public.dmos_bareme b
        where b.type_avantage = r.type and b.actif and b.date_effet <= coalesce(r.date_depense, current_date)
        order by b.date_effet desc limit 1;
      if lim_nb is null and lim_montant is null then continue; end if;
      an := extract(year from coalesce(r.date_depense, current_date));
      select count(*), coalesce(sum(coalesce(l2.montant_dmos, l2.montant_ttc)), 0) into cnt, tot
        from public.note_de_frais_ligne l2 join public.note_de_frais n2 on n2.id = l2.note_id
        where l2.est_avantage_ps and not l2.usage_pedagogique and l2.type = r.type
          and n2.statut in ('soumise', 'validee', 'remboursee')
          and extract(year from coalesce(l2.date_depense, current_date)) = an
          and l2.beneficiaire_pro_id is not distinct from r.beneficiaire_pro_id
          and l2.beneficiaire_externe_id is not distinct from r.beneficiaire_externe_id
          and coalesce(l2.beneficiaire_nom, '') = coalesce(r.beneficiaire_nom, '');
      if lim_nb is not null and cnt > lim_nb then
        raise exception 'Validation impossible : limite annuelle DMOS dépassée pour ce bénéficiaire (max % par an pour « % »).', lim_nb, r.type;
      end if;
      if lim_montant is not null and tot > lim_montant then
        raise exception 'Validation impossible : plafond annuel DMOS dépassé pour ce bénéficiaire (max % € par an pour « % »).', lim_montant, r.type;
      end if;
    end loop;
  end if;
  return NEW;
end;
$$;
