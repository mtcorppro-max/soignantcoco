# Spec — Module « Notes de frais » (interne) + conformité DMOS

> Document de cadrage. **Aucun code à ce stade.** Les seuils et procédures
> réglementaires devront être validés par le référent conformité / juriste avant
> mise en production. (Connaissances arrêtées à début 2026.)

## 0. Décisions actées (réponses du 30/06/2026)

1. **Notes de frais = personnel interne uniquement.** Émetteurs : tous les
   comptes internes (coordinatrice, manager, dirigeant, délégué médical, livreur,
   magasinier, RH, personnel). **Exclus** : médecin/chirurgien, infirmière
   libérale, pharmacie (partenaires externes, ne déposent pas de notes de frais ;
   ils sont en revanche les **bénéficiaires** possibles côté DMOS).
2. **Validation :** chacun dépose ses notes ; routage du validateur :
   - personnel **dans la hiérarchie** (coordinatrice, délégué, livreur,
     magasinier) → **manager** (de sa région) ;
   - personnel **hors niveau d'accès** (rôle *personnel*) → **RH** ;
   - une note de la **RH** → **dirigeant** ;
   - *(par défaut, à confirmer)* note d'un **manager** → **dirigeant** ; note d'un
     **dirigeant** → autre dirigeant / administration (niveau 0).
3. **Conventions DMOS : barème/gestion globale** (cf. point 4) — module
   conventions traité en lot ultérieur.
4. **Barème DMOS global** (plateforme, mêmes seuils pour tous), paramétrable.
5. **Transparence Santé : oui**, intégrée.
6. **Références/décisions EPS : saisie manuelle** acceptée (pas de dépôt auto).

## 1. Objectif & périmètre

Deux briques complémentaires :

- **A. Notes de frais internes** : un salarié déclare ses **frais professionnels**
  (repas, transport, hébergement, péage, fournitures…), joint ses justificatifs,
  soumet ; le bon validateur approuve ; l'entreprise **rembourse**.
- **B. Conformité DMOS** : lorsqu'une **ligne** de frais constitue un **avantage
  à un professionnel de santé externe** (ex. un délégué invite un médecin à un
  repas/au congrès), cette ligne est **qualifiée DMOS** (bénéficiaire PS,
  déclaration vs autorisation, **Transparence Santé**).

S'articule avec **Marketing → Congrès & événements** (une ligne DMOS se rattache
souvent à un événement) et avec les **délégués** (principaux concernés par le DMOS).

**Inclus** : saisie multi‑lignes, justificatifs, workflow de validation routé,
remboursement, qualification DMOS, exports EPS + Transparence Santé, historique.
**Exclus** : dépôt automatique EPS (export + dépôt manuel), conseil juridique,
paie/comptabilité (export comptable possible plus tard).

## 2. Cadre réglementaire (résumé opérationnel)

- **Loi anti‑cadeaux / DMOS** : ord. 2017‑49, décret 2020‑730, arrêtés du
  07/08/2020 ; art. **L.1453‑3 et s. CSP**. S'applique aux **avantages** accordés
  par l'entreprise aux PS (les notes de frais en sont un **vecteur**).
- Deux régimes selon les **montants** (arrêté → **barème paramétrable**) :
  **déclaration** (sous seuil) / **autorisation préalable** (au‑dessus, demande
  ~2 mois avant, silence vaut acceptation).
- Dépôt sur le **téléservice EPS** (déclaration par fichier possible).
- **Transparence Santé** : publication **semestrielle** sur
  `transparence.sante.gouv.fr` (schéma de télétransmission défini).

## 3. Rôles & permissions

### Émetteurs (déposent leurs notes de frais)
Tous les comptes internes : coordinatrice, manager, dirigeant, **délégué**,
livreur, magasinier, **RH**, **personnel**. (Pas chirurgien/médecin, ni infirmière
libérale, ni pharmacie.)

### Routage du validateur (selon l'émetteur)

