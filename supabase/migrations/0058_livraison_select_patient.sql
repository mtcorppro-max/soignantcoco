-- =====================================================================
-- 0058 — Le patient voit ses propres livraisons
--
-- Permet au patient de lire les livraisons le concernant (date prévue par
-- le livreur), pour les afficher sur son calendrier de prise en charge.
-- =====================================================================

drop policy if exists livraison_select_patient on public.livraison;
create policy livraison_select_patient on public.livraison for select
  using (patient_id = public.current_patient_id());
