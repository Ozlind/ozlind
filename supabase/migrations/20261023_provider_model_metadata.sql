-- Persist the concrete upstream model selected for each assistant reply.
-- Nullable for historical rows and safe for rolling deployments.
alter table public.messages
  add column if not exists provider_model text;

comment on column public.messages.provider_model is
  'Concrete upstream model ID used for this response, distinct from the UI-facing model key.';
