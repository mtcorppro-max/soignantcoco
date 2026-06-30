-- =====================================================================
-- 0104 — Rappel d'une note de frais (RPC sécurisée)
--
-- Repasse une note soumise/rejetée en brouillon pour la modifier, via une
-- fonction SECURITY DEFINER qui vérifie elle-même la propriété (émetteur) ou
-- l'admin. Indépendant de la policy d'UPDATE (robuste si 0102 mal appliquée).
-- =====================================================================

create or replace function public.ndf_recall(p_note uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.note_de_frais
     set statut = 'brouillon', motif_rejet = null, updated_at = now()
   where id = p_note
     and statut in ('soumise', 'rejetee')
     and (emetteur_id = public.current_professionnel_id() or public.current_niveau() = 0);
  return found;
end;
$$;

grant execute on function public.ndf_recall(uuid) to authenticated;
