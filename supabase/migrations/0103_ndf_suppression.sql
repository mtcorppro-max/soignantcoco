-- =====================================================================
-- 0103 — Notes de frais : suppression élargie
--
-- L'émetteur peut supprimer SA note tant qu'elle n'est pas validée/remboursée
-- (brouillon, soumise, rejetee). L'admin (niveau 0) peut tout supprimer.
-- Les notes validées / remboursées restent protégées (traçabilité comptable).
-- =====================================================================

drop policy if exists ndf_delete on public.note_de_frais;
create policy ndf_delete on public.note_de_frais for delete
  using (
    public.current_niveau() = 0
    or (emetteur_id = public.current_professionnel_id() and statut in ('brouillon', 'soumise', 'rejetee'))
  );
