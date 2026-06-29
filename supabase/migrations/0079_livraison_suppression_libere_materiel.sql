-- =====================================================================
-- 0079 — Supprimer une livraison prévue libère le matériel affecté
--
-- À la suppression d'une livraison non livrée, le matériel de location qui
-- lui était affecté (statut « affecte ») doit revenir « disponible ». La
-- coordinatrice n'a pas le droit d'écrire sur equipement (RLS magasinier) :
-- on le fait via un trigger BEFORE DELETE (security definer).
-- =====================================================================

create or replace function public.trg_livraison_avant_suppression()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.equipement
    set statut = 'disponible', livraison_id = null, updated_at = now()
    where livraison_id = OLD.id and statut = 'affecte';
  return OLD;
end $$;

drop trigger if exists livraison_avant_suppression on public.livraison;
create trigger livraison_avant_suppression before delete on public.livraison
  for each row execute function public.trg_livraison_avant_suppression();
