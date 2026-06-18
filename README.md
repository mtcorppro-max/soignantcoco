# SoignantCoco — Télésurveillance post-opératoire à domicile

Fondation **Next.js + Supabase** (web responsive, thème rose foncé / blanc).
Suivi à domicile des patients récemment opérés du système digestif :
relevé de constantes, alertes sur seuil, surveillance / acquittement /
escalade par la coordinatrice.

> Cadre : voir `cahier-des-charges-telesurveillance.md`. ⚠️ Statut probable de
> **dispositif médical (DM logiciel)** et **hébergement HDS** : relèvent du
> client (cf. §2 & §11). Supabase hébergé n'est **pas** HDS → prototype
> uniquement ; en production, Supabase auto-hébergé sur l'infra HDS du client.

## Ce qui est livré

| Brique | État |
|---|---|
| Migration SQL complète (tables, RLS, trigger d'alerte) | ✅ `supabase/migrations/0001_init.sql` |
| Login patient par **code unique** | ✅ |
| Login **pro** (email / mot de passe) + rôles | ✅ |
| Interface patient (accueil, saisie mesure, suivi graphique) | ✅ |
| Cockpit coordinatrice (dashboard trié par criticité) | ✅ |
| Fiche patient (courbes + **seuil ajustable** + dernières valeurs) | ✅ |
| Centre d'alertes (acquittement / escalade tracée + horodatée) | ✅ |
| Création de patient + génération de code (service_role) | ✅ |
| Matrice des droits (coordinatrice / chirurgien / délégué) | ✅ RLS + UI |
| Envoi SMS (n°1 → escalade n°2), conseils météo, messagerie, photos, questionnaires | 🟡 **stubs / à brancher** (cf. §10) |

## Prérequis

- Node 18+ (testé sous Node 24)
- Un projet **Supabase** (hébergé pour le prototype, ou self-hosted)

## Installation

```bash
npm install
cp .env.local.example .env.local   # puis renseigner les 3 clés Supabase
```

`.env.local` :

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # secret, serveur uniquement
```

## Base de données

Appliquer la migration sur le projet Supabase :

- **Dashboard** : SQL Editor → coller `supabase/migrations/0001_init.sql` → Run
- **ou CLI** : `supabase db push` (si le repo est lié au projet)

Puis charger les données de démo :

```bash
node --env-file=.env.local scripts/seed.mjs
```

Comptes créés (mot de passe `demo1234`) :

- `coordinatrice@demo.fr` — cockpit complet
- `chirurgien@demo.fr` — lecture + messagerie
- `delegue@demo.fr` — lecture seule (supervision)
- **Patient** — code de connexion : `DEMO1234`

Le seed insère une température à 39,2 °C (> seuil 38,5) qui déclenche
automatiquement une alerte via le trigger SQL — visible dans le centre d'alertes.

## Lancer

```bash
npm run dev    # http://localhost:3000
```

- `/` → choix Patient / Équipe médicale
- `/login/patient` → connexion par code
- `/login/pro` → connexion pro
- `/patient` → interface patient (mobile)
- `/pro` → cockpit

## Architecture

```
src/
  app/
    page.tsx                 choix de connexion
    login/{patient,pro}/     écrans de login
    api/
      patient-login/         échange code → session
      patients/              création patient (service_role)
      logout/
    patient/                 interface patient (layout mobile + nav)
      page.tsx · mesure/ · suivi/
    pro/                     cockpit
      page.tsx (dashboard) · alertes/ · patients/[id]/ · nouveau-patient/
  components/                MesureChart, SeuilEditor, AlerteCard, …
  lib/
    supabase/{client,server,admin,middleware}.ts
    auth.ts · constants.ts · roles.ts · types.ts
  middleware.ts              garde des routes + refresh session
supabase/migrations/0001_init.sql
scripts/seed.mjs
```

### Sécurité / RGPD

- **RLS** active sur toutes les tables : un pro ne voit que les patients de son
  prestataire ; un patient ne voit que son dossier. Le délégué est en lecture
  seule et **exclu de la messagerie**.
- La `service_role` n'est utilisée que côté serveur (création de patients).
- Connexion patient par code régénérable (cf. cahier des charges §9).
- Journal d'audit : à compléter (table dédiée ou `pgaudit`) — non inclus dans
  cette fondation.

## Points laissés en stub (à brancher — §10 du cahier des charges)

1. **SMS** : sur INSERT dans `alerte`, envoyer SMS n°1 puis escalade n°2 après
   `ESCALADE_DELAI_MINUTES`. Brancher Twilio ou OVH via Edge Function / webhook DB.
2. **Conseils météo** : Edge Function cron + API météo selon `code_postal`.
3. **Messagerie, photos, questionnaires** : tables & RLS prêtes, UI à construire.
4. **Audit** : journalisation des consultations/saisies.
5. **HDS** : migration vers hébergement certifié pour la production.
```
