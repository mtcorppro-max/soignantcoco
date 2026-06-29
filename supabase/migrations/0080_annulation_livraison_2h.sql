-- =====================================================================
-- 0080 — Annulation d'une livraison livrée : fenêtre de 2 heures
--
-- Une fois une livraison validée (statut « livree »), elle ne peut être
-- annulée (repassée à un autre statut) que dans les 2 heures suivant
-- `livree_le`. Au-delà, l'opération est rejetée. La plateforme (niveau 0)
-- conserve la possibilité de corriger.
-- =====================================================================

create or replace function public.trg_livraison_annulation_2h()
returns trigger language plpgsql as $$
begin
  if OLD.statut = 'livree' and NEW.statut is distinct from 'livree'
     and OLD.livree_le is not null
     and OLD.livree_le < now() - interval '2 hours'
     and coalesce(public.current_niveau(), 9) <> 0 then
    raise exception 'Annulation impossible : la livraison a été validée il y a plus de 2 heures.';
  end if;
  return NEW;
end $$;

drop trigger if exists livraison_annulation_2h on public.livraison;
create trigger livraison_annulation_2h before update on public.livraison
  for each row execute function public.trg_livraison_annulation_2h();
