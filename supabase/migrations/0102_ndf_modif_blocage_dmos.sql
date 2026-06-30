-- =====================================================================
-- 0102 — Notes de frais : modification (rappel) + blocage validation DMOS
--
-- 1) L'émetteur peut rappeler une note soumise en brouillon pour la modifier.
-- 2) On ne peut pas valider une note qui contient un avantage dépassant le
--    seuil DMOS (régime « autorisation ») tant que l'autorisation n'est pas
--    obtenue (décision « autorise » ou « tacite »).
-- =====================================================================

-- 1) Rappel possible (soumise → brouillon) en plus de brouillon/rejetee.
drop policy if exists ndf_update_emetteur on public.note_de_frais;
create policy ndf_update_emetteur on public.note_de_frais for update
  using (emetteur_id = public.current_professionnel_id() and statut in ('brouillon','soumise','rejetee'))
  with check (emetteur_id = public.current_professionnel_id() and statut in ('brouillon','soumise'));

-- 2) Blocage de la validation si un avantage est en régime « autorisation »
--    et non encore autorisé.
create or replace function public.ndf_bloquer_validation_dmos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.statut = 'validee' and OLD.statut is distinct from 'validee' then
    if exists (
      select 1 from public.note_de_frais_ligne l
       where l.note_id = NEW.id
         and l.est_avantage_ps
         and l.dmos_regime = 'autorisation'
         and coalesce(l.decision, '') not in ('autorise', 'tacite')
    ) then
      raise exception 'Validation impossible : un avantage dépasse le seuil DMOS et nécessite une autorisation préalable (voir Suivi DMOS).';
    end if;
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_ndf_bloquer_validation_dmos on public.note_de_frais;
create trigger trg_ndf_bloquer_validation_dmos
  before update on public.note_de_frais
  for each row execute function public.ndf_bloquer_validation_dmos();
