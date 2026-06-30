-- =====================================================================
-- 0116 — Restriction de la messagerie interne pour les médecins
--
-- Un médecin (chirurgien) ne peut échanger des messages qu'avec :
--   • les infirmières coordinatrices de SON agence de rattachement,
--   • le manager de la région de cette agence.
-- (et inversement : seuls ces profils peuvent lui écrire). La plateforme
-- (niveau 0) n'est jamais bloquée.
-- =====================================================================

create or replace function public.peut_message_pro(autre uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  moi_id   uuid := public.current_professionnel_id();
  moi_role text; moi_ag uuid; moi_reg uuid; moi_niv int;
  lui_role text; lui_ag uuid; lui_reg uuid; lui_niv int;
  med_ag   uuid; med_reg uuid;
  x_role   text; x_ag uuid; x_reg uuid;
begin
  if moi_id is null or autre is null then return false; end if;
  select role, agence_id, region_id, niveau into moi_role, moi_ag, moi_reg, moi_niv from public.professionnel where id = moi_id;
  select role, agence_id, region_id, niveau into lui_role, lui_ag, lui_reg, lui_niv from public.professionnel where id = autre;
  if lui_role is null then return false; end if;

  -- Plateforme (niveau 0) : jamais bloquée.
  if moi_niv = 0 or lui_niv = 0 then return true; end if;
  -- Aucun chirurgien impliqué → règle générale.
  if moi_role <> 'chirurgien' and lui_role <> 'chirurgien' then return true; end if;
  -- Deux chirurgiens → interdit.
  if moi_role = 'chirurgien' and lui_role = 'chirurgien' then return false; end if;

  -- L'un est chirurgien : on identifie le médecin (med) et l'autre interlocuteur (x).
  if moi_role = 'chirurgien' then
    med_ag := moi_ag; x_role := lui_role; x_ag := lui_ag; x_reg := lui_reg;
  else
    med_ag := lui_ag; x_role := moi_role; x_ag := moi_ag; x_reg := moi_reg;
  end if;
  select region_id into med_reg from public.agence where id = med_ag;

  return (x_role = 'coordinatrice' and x_ag is not distinct from med_ag)
      or (x_role = 'manager'      and x_reg is not distinct from med_reg);
end;
$$;

-- On n'envoie qu'en son nom ET vers un interlocuteur autorisé.
drop policy if exists mp_insert on public.message_pro;
create policy mp_insert on public.message_pro for insert
  with check (
    expediteur_id = public.current_professionnel_id()
    and public.peut_message_pro(destinataire_id)
  );
