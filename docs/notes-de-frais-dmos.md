# Spec — Module « Notes de frais / Avantages PS » (conformité DMOS)

> Document de cadrage. **Aucun code à ce stade.** Les seuils et procédures
> réglementaires devront être validés par le référent conformité / juriste avant
> mise en production. (Connaissances arrêtées à début 2026.)

## 1. Objectif & périmètre

Permettre à l'entreprise (PSAD / prestataire) de **saisir, valider, tracer et
déclarer** les **avantages** accordés aux **professionnels de santé** (PS) —
repas, hospitalité de congrès (transport, hébergement, inscription), dons,
honoraires de prestation… — dans le respect de la **loi anti‑cadeaux (DMOS)** et
de l'obligation **Transparence Santé**.

Le module s'articule avec la rubrique **Marketing → Congrès & événements** (un
avantage est presque toujours rattaché à un événement) et avec les **délégués
médicaux** (principaux saisisseurs) et leurs **médecins**.

Périmètre **inclus** : saisie, justificatifs, qualification DMOS (déclaration vs
autorisation), workflow de validation interne, historique par PS/événement,
**exports** vers le téléservice EPS et vers Transparence Santé.

Périmètre **exclu** (limites) : dépôt automatique sur EPS (pas d'API publique →
export + dépôt manuel/semi‑auto), conseil juridique, calcul fiscal.

## 2. Cadre réglementaire (résumé opérationnel)

- **Loi anti‑cadeaux / DMOS** : ord. 2017‑49, décret 2020‑730 (15/06/2020),
  arrêtés du 07/08/2020 ; art. **L.1453‑3 et s. CSP**.
- Deux régimes selon les **montants** (fixés par arrêté, donc **paramétrables**) :
  - **Déclaration** (sous seuil) ;
  - **Autorisation préalable** (au‑dessus) — demande **en amont** (~2 mois),
    **silence vaut acceptation** au‑delà du délai.
- Dépôt sur le **téléservice EPS** (Entreprises ↔ Professionnels de Santé), avec
  possibilité de **déclaration par fichier** (dépôt en masse, schéma défini).
- **Transparence Santé** (« Sunshine » FR) : publication **semestrielle** des
  avantages/conventions/rémunérations sur `transparence.sante.gouv.fr` (schéma de
  télétransmission défini). Obligation **distincte** mais alimentée par les mêmes
  données → mutualisation possible.

> Les **montants exacts** ne sont pas codés en dur : ils vivent dans un **barème
> paramétrable** (cf. §5) avec date d'effet.

## 3. Rôles & permissions

| Action | Délégué | Manager | Dirigeant | Conformité* | Admin (N0) |
|---|---|---|---|---|---|
| Créer / soumettre un avantage | ✅ (ses PS) | ✅ | ✅ | ✅ | ✅ |
| Voir les avantages | ses PS / agences | sa région | national | national | tout |
| Valider (workflow) | ❌ | ✅ | ✅ | ✅ | ✅ |
| Gérer le barème DMOS | ❌ | ❌ | ✅ | ✅ | ✅ |
| Exporter EPS / Transparence | ❌ | ✅ | ✅ | ✅ | ✅ |
| Marquer « déposé / décision reçue » | ❌ | ✅ | ✅ | ✅ | ✅ |

\* Rôle « conformité » optionnel — peut être porté par le dirigeant au départ
(pas de nouveau rôle obligatoire pour le MVP).

Cloisonnement **par prestataire** (RLS), et par **région/agence** selon le niveau
du délégué/manager, cohérent avec l'existant.

## 4. Modèle de données (proposition)

### `evenement_marketing` (adosse la rubrique Congrès & événements)
- `id`, `prestataire_id`
- `nom`, `type` (congrès / soirée scientifique / atelier / autre)
- `date_debut`, `date_fin`, `lieu`, `organisateur`
- `description`, `created_by`, timestamps

