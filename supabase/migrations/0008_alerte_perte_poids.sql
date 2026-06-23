-- =====================================================================
-- 0008 — Alerte sur perte de poids (≥ 5 %)
--
-- Le poids n'utilise plus de seuil min/max fixe. À la place, une alerte est
-- déclenchée dès qu'une nouvelle pesée représente une perte ≥ 5 % par rapport
-- au poids de référence (= premier poids enregistré pour le patient).
--
-- Les autres mesures conservent la logique de seuil min/max inchangée.
--
-- À exécuter dans le SQL Editor de Supabase.
-- =====================================================================

create or replace function public.generer_alerte()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s   record;
  ref numeric;
begin
  -- ── Poids : alerte sur perte relative ≥ 5 % ──────────────────────
  if new.type = 'poids' then
    -- Poids de référence = premier poids enregistré pour ce patient
    select valeur into ref
      from public.mesure
     where patient_id = new.patient_id
       and type = 'poids'
       and id <> new.id
     order by horodatage asc
     limit 1;

    if ref is not null and new.valeur <= ref * 0.95 then
      insert into public.alerte (patient_id, mesure_id, statut)
      values (new.patient_id, new.id, 'declenchee');
    end if;

    return new;
  end if;

  -- ── Autres mesures : seuil min / max ─────────────────────────────
  select * into s
    from public.seuil
   where patient_id = new.patient_id and type_mesure = new.type and actif = true
   limit 1;

  if found and (
       (s.valeur_min is not null and new.valeur < s.valeur_min)
    or (s.valeur_max is not null and new.valeur > s.valeur_max)
  ) then
    insert into public.alerte (patient_id, mesure_id, statut)
    values (new.patient_id, new.id, 'declenchee');
  end if;

  return new;
end;
$$;