| Émetteur | Validateur |
|---|---|
| Coordinatrice, délégué, livreur, magasinier (hiérarchie, niv. 2/3) | **Manager** de sa région |
| Personnel (hors niveau d'accès) | **RH** |
| RH | **Dirigeant** |
| Manager *(défaut, à confirmer)* | **Dirigeant** |
| Dirigeant *(défaut, à confirmer)* | Autre dirigeant / **Admin (niveau 0)** |

- Un émetteur **ne valide jamais sa propre note**.
- S'il y a plusieurs managers/RH/dirigeants dans le périmètre, **tous** sont
  destinataires (notification) et **l'un d'eux** valide.

### Autres droits

| Action | Émetteur | Validateur | Dirigeant/Conformité | Admin N0 |
|---|---|---|---|---|
| Créer/soumettre sa note | ✅ | ✅ | ✅ | ✅ |
| Valider / rejeter | ❌ (pas la sienne) | ✅ (selon routage) | ✅ | ✅ |
| Marquer « remboursé » | ❌ | ✅ | ✅ | ✅ |
| Gérer le barème DMOS | ❌ | ❌ | ✅ | ✅ |
| Exporter EPS / Transparence | ❌ | ✅ (manager+) | ✅ | ✅ |

Cloisonnement **par prestataire** (RLS) + périmètre région/agence.

## 4. Modèle de données (proposition)

### `note_de_frais` (en‑tête)
- `id`, `prestataire_id`
- `emetteur_id` → `professionnel`
- `titre` (ex. « Congrès SOFCOT — juin 2026 »), `periode` (mois) ou
  `date_debut`/`date_fin`
- `statut` (cf. §6)
- `validateur_id` (résolu au dépôt), `valide_le`, `motif_rejet`
- `total_ttc`, `total_ht` (dérivés des lignes)
- `rembourse_le`
- `created_at`, `updated_at`

### `note_de_frais_ligne`
- `id`, `note_id` → `note_de_frais`
- `type` : `repas` | `transport` | `hebergement` | `peage` | `carburant` |
  `inscription` | `fournitures` | `autre`
- `montant_ttc`, `montant_ht`, `tva`, `date_depense`, `description`
- `evenement_id` → `evenement_marketing` (nullable)
- **DMOS (si la ligne est un avantage à un PS)** :
  - `est_avantage_ps` (bool)
  - bénéficiaire (un seul) : `beneficiaire_pro_id` → `professionnel` (médecin/
    infirmière libérale/pharmacie ayant un compte) **ou** `beneficiaire_externe_id`
    → `soignant_externe`
  - `beneficiaire_nom`, `beneficiaire_rpps`, `beneficiaire_specialite` (snapshot)
  - `dmos_regime` (calculé) : `declaration` | `autorisation`
  - `dmos_statut`, `reference_eps`, `date_depot`, `decision`
    (`autorise`|`refuse`|`tacite`), `publie_transparence`, `periode_transparence`

### `note_de_frais_justificatif`
- `id`, `ligne_id` (ou `note_id`), `chemin_stockage` (bucket privé), `libelle`,
  `mime`, `taille`

### `evenement_marketing` (rubrique Congrès & événements)
- `id`, `prestataire_id`, `nom`, `type`, `date_debut`, `date_fin`, `lieu`,
  `organisateur`, `description`, `created_by`, timestamps

### `dmos_bareme` (global plateforme, paramétrable)
- `id`, `type_avantage`, `seuil_declaration`, `seuil_autorisation`,
  `periode` (`par_manifestation`|`par_an`|`unitaire`), `date_effet`, `actif`, `note`

## 5. Barème DMOS (global, paramétrable)

Barème **unique plateforme** (mêmes seuils pour tous les prestataires), édité par
le dirigeant/conformité ou l'admin. La qualification d'une ligne utilise le
**barème actif à sa `date_depense`** → traçabilité même après changement.

## 6. Workflow

### Note de frais (interne)
```
brouillon ─(soumettre)─► soumise ─(rejeter)─► rejetee
                              │ (valider)
                          validee ─(marquer remboursé)─► remboursee ─► cloturee
```
- À la soumission : `validateur_id` résolu selon le routage (§3).
- Notification au(x) validateur(s).

### Sous‑pipeline DMOS (par ligne `est_avantage_ps = true`, après validation note)
```
a_qualifier ─► regime=declaration ─► a_declarer ─► declaree ─► (transparence) ─► clos
            └► regime=autorisation ─► a_demander ─► deposee ─► autorise/tacite/refuse ─► (transparence) ─► clos
```
- Alerte **délai** si la date de l'événement approche pour une autorisation.
- Statuts de dépôt posés **manuellement** + `reference_eps`.

## 7. Écrans / UI

**Espace « Notes de frais »** (accessible à tous les internes ; visible dans le
menu + lien depuis Marketing pour la partie DMOS) :
1. **Mes notes de frais** : liste, statuts, total, bouton « + Nouvelle note ».
2. **Création/édition d'une note** : titre/période + **lignes** (type, montant,
   date, justificatif). Sur une ligne, case **« Avantage à un professionnel de
   santé »** → choix du PS (compte ou externe) + événement ; affichage du
   **régime DMOS** calculé + alerte délai.
