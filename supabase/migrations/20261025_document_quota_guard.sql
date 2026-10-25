-- Enforce the per-user document quota at the database boundary.
-- The transaction-scoped advisory lock serializes concurrent uploads for one user.
create or replace function public.enforce_document_quota()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  existing_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  select count(*)::integer
    into existing_count
    from public.documents
   where user_id = new.user_id;

  if existing_count >= 20 then
    raise exception using
      errcode = 'P0001',
      message = 'DOCUMENT_LIMIT_REACHED';
  end if;

  return new;
end;
$function$;

drop trigger if exists documents_enforce_quota on public.documents;
create trigger documents_enforce_quota
before insert on public.documents
for each row execute function public.enforce_document_quota();

revoke all on function public.enforce_document_quota() from public, anon, authenticated;
