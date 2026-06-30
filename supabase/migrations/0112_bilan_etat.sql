-- =====================================================================
-- 0112 — Bilan « état général » rempli par le patient
--
-- Questionnaire court (réponses en jsonb). Le patient remplit le sien ; les
-- soignants le consultent selon leur périmètre (peut_voir_patient).
-- =====================================================================

create table if not exists public.bilan_etat (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patient(id) on delete cascade,
  reponses    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_bilan_patient on public.bilan_etat (patient_id, created_at desc);

alter table public.bilan_etat enable row level security;

-- Le patient voit / dépose ses propres bilans.
drop policy if exists bilan_patient_select on public.bilan_etat;
create policy bilan_patient_select on public.bilan_etat for select
  using (exists (select 1 from public.patient p where p.id = patient_id and p.user_id = auth.uid()));
drop policy if exists bilan_patient_insert on public.bilan_etat;
create policy bilan_patient_insert on public.bilan_etat for insert
  with check (exists (select 1 from public.patient p where p.id = patient_id and p.user_id = auth.uid()));

-- Les soignants lisent selon leur périmètre.
drop policy if exists bilan_pro_select on public.bilan_etat;
create policy bilan_pro_select on public.bilan_etat for select
  using (public.peut_voir_patient(patient_id));
