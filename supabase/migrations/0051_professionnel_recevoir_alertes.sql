-- =====================================================================
-- 0051 — Médecin / chirurgien : réception des alertes patients (opt-in)
-- Par défaut un médecin ne reçoit PAS les alertes patients ni les messages
-- d'organisation interne (astreintes). Il peut activer la réception des
-- alertes patients depuis son profil (ou un gestionnaire dans l'équipe).
-- =====================================================================

alter table public.professionnel
  add column if not exists recevoir_alertes boolean not null default false;
