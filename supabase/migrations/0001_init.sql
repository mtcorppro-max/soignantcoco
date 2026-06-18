-- =====================================================================
-- Télésurveillance post-opératoire à domicile — Schéma Supabase (Postgres)
--
-- Couvre : prestataire, professionnels (3 rôles), patients (login par code),
-- seuils, mesures, alertes (génération auto), messagerie, photos,
-- conduites à tenir, questionnaires, conseils. RLS activé sur toutes les tables.
--
-- ⚠️ HDS : l'instance Supabase hébergée (supabase.com / AWS) n'est PAS
-- certifiée HDS et ne satisfait pas l'obligation de stockage en EEE.
-- OK pour le prototype. Pour la PRODUCTION : Supabase auto-hébergé sur
-- l'infra HDS du client, ou Postgres managé chez un hébergeur HDS (OVH...).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Types
-- ---------------------------------------------------------------------
create type role_professionnel        as enum ('coordinatrice', 'chirurgien', 'delegue');
create type type_mesure               as enum ('temperature', 'ta_systolique', 'ta_diastolique', 'spo2', 'poids');
create type statut_alerte             as enum ('declenchee', 'acquittee', 'escaladee', 'resolue');
create type statut_surveillance       as enum ('active', 'suspendue', 'terminee');
create type type_declenchement_conseil as enum ('quotidien', 'meteo_chaleur', 'meteo_froid', 'manuel');

-- ---------------------------------------------------------------------
-- 2. Génération de code unique patient (login côté patient)
-- ---------------------------------------------------------------------
create or replace function public.generer_code_unique()
returns text language sql volatile as $$
  select upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
$$;
-- Collision improbable (8 hex) mais la contrainte UNIQUE + retry applicatif
-- au moment de la création reste recommandée.

-- ---------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------

create table public.prestataire (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  created_at  timestamptz not null default now()
);

-- Un professionnel = un utilisateur Supabase Auth (email/mot de passe ou magic link)
create table public.professionnel (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users(id) on delete cascade,
  prestataire_id uuid not null references public.prestataire(id) on delete restrict,
  nom            text not null,
  email          text,
  role           role_professionnel not null,
  created_at     timestamptz not null default now()
);

-- Un patient = un utilisateur Auth provisionné par la coordinatrice.
-- Convention de login (prototype) : l'utilisateur Auth est créé avec
--   email    = lower(code_unique) || '@patient.soignantcoco.local'
--   password = code_unique
-- Le patient se connecte donc avec son seul code (cf. /api/patient-login).
create table public.patient (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid unique references auth.users(id) on delete set null,
  prestataire_id uuid not null references public.prestataire(id) on delete restrict,
  code_unique    text not null unique default public.generer_code_unique(),
  nom            text not null,
  statut         statut_surveillance not null default 'active',
  code_postal    text,             -- localisation pour les conseils météo
  -- numéros qui reçoivent les alertes (n°1 principal, n°2 backup/astreinte)
  tel_alerte_1   text,
  tel_alerte_2   text,
  created_at     timestamptz not null default now()
);

create table public.seuil (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patient(id) on delete cascade,
  type_mesure type_mesure not null,
  valeur_min  numeric,           -- borne basse (ex. tension), nullable
  valeur_max  numeric,           -- borne haute (ex. température), nullable
  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (patient_id, type_mesure, actif) deferrable initially deferred
);

create table public.mesure (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patient(id) on delete cascade,
  type        type_mesure not null,
  valeur      numeric not null,
  horodatage  timestamptz not null default now()
);
create index idx_mesure_patient_date on public.mesure (patient_id, horodatage desc);

create table public.alerte (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references public.patient(id) on delete cascade,
  mesure_id      uuid references public.mesure(id) on delete set null,
  statut         statut_alerte not null default 'declenchee',
  declenchee_le  timestamptz not null default now(),
  acquittee_par  uuid references public.professionnel(id),
  acquittee_le   timestamptz,
  escalade_vers  text,          -- ex. « Dr X »
  escalade_le    timestamptz,
  escalade_note  text,          -- ex. « patient adressé aux urgences à 14h32 »
  resolue_le     timestamptz,
  canal          text           -- canal de notification (sms_1, sms_2, push...)
);
create index idx_alerte_patient_statut on public.alerte (patient_id, statut);

