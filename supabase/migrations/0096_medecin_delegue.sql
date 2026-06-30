-- =====================================================================
-- 0096 — Délégué médical rattaché à un médecin
--
-- Un médecin (role 'chirurgien') peut porter un délégué médical (delegue_id).
-- Conséquence : tous les patients de ce médecin sont automatiquement rattachés
-- au délégué (table patient_soignant) → le délégué les voit.
--
-- Deux déclencheurs :
--   1) à chaque rattachement médecin↔patient, on rattache aussi son délégué ;
--   2) quand on (re)définit le délégué d'un médecin, on rattache ses patients
--      déjà présents (backfill).
-- =====================================================================

alter table public.professionnel
  add column if not exists delegue_id uuid references public.professionnel(id) on delete set null;

comment on column public.professionnel.delegue_id is
  'Délégué médical rattaché à ce médecin : ses patients sont auto-rattachés au délégué.';

-- 1) À l'insertion d'un rattachement médecin→patient, rattacher son délégué.
create or replace function public.ps_rattacher_delegue()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_delegue uuid;
begin
  select p.delegue_id into v_delegue
    from public.professionnel p
    where p.id = NEW.professionnel_id and p.role = 'chirurgien';
  if v_delegue is not null and v_delegue <> NEW.professionnel_id then
    insert into public.patient_soignant (patient_id, professionnel_id)
      values (NEW.patient_id, v_delegue)
      on conflict (patient_id, professionnel_id) do nothing;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_ps_rattacher_delegue on public.patient_soignant;
create trigger trg_ps_rattacher_delegue
  after insert on public.patient_soignant
  for each row execute function public.ps_rattacher_delegue();

-- 2) Quand le délégué d'un médecin change, rattacher ses patients actuels.
create or replace function public.pro_backfill_delegue()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.role = 'chirurgien' and NEW.delegue_id is not null
     and NEW.delegue_id is distinct from OLD.delegue_id then
    insert into public.patient_soignant (patient_id, professionnel_id)
      select ps.patient_id, NEW.delegue_id
        from public.patient_soignant ps
        where ps.professionnel_id = NEW.id
      on conflict (patient_id, professionnel_id) do nothing;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_pro_backfill_delegue on public.professionnel;
create trigger trg_pro_backfill_delegue
  after update of delegue_id on public.professionnel
  for each row execute function public.pro_backfill_delegue();