3. **À valider** (validateur) : file des notes à approuver/rejeter selon routage.
4. **Fiche note** : récap, lignes, justificatifs, historique, actions.

**Espace conformité (manager+/dirigeant) :**
5. **Suivi DMOS** : toutes les lignes‑avantages, filtres (PS, événement, régime,
   statut, période), cumuls par PS.
6. **Barème DMOS** (admin).
7. **Exports** : EPS (fichier en masse) + Transparence Santé + récap PDF/CSV.

## 8. Contrôles automatiques

- Résolution du **validateur** au dépôt (routage §3).
- **Qualification DMOS** de chaque ligne‑avantage (montant vs barème actif, par
  type/période) + **cumul par PS**.
- **Délai d'autorisation** (alerte si trop proche de l'événement).
- **Complétude** : champs + ≥ 1 justificatif par ligne avant soumission ; PS +
  événement obligatoires si « avantage PS ».

## 9. Exports

- **EPS — déclaration par fichier** (schéma EPS) : déclarations + demandes
  d'autorisation ; **dépôt manuel** ; saisie des `reference_eps`/décisions au retour.
- **Transparence Santé** : export au schéma de télétransmission (semestriel).
- **Interne** : CSV/PDF (récap par période, par émetteur, par PS, par événement) ;
  export comptable possible en option (remboursements).

## 10. Intégrations avec l'app existante

- **Marketing → Congrès** : `evenement_marketing` ; lien depuis les lignes‑avantages.
- **Délégués / médecins** : réutilise le lien médecin↔délégué pour proposer le PS.
- **Storage** : bucket privé pour justificatifs (URLs signées, comme les photos).
- **Rôles & RLS** : émetteurs = tous internes ; routage validateur ; helpers
  dédiés (`peutValiderNoteDe…`) ; cloisonnement prestataire/région.
- **Notifications + Realtime** : badge « notes à valider », « à déclarer »,
  « délai d'autorisation proche ».
- **PDF** : récap note + justificatifs (générateurs existants).

## 11. Sécurité / RGPD / audit

- Justificatifs et avantages à PS = données sensibles → **bucket privé**, URLs
  signées, accès cloisonné.
- **Journal d'audit** (création/validation/dépôt/remboursement).
- Conservation alignée sur les obligations légales (à définir).

## 12. Limites / hors‑périmètre

- Pas de **dépôt automatique** EPS (export + dépôt humain, références saisies).
- Pas de **conseil juridique** ni de **paie** (export comptable seulement).
- **Conventions** DMOS : lot ultérieur (point 3).

## 13. Phasage proposé

- **Lot 0 — Socle Congrès** : `evenement_marketing` + UI rubrique « Congrès &
  événements » (liste + création). *Indépendant, immédiatement utile.*
- **Lot 1 — Notes de frais internes** : `note_de_frais` + lignes + justificatifs
  + **workflow routé** (soumission → validation → remboursement) + écrans « Mes
  notes » / « À valider ».
- **Lot 2 — DMOS** : flag « avantage PS » sur les lignes, barème global, régime
  auto, suivi DMOS, alertes de délai.
- **Lot 3 — Exports** : EPS (fichier) + **Transparence Santé** + récap PDF/CSV.
- **Lot 4 — Compléments** : conventions, journal d'audit, export comptable.

## 14. Points encore à confirmer

1. Validation des notes du **manager** (→ dirigeant ?) et du **dirigeant**
   (→ autre dirigeant / admin ?).
2. Y a‑t‑il un **plafond de remboursement** interne (politique entreprise)
   distinct des seuils DMOS ?
3. Faut‑il un **export comptable** (format ?) pour les remboursements.