create table public.message (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patient(id) on delete cascade,
  auteur_user_id  uuid not null references auth.users(id),
  contenu         text not null,
  horodatage      timestamptz not null default now()
);
create index idx_message_patient_date on public.message (patient_id, horodatage);

create table public.photo (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patient(id) on delete cascade,
  auteur_user_id  uuid not null references auth.users(id),
  chemin_stockage text not null,   -- chemin dans le bucket Supabase Storage
  legende         text,
  horodatage      timestamptz not null default now()
);

create table public.conduite_a_tenir (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patient(id) on delete cascade,
  titre       text not null,
  contenu     text not null,
  created_at  timestamptz not null default now()
);

create table public.questionnaire (
  id             uuid primary key default gen_random_uuid(),
  prestataire_id uuid not null references public.prestataire(id) on delete cascade,
  titre          text not null,
  actif          boolean not null default true
);

create table public.question (
  id               uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.questionnaire(id) on delete cascade,
  libelle          text not null,
  type_reponse     text not null default 'texte',  -- texte | echelle | oui_non ...
  ordre            int not null default 0
);

create table public.reponse (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question(id) on delete cascade,
  patient_id  uuid not null references public.patient(id) on delete cascade,
  valeur      text,
  horodatage  timestamptz not null default now()
);

create table public.conseil (
  id             uuid primary key default gen_random_uuid(),
  prestataire_id uuid not null references public.prestataire(id) on delete cascade,
  titre          text not null,
  contenu        text not null,
  declenchement  type_declenchement_conseil not null default 'quotidien',
  seuil_meteo    numeric,          -- ex. °C au-delà duquel diffuser le conseil chaleur
  actif          boolean not null default true,
  created_at     timestamptz not null default now()
);
-- Bibliothèque rédigée/validée par l'équipe médicale du prestataire.
-- La diététique post-op digestif est sensible : aucun conseil auto non validé.

create table public.conseil_diffuse (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patient(id) on delete cascade,
  conseil_id  uuid not null references public.conseil(id) on delete cascade,
  diffuse_le  timestamptz not null default now(),
  lu          boolean not null default false
);
create index idx_conseil_diffuse_patient on public.conseil_diffuse (patient_id, diffuse_le desc);

-- ---------------------------------------------------------------------
-- 4. Génération automatique d'alerte sur dépassement de seuil
-- ---------------------------------------------------------------------
create or replace function public.generer_alerte()
returns trigger language plpgsql security definer set search_path = public as $$
declare s record;
begin
  select * into s
    from public.seuil
   where patient_id = new.patient_id and type_mesure = new.type and actif = true
   limit 1;

  if found and (
       (s.valeur_min is not null and new.valeur < s.valeur_min)
    or (s.valeur_max is not null and new.valeur > s.valeur_max)
  ) then
    insert into public.alerte (patient_id, mesure_id, statut)
    values (new.patient_id, new.id, 'declenchee');
    -- NB : l'envoi SMS/push se fait côté app (webhook / Edge Function
    -- déclenché sur insertion dans `alerte`), pas dans la base.
  end if;

  return new;
end;
$$;

create trigger trg_generer_alerte
  after insert on public.mesure
  for each row execute function public.generer_alerte();

-- ---------------------------------------------------------------------
-- 5. Fonctions d'aide pour la RLS
--    (SECURITY DEFINER => lecture des tables de référence sans récursion RLS)
-- ---------------------------------------------------------------------
create or replace function public.current_prestataire_id()
returns uuid language sql stable security definer set search_path = public as $$
  select prestataire_id from public.professionnel where user_id = auth.uid()
$$;

create or replace function public.current_role_pro()
returns role_professionnel language sql stable security definer set search_path = public as $$
  select role from public.professionnel where user_id = auth.uid()
