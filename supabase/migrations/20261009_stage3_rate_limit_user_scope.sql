-- Stage 3: make the privileged rate-limit RPC explicitly user-scoped.
-- The service-role caller must pass the UUID obtained from verified Supabase Auth.
drop function if exists public.check_rate_limit(integer, integer);

create or replace function public.check_rate_limit(
  p_user_id uuid,
  p_limit integer default 20,
  p_window_seconds integer default 60
)
returns table (allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := p_user_id;
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
  set
    request_count = case
      when r.window_start <= now() - make_interval(secs => v_window_seconds)
        then 1
      else r.request_count + 1
    end,
    window_start = case
      when r.window_start <= now() - make_interval(secs => v_window_seconds)
        then now()
      else r.window_start
    end
  returning r.request_count, r.window_start
  into v_count, v_start;

  return query
  select
    v_count <= v_limit,
    greatest(v_limit - v_count, 0),
    greatest(
      1,
      ceil(extract(epoch from (
        v_start + make_interval(secs => v_window_seconds) - now()
      )))::integer
    );
end;
$$;

revoke all on function public.check_rate_limit(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_rate_limit(uuid, integer, integer)
  to service_role;
