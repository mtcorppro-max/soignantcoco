-- =====================================================================
-- 0012 — Lien photo ↔ suivi
--
-- Permet de rattacher une photo de cicatrice déjà présente dans le dossier
-- (envoyée par le patient) à une fiche de suivi : le soignant choisit parmi
-- les photos existantes dans le formulaire « Nouveau suivi ».
-- La photo reste visible dans la galerie « Photos de cicatrice ».
--
-- À exécuter dans le SQL Editor de Supabase.
-- =====================================================================

alter table public.photo
  add column if not exists suivi_id uuid references public.suivi(id) on delete set null;

create index if not exists idx_photo_suivi on public.photo (suivi_id);

-- Les soignants du prestataire peuvent rattacher/détacher une photo d'un suivi
-- (mise à jour de suivi_id) pour les patients de leur prestataire.
drop policy if exists photo_update_pro on public.photo;
create policy photo_update_pro on public.photo for update
  using (public.patient_dans_mon_prestataire(patient_id))
  with check (public.patient_dans_mon_prestataire(patient_id));