$$;

create or replace function public.current_patient_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.patient where user_id = auth.uid()
$$;

-- Le patient (= mesure/message/...) appartient-il au prestataire du pro courant ?
create or replace function public.patient_dans_mon_prestataire(p uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.patient
     where id = p and prestataire_id = public.current_prestataire_id()
  )
$$;

-- ---------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------
alter table public.prestataire      enable row level security;
alter table public.professionnel    enable row level security;
alter table public.patient          enable row level security;
alter table public.seuil            enable row level security;
alter table public.mesure           enable row level security;
alter table public.alerte           enable row level security;
alter table public.message          enable row level security;
alter table public.photo            enable row level security;
alter table public.conduite_a_tenir enable row level security;
alter table public.questionnaire    enable row level security;
alter table public.question         enable row level security;
alter table public.reponse          enable row level security;
alter table public.conseil          enable row level security;
alter table public.conseil_diffuse  enable row level security;

-- PRESTATAIRE : un pro voit le sien
create policy presta_select on public.prestataire for select
  using (id = public.current_prestataire_id());

-- PROFESSIONNEL : un pro voit l'équipe de son prestataire
create policy pro_select on public.professionnel for select
  using (prestataire_id = public.current_prestataire_id());

-- PATIENT
create policy patient_select_self on public.patient for select
  using (user_id = auth.uid());
create policy patient_select_pro on public.patient for select
  using (prestataire_id = public.current_prestataire_id());
create policy patient_write_coord on public.patient for all
  using (prestataire_id = public.current_prestataire_id() and public.current_role_pro() = 'coordinatrice')
  with check (prestataire_id = public.current_prestataire_id() and public.current_role_pro() = 'coordinatrice');

-- SEUIL : pros en lecture, coordinatrice en écriture
create policy seuil_select_pro on public.seuil for select
  using (public.patient_dans_mon_prestataire(patient_id));
create policy seuil_select_patient on public.seuil for select
  using (patient_id = public.current_patient_id());
create policy seuil_write_coord on public.seuil for all
  using (public.patient_dans_mon_prestataire(patient_id) and public.current_role_pro() = 'coordinatrice')
  with check (public.patient_dans_mon_prestataire(patient_id) and public.current_role_pro() = 'coordinatrice');

-- MESURE : patient (les siennes), pros en lecture, coordinatrice peut saisir
create policy mesure_select_patient on public.mesure for select
  using (patient_id = public.current_patient_id());
create policy mesure_insert_patient on public.mesure for insert
  with check (patient_id = public.current_patient_id());
create policy mesure_select_pro on public.mesure for select
  using (public.patient_dans_mon_prestataire(patient_id));
create policy mesure_insert_coord on public.mesure for insert
  with check (public.patient_dans_mon_prestataire(patient_id) and public.current_role_pro() = 'coordinatrice');

-- ALERTE : pros en lecture, coordinatrice acquitte/escalade (insertion via trigger)
create policy alerte_select_pro on public.alerte for select
  using (public.patient_dans_mon_prestataire(patient_id));
create policy alerte_update_coord on public.alerte for update
  using (public.patient_dans_mon_prestataire(patient_id) and public.current_role_pro() = 'coordinatrice')
  with check (public.patient_dans_mon_prestataire(patient_id) and public.current_role_pro() = 'coordinatrice');

-- MESSAGE : patient + coordinatrice + chirurgien (délégué EXCLU du chat)
create policy message_select_patient on public.message for select
  using (patient_id = public.current_patient_id());
create policy message_insert_patient on public.message for insert
  with check (patient_id = public.current_patient_id() and auteur_user_id = auth.uid());
create policy message_select_pro on public.message for select
  using (public.patient_dans_mon_prestataire(patient_id) and public.current_role_pro() in ('coordinatrice','chirurgien'));
create policy message_insert_pro on public.message for insert
  with check (public.patient_dans_mon_prestataire(patient_id)
              and public.current_role_pro() in ('coordinatrice','chirurgien')
              and auteur_user_id = auth.uid());