### `avantage` (la note de frais / avantage)
- `id`, `prestataire_id`
- **Bénéficiaire PS** (un seul des deux) :
  - `beneficiaire_pro_id` → `professionnel` (médecin avec compte), **ou**
  - `beneficiaire_externe_id` → `soignant_externe` (médecin sans compte)
  - `beneficiaire_nom`, `beneficiaire_rpps`, `beneficiaire_specialite` *(snapshot
    figé au moment de la saisie)*
- `evenement_id` → `evenement_marketing` (nullable)
- `convention_id` → `convention` (nullable, cf. ci‑dessous)
- `type_avantage` : `repas` | `transport` | `hebergement` | `inscription` |
  `don` | `honoraires_prestation` | `autre`
- `nature` : `nature` | `especes`
- `montant_ttc`, `montant_ht`, `devise` (défaut EUR)
- `date_avantage`
- `description`
- `regime` (calculé) : `declaration` | `autorisation`
- `statut` (cf. §6)
- `reference_eps`, `date_depot`, `date_decision`, `decision`
  (`autorise` | `refuse` | `tacite`)
- `publie_transparence` (bool), `periode_transparence`
- `created_by`, `valide_par`, `valide_le`, timestamps

### `avantage_justificatif`
- `id`, `avantage_id`, `chemin_stockage` (bucket Storage privé), `libelle`,
  `mime`, `taille`, `created_at`

### `convention` (optionnel — Lot 2)
- `id`, `prestataire_id`, `beneficiaire_*`, `objet`, `date_debut`, `date_fin`,
  `montant_global`, `fichier` (PDF signé), `statut`

### `dmos_bareme` (paramétrage des seuils)
- `id`, `prestataire_id` (ou global plateforme)
- `type_avantage`
- `seuil_declaration`, `seuil_autorisation`
- `periode` : `par_manifestation` | `par_an` | `unitaire`
- `date_effet`, `actif`, `note`

## 5. Barème DMOS paramétrable

Écran d'administration (dirigeant / conformité) listant, par `type_avantage`,
les seuils en vigueur + historique par `date_effet`. La qualification d'un
avantage utilise **le barème actif à sa `date_avantage`** → traçabilité même si
les seuils changent ensuite. Aucune valeur en dur dans le code.

## 6. Workflow (statuts)

```
brouillon
   │ (soumettre)
soumis ───────────────► rejete
   │ (valider interne)
valide_interne
   │ (qualification auto: regime)
   ├─ regime = declaration ─► a_declarer ─► declare ─► (publie_transparence) ─► cloture
   └─ regime = autorisation ─► a_demander ─► demande_deposee
                                   │
                                   ├─ autorise ─► (publie_transparence) ─► cloture
                                   ├─ tacite   ─► (publie_transparence) ─► cloture
                                   └─ refuse   ─► clos_refuse
```

- Passage `a_demander` : alerte sur le **délai** (l'autorisation doit être
  demandée ~2 mois avant l'événement → l'outil prévient si la date est trop
  proche).
- `declare` / `demande_deposee` : statut posé **manuellement** après dépôt EPS,
  avec `reference_eps`.

## 7. Écrans / UI (dans Marketing)

1. **Liste des avantages** : filtres (PS, événement, type, statut, période,
   régime), badges de statut, total des montants, recherche.
2. **Création / édition d'un avantage** : choix du PS (compte ou externe), de
   l'événement, type, montants (TTC/HT), date, description, **upload des
   justificatifs**. Affiche en direct le **régime calculé** (déclaration vs
   autorisation) + alerte de délai.
3. **Fiche avantage** : récap, justificatifs, historique de workflow, boutons
   d'action selon rôle/statut.
4. **Vue par professionnel** : cumul des avantages d'un PS sur une période
   (utile pour les seuils annuels et un contrôle).
5. **Barème DMOS** (admin) : édition des seuils.
6. **Exports** : EPS (fichier de déclaration en masse) + Transparence Santé.

## 8. Contrôles automatiques

