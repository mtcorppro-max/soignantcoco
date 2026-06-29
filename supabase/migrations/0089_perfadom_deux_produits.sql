-- =====================================================================
-- 0089 — PERFADOM : prise en compte des DEUX molécules de l'ordonnance
--
-- Une ordonnance perfusion a deux cases « molécule à perfuser »
-- (produit/mode/fréquence + produit2/mode2/fréquence2). L'ancienne déduction
-- ne lisait que la 1re → le palier consommables était sous-évalué quand il y a
-- 2 perfusions. Désormais :
--   - même mode + même période  → on SOMME les fréquences (palier sur le total) ;
--   - modes différents          → un jeu de forfaits par mode.
-- Installation et suivi restent facturés 1× par mode. Le forfait consommables
-- d'un mode est remplacé si le palier change (réconciliation).
-- À exécuter après 0088. Réapplique aussi les ordonnances déjà signées.
-- =====================================================================

create or replace function public.appliquer_forfaits_ordonnance(p_ord uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  c jsonb; v_pat uuid; v_dd date; v_df date; v_n int := 0;
  m1 text; m2 text; n1 int; n2 int; p1 text; p2 text;
  modes text[]; freqs int[]; pers text[];
  i int; v_mode text; v_freq int; v_per text; v_palier text; v_conso text; rec record;
begin
  select contenu, patient_id into c, v_pat from public.ordonnance
    where id = p_ord and type = 'perfusion_domicile' and statut = 'signee';
  if v_pat is null then return 0; end if;

  m1 := nullif(c->>'mode', '');
  m2 := nullif(c->>'mode2', '');
  if m1 is null then return 0; end if;
  n1 := coalesce(nullif(regexp_replace(coalesce(c->>'frequence_nb', ''), '\D', '', 'g'), '')::int, 1);
  n2 := coalesce(nullif(regexp_replace(coalesce(c->>'frequence_nb2', ''), '\D', '', 'g'), '')::int, 0);
  p1 := lower(coalesce(c->>'frequence_periode', ''));
  p2 := lower(coalesce(c->>'frequence_periode2', ''));

  if m2 is null then
    modes := array[m1]; freqs := array[n1]; pers := array[p1];
  elsif m1 = m2 and p1 = p2 then
    modes := array[m1]; freqs := array[n1 + n2]; pers := array[p1];   -- 2 molécules, même système → on cumule
  else
    modes := array[m1, m2]; freqs := array[n1, n2]; pers := array[p1, p2];
  end if;

  v_dd := coalesce(nullif(c->>'date_debut', '')::date, (select date_operation from public.patient where id = v_pat), current_date);
  v_df := coalesce(nullif(c->>'date_fin', '')::date, (select date_operation + coalesce(duree_prise_en_charge, 28) from public.patient where id = v_pat), v_dd + 28);

  for i in 1 .. array_length(modes, 1) loop
    v_mode := modes[i]; v_freq := freqs[i]; v_per := pers[i];
    if v_per like 'semaine%' then
      v_palier := case when v_freq <= 1 then '1/s' when v_freq <= 3 then '2a3/s' when v_freq <= 6 then '4a6/s' else '1/j' end;
    else
      v_palier := case when v_freq <= 1 then '1/j' when v_freq = 2 then '2/j' when v_freq = 3 then '3/j' else '>3/j' end;
    end if;

    select lpp_code into v_conso from public.perfadom_forfait
      where mode = v_mode and type_forfait = 'consommables' and palier = v_palier;

    -- Réconciliation : retire un éventuel autre forfait consommables du même mode.
    if v_conso is not null then
      delete from public.patient_forfait pf
        where pf.patient_id = v_pat
          and pf.lpp_code in (select lpp_code from public.perfadom_forfait where mode = v_mode and type_forfait = 'consommables')
          and pf.lpp_code <> v_conso;
    end if;

    -- Installation + suivi (du mode) + le bon consommables.
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
  end loop;

  return v_n;
end $$;

-- Réapplique aux ordonnances perfusion déjà signées (corrige Jeanne, etc.).
do $$
declare r record;
begin
  for r in select id from public.ordonnance where type = 'perfusion_domicile' and statut = 'signee' loop
    perform public.appliquer_forfaits_ordonnance(r.id);
  end loop;
end $$;