-- PHOTO : patient envoie/voit les siennes, pros en lecture
create policy photo_select_patient on public.photo for select
  using (patient_id = public.current_patient_id());
create policy photo_insert_patient on public.photo for insert
  with check (patient_id = public.current_patient_id() and auteur_user_id = auth.uid());
create policy photo_select_pro on public.photo for select
  using (public.patient_dans_mon_prestataire(patient_id));

-- CONDUITE À TENIR : patient (les siennes) + pros, gérée par la coordinatrice
create policy cat_select_patient on public.conduite_a_tenir for select
  using (patient_id = public.current_patient_id());
create policy cat_select_pro on public.conduite_a_tenir for select
  using (public.patient_dans_mon_prestataire(patient_id));
create policy cat_write_coord on public.conduite_a_tenir for all
  using (public.patient_dans_mon_prestataire(patient_id) and public.current_role_pro() = 'coordinatrice')
  with check (public.patient_dans_mon_prestataire(patient_id) and public.current_role_pro() = 'coordinatrice');

-- QUESTIONNAIRE / QUESTION : pros gèrent, patient lit l'actif de son prestataire
create policy quest_select_pro on public.questionnaire for select
  using (prestataire_id = public.current_prestataire_id());
create policy quest_select_patient on public.questionnaire for select
  using (actif and prestataire_id = (select prestataire_id from public.patient where id = public.current_patient_id()));
create policy quest_write_coord on public.questionnaire for all
  using (prestataire_id = public.current_prestataire_id() and public.current_role_pro() = 'coordinatrice')
  with check (prestataire_id = public.current_prestataire_id() and public.current_role_pro() = 'coordinatrice');

create policy question_select on public.question for select
  using (exists (select 1 from public.questionnaire q where q.id = questionnaire_id
                 and (q.prestataire_id = public.current_prestataire_id()
                      or (q.actif and q.prestataire_id = (select prestataire_id from public.patient where id = public.current_patient_id())))));
create policy question_write_coord on public.question for all
  using (exists (select 1 from public.questionnaire q where q.id = questionnaire_id
                 and q.prestataire_id = public.current_prestataire_id() and public.current_role_pro() = 'coordinatrice'))
  with check (exists (select 1 from public.questionnaire q where q.id = questionnaire_id
                 and q.prestataire_id = public.current_prestataire_id() and public.current_role_pro() = 'coordinatrice'));

-- RÉPONSE : patient répond/voit les siennes, pros en lecture
create policy reponse_select_patient on public.reponse for select
  using (patient_id = public.current_patient_id());
create policy reponse_insert_patient on public.reponse for insert
  with check (patient_id = public.current_patient_id());
create policy reponse_select_pro on public.reponse for select
  using (public.patient_dans_mon_prestataire(patient_id));

-- CONSEIL : géré par la coordinatrice, lu par le patient une fois diffusé
create policy conseil_select_pro on public.conseil for select
  using (prestataire_id = public.current_prestataire_id());
create policy conseil_write_coord on public.conseil for all
  using (prestataire_id = public.current_prestataire_id() and public.current_role_pro() = 'coordinatrice')
  with check (prestataire_id = public.current_prestataire_id() and public.current_role_pro() = 'coordinatrice');
create policy conseil_select_patient on public.conseil for select
  using (exists (select 1 from public.conseil_diffuse cd
                 where cd.conseil_id = conseil.id and cd.patient_id = public.current_patient_id()));

-- CONSEIL_DIFFUSE : patient voit/marque-lu les siens, pros en lecture
-- (insertion par l'Edge Function quotidienne via service_role)
create policy cd_select_patient on public.conseil_diffuse for select
  using (patient_id = public.current_patient_id());
create policy cd_update_patient on public.conseil_diffuse for update
  using (patient_id = public.current_patient_id())
  with check (patient_id = public.current_patient_id());
create policy cd_select_pro on public.conseil_diffuse for select
  using (public.patient_dans_mon_prestataire(patient_id));
