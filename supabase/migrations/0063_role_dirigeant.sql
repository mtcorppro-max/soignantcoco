-- =====================================================================
-- 0063 — Nouveau rôle « dirigeant »
--
-- Compte de direction : ne s'occupe pas des patients, pas de niveau d'accès
-- opérationnel. Accès uniquement à la PEC (vue nationale = tout le
-- prestataire) et à l'annuaire « équipe dirigeante ».
-- Créé uniquement par un administrateur (niveau 0).
--
-- ⚠️ ALTER TYPE ... ADD VALUE doit s'exécuter SEUL (hors transaction avec
--    une utilisation de la nouvelle valeur). D'où une migration dédiée.
-- =====================================================================

alter type role_professionnel add value if not exists 'dirigeant';
