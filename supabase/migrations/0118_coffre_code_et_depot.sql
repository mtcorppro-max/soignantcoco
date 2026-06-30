-- =====================================================================
-- 0118 — Coffre-fort : code d'accès personnel + dépôt par RH/dirigeant
--
-- • Code d'accès propre au coffre (comme une combinaison de coffre), haché
--   (pgcrypto / bcrypt). Stocké sur le professionnel.
-- • Le RH / dirigeant peut DÉPOSER un document dans le coffre d'un salarié
--   (depose_par), mais la LECTURE reste réservée au propriétaire.
-- =====================================================================

create extension if not exists pgcrypto;

alter table public.professionnel
  add column if not exists coffre_code_hash text;

alter table public.coffre_document
  add column if not exists depose_par uuid references public.professionnel(id) on delete set null;

-- A-t-on déjà défini un code de coffre ?
create or replace function public.coffre_a_un_code()
returns boolean language sql stable security definer set search_path = public as $$
  select coffre_code_hash is not null from public.professionnel where id = public.current_professionnel_id();
$$;

-- Définir le code (création) — uniquement s'il n'existe pas encore.
create or replace function public.coffre_definir_code(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare deja boolean;
begin
  if length(coalesce(p_code,'')) < 4 then raise exception 'Code trop court (4 caractères min.).'; end if;
  select coffre_code_hash is not null into deja from public.professionnel where id = public.current_professionnel_id();
  if deja then return false; end if;
  update public.professionnel set coffre_code_hash = crypt(p_code, gen_salt('bf')) where id = public.current_professionnel_id();
  return true;
end; $$;

-- Vérifier le code.
create or replace function public.coffre_verifier_code(p_code text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare h text;
begin
  select coffre_code_hash into h from public.professionnel where id = public.current_professionnel_id();
  if h is null then return false; end if;
  return h = crypt(p_code, h);
end; $$;

-- Changer le code (en connaissant l'ancien).
create or replace function public.coffre_changer_code(p_old text, p_new text)
returns boolean language plpgsql security definer set search_path = public as $$
declare h text;
begin
  if length(coalesce(p_new,'')) < 4 then raise exception 'Nouveau code trop court (4 caractères min.).'; end if;
  select coffre_code_hash into h from public.professionnel where id = public.current_professionnel_id();
  if h is null or h <> crypt(p_old, h) then return false; end if;
  update public.professionnel set coffre_code_hash = crypt(p_new, gen_salt('bf')) where id = public.current_professionnel_id();
  return true;
end; $$;

grant execute on function public.coffre_a_un_code()              to authenticated;
grant execute on function public.coffre_definir_code(text)       to authenticated;
grant execute on function public.coffre_verifier_code(text)      to authenticated;
grant execute on function public.coffre_changer_code(text,text)  to authenticated;
