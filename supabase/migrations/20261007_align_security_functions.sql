-- Align security-sensitive RPCs with the production definitions.
create or replace function public.match_document_chunks(
  query_embedding extensions.vector(768),
  match_threshold double precision default 0.55,
  match_count integer default 8
)
returns table (id uuid, document_id uuid, document_name text, chunk_index integer, content text, similarity double precision)
language sql stable set search_path = public, extensions
as $$
  select dc.id, dc.document_id, d.name, dc.chunk_index, dc.content,
    1 - (dc.embedding <=> query_embedding)
  from public.document_chunks as dc
  inner join public.documents as d
    on d.id = dc.document_id
   and d.user_id = dc.user_id
  where dc.user_id = (select auth.uid())
    and d.status = 'ready'
    and dc.embedding is not null
    and 1 - (dc.embedding <=> query_embedding) >= greatest(0, least(match_threshold, 1))
  order by dc.embedding <=> query_embedding
  limit greatest(1, least(match_count, 20));
$$;
revoke all on function public.match_document_chunks(extensions.vector(768), double precision, integer) from public;
grant execute on function public.match_document_chunks(vector(768), double precision, integer) to authenticated;

create or replace function public.check_rate_limit(
  p_limit integer default 20,
  p_window_seconds integer default 60
)
returns table (allowed boolean, remaining integer, retry_after integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_window_seconds integer := least(greatest(coalesce(p_window_seconds, 60), 1), 60);
  v_count integer;
  v_start timestamptz;
begin
  if v_uid is null then
    return query select false, 0, v_window_seconds;
    return;
  end if;
  insert into public.rate_limits as r (user_id, request_count, window_start)
  values (v_uid, 1, now())
  on conflict (user_id) do update
  set request_count = case when r.window_start <= now() - make_interval(secs => v_window_seconds) then 1 else r.request_count + 1 end,
      window_start = case when r.window_start <= now() - make_interval(secs => v_window_seconds) then now() else r.window_start end
  returning r.request_count, r.window_start into v_count, v_start;
  return query
  select v_count <= v_limit,
    greatest(v_limit - v_count, 0),
    greatest(1, ceil(extract(epoch from (v_start + make_interval(secs => v_window_seconds) - now())))::integer);
end;
$$;
revoke all on function public.check_rate_limit(integer, integer) from public;
grant execute on function public.check_rate_limit(integer, integer) to authenticated;
