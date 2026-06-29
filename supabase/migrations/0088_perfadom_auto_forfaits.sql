-- =====================================================================
-- 0088 — Déduction automatique des forfaits PERFADOM depuis l'ordonnance
--
-- À la signature d'une ordonnance « perfusion_domicile », on attache au
-- patient les forfaits correspondants, déduits du contenu de l'ordonnance :
--   mode (Diffuseur / Système actif électrique / Gravité)
--   + fréquence (frequence_nb / frequence_periode) → palier
--   → installation (1×) + suivi (hebdo) + consommables (hebdo, par palier)
-- sur les dates de l'ordonnance (date_debut / date_fin). Modifiable ensuite
-- par la coordinatrice sur la fiche patient.
-- À exécuter après 0083 + seed_forfaits.sql (les codes doivent exister dans lpp).
-- =====================================================================

-- 1) Table de correspondance mode+palier -> code LPP.
create table if not exists public.perfadom_forfait (
  mode         text not null,
  type_forfait text not null check (type_forfait in ('installation', 'suivi', 'consommables')),
  palier       text not null default '',   -- '' pour installation/suivi ; ex. '2/j','2a3/s' pour consommables
  lpp_code     text not null references public.lpp(code),
  primary key (mode, type_forfait, palier)
);
alter table public.perfadom_forfait enable row level security;
drop policy if exists perfadom_forfait_select on public.perfadom_forfait;
create policy perfadom_forfait_select on public.perfadom_forfait for select using (public.current_professionnel_id() is not null);
drop policy if exists perfadom_forfait_write on public.perfadom_forfait;
create policy perfadom_forfait_write on public.perfadom_forfait for all
  using (public.current_niveau() = 0 or public.current_role_pro() = 'dirigeant')
  with check (public.current_niveau() = 0 or public.current_role_pro() = 'dirigeant');

insert into public.perfadom_forfait (mode, type_forfait, palier, lpp_code) values
  -- Diffuseur
  ('Diffuseur', 'installation', '',      '1164778'),
  ('Diffuseur', 'suivi',        '',      '1179165'),
  ('Diffuseur', 'consommables', '1/s',   '1156023'),
  ('Diffuseur', 'consommables', '2a3/s', '1101648'),
  ('Diffuseur', 'consommables', '4a6/s', '1107250'),
  ('Diffuseur', 'consommables', '1/j',   '1154018'),
  ('Diffuseur', 'consommables', '2/j',   '1131030'),
  ('Diffuseur', 'consommables', '3/j',   '1102270'),
  ('Diffuseur', 'consommables', '>3/j',  '1122395'),
  -- Système actif électrique
  ('Système actif électrique', 'installation', '',      '1176882'),
  ('Système actif électrique', 'suivi',        '',      '1178556'),
  ('Système actif électrique', 'consommables', '1/s',   '1168470'),
  ('Système actif électrique', 'consommables', '2a3/s', '1136061'),
  ('Système actif électrique', 'consommables', '4a6/s', '1126364'),
  ('Système actif électrique', 'consommables', '1/j',   '1187489'),
  ('Système actif électrique', 'consommables', '2/j',   '1169675'),
  ('Système actif électrique', 'consommables', '3/j',   '1134211'),
  ('Système actif électrique', 'consommables', '>3/j',  '1134211'),
  -- Gravité (installation + suivi combinés)
  ('Gravité', 'installation', '',      '1172619'),
  ('Gravité', 'consommables', '1/j',   '1121326'),
  ('Gravité', 'consommables', '2/j',   '1143279'),
  ('Gravité', 'consommables', '3/j',   '1153616'),
  ('Gravité', 'consommables', '>3/j',  '1153616'),
  ('Gravité', 'consommables', '1/s',   '1185160'),
  ('Gravité', 'consommables', '2a3/s', '1185160'),
  ('Gravité', 'consommables', '4a6/s', '1153616')
on conflict (mode, type_forfait, palier) do update set lpp_code = excluded.lpp_code;

-- 2) Application des forfaits déduits d'une ordonnance perfusion.
create or replace function public.appliquer_forfaits_ordonnance(p_ord uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  c jsonb; v_pat uuid; v_mode text; n int; per text; v_palier text; v_dd date; v_df date; rec record; v_n int := 0;
begin
  select contenu, patient_id into c, v_pat from public.ordonnance
    where id = p_ord and type = 'perfusion_domicile' and statut = 'signee';
  if v_pat is null then return 0; end if;
  v_mode := c->>'mode';
  if v_mode is null or v_mode = '' then return 0; end if;

  n := coalesce(nullif(regexp_replace(coalesce(c->>'frequence_nb', ''), '\D', '', 'g'), '')::int, 1);
  per := lower(coalesce(c->>'frequence_periode', ''));
  if per like 'semaine%' then
    v_palier := case when n <= 1 then '1/s' when n <= 3 then '2a3/s' when n <= 6 then '4a6/s' else '1/j' end;
  else
    v_palier := case when n <= 1 then '1/j' when n = 2 then '2/j' when n = 3 then '3/j' else '>3/j' end;
  end if;

  v_dd := nullif(c->>'date_debut', '')::date;
  v_df := nullif(c->>'date_fin', '')::date;
  if v_dd is null then select date_operation into v_dd from public.patient where id = v_pat; end if;
  v_dd := coalesce(v_dd, current_date);
  if v_df is null then select (date_operation + coalesce(duree_prise_en_charge, 28)) into v_df from public.patient where id = v_pat; end if;
  v_df := coalesce(v_df, v_dd + 28);

  for rec in
    select pf.lpp_code from public.perfadom_forfait pf
    where pf.mode = v_mode
      and ( (pf.type_forfait in ('installation', 'suivi') and pf.palier = '')
         or (pf.type_forfait = 'consommables' and pf.palier = v_palier) )
  loop
    if not exists (select 1 from public.patient_forfait x where x.patient_id = v_pat and x.lpp_code = rec.lpp_code and x.actif) then
      insert into public.patient_forfait (patient_id, lpp_code, date_debut, date_fin, actif)
      values (v_pat, rec.lpp_code, v_dd, v_df, true);
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;
grant execute on function public.appliquer_forfaits_ordonnance(uuid) to authenticated;

-- 3) Déclenchement à la signature.
create or replace function public.trg_ordonnance_forfaits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.type = 'perfusion_domicile' and NEW.statut = 'signee'
     and (TG_OP = 'INSERT' or OLD.statut is distinct from 'signee') then
    perform public.appliquer_forfaits_ordonnance(NEW.id);
  end if;
  return NEW;
end $$;
drop trigger if exists ordonnance_forfaits on public.ordonnance;
create trigger ordonnance_forfaits after insert or update on public.ordonnance
  for each row execute function public.trg_ordonnance_forfaits();

-- 4) Rattrapage des ordonnances perfusion déjà signées.
do $$
declare r record;
begin
  for r in select id from public.ordonnance where type = 'perfusion_domicile' and statut = 'signee' loop
    perform public.appliquer_forfaits_ordonnance(r.id);
  end loop;
end $$;