- **Qualification du régime** : `montant` vs barème actif (par type, en tenant
  compte de la période — manifestation / annuelle / unitaire).
- **Cumul** : agrégation par PS et par période pour les seuils annuels.
- **Délai d'autorisation** : alerte si `date_avantage − today < délai requis`.
- **Complétude** : champs obligatoires + au moins un justificatif avant dépôt.
- **Cohérence** : un avantage « hospitalité » doit être rattaché à un événement.

## 9. Exports

- **EPS — déclaration par fichier** : génération d'un fichier au **schéma EPS**
  (déclarations + demandes d'autorisation) pour dépôt sur le portail. L'outil
  **prépare** ; le **dépôt reste manuel** (pas d'API). Récupération ensuite des
  `reference_eps` / décisions à saisir.
- **Transparence Santé** : export au **schéma de télétransmission** (avantages,
  conventions, rémunérations) pour la publication semestrielle.
- **Exports internes** : CSV / PDF (récap par période, par PS, par événement)
  pour audit et reporting direction.

## 10. Intégrations avec l'app existante

- **Marketing → Congrès & événements** : `evenement_marketing` alimente la
  rubrique ; un avantage s'y rattache.
- **Délégués / médecins** : réutilise le lien médecin↔délégué (déjà en place) ;
  un délégué saisit pour **ses** médecins (comptes ou externes).
- **Storage** : bucket privé pour les justificatifs (même principe que les photos
  de cicatrice : upload + URL signée).
- **Rôles & RLS** : cloisonnement prestataire + périmètre région/agence ; helper
  `peutMarketing` étendu (ou nouveau `peutNotesFrais`).
- **Notifications** : badge / message interne sur les avantages à valider, à
  déclarer, ou dont le délai d'autorisation approche (réutilise le système de
  notifications + Realtime).
- **PDF** : convention type + récap (générateurs PDF déjà utilisés).

## 11. Sécurité / RGPD / audit

- Données = **avantages à des PS nommés** → données sensibles ; accès cloisonné,
  justificatifs en **bucket privé** (URLs signées, jamais publiques).
- **Journal d'audit** (qui a créé/validé/déposé, quand) pour les contrôles.
- Conservation : durée alignée sur les obligations légales (à définir avec le
  juriste).

## 12. Limites / hors‑périmètre (à assumer)

- Pas de **dépôt automatique** EPS (export + dépôt humain).
- Pas de **conseil juridique** : l'outil **assiste** la conformité, ne la
  garantit pas ; validation finale humaine.
- Les **seuils/schémas** évoluent → barème paramétrable + exports versionnés.

## 13. Phasage proposé

- **Lot 0 — Socle congrès** : table `evenement_marketing` + UI de la rubrique
  « Congrès & événements » (liste + création). *Indépendant, utile tout de suite.*
- **Lot 1 — MVP notes de frais** : `avantage` + justificatifs + workflow simple
  (brouillon → soumis → validé) + qualification régime via barème + liste/fiche.
- **Lot 2 — Conformité** : statuts déclaration/autorisation, alertes de délai,
  vue par PS (cumuls), barème admin complet.
- **Lot 3 — Exports** : EPS (fichier en masse) + Transparence Santé + récap PDF.
- **Lot 4 — Conventions & audit** : `convention`, PDF type, journal d'audit,
  notifications dédiées.

## 14. Questions à trancher (avant build)

1. Périmètre des PS concernés : uniquement **médecins**, ou aussi **infirmières
   libérales / pharmaciens** (la loi vise large) ?
2. Qui valide et qui dépose réellement (délégué propose, mais **qui** dépose sur
   EPS) ? Faut‑il un rôle **« conformité »** dédié ?
3. Gère‑t‑on les **conventions** dès le départ ou en Lot 4 ?
4. Barème **global plateforme** (mêmes seuils pour tous) ou **par prestataire** ?
5. Faut‑il intégrer **Transparence Santé** dès le MVP ou plus tard ?
6. Récupération des **références/décisions EPS** : saisie manuelle suffisante ?
