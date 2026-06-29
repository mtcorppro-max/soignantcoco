-- =====================================================================
-- 0071 — Nouveau rôle « magasinier »
--
-- Gère le magasin d'une agence : seul à modifier le stock, réapprovisionner
-- (bons de commande) et préparer les commandes (picking). Pas d'accès patient
-- (aucune branche dans peut_voir_patient). Rattaché à une agence (pour le
-- périmètre du stock) ; niveau 3 par défaut = aucun accès opérationnel.
--
-- ⚠️ ALTER TYPE ... ADD VALUE doit s'exécuter SEUL (migration dédiée).
-- =====================================================================

alter type role_professionnel add value if not exists 'magasinier';
