-- Supabase-managed migration operations may create public tables as supabase_admin.
-- Keep future tables from inheriting non-row-level client privileges.
-- Ordinary SELECT/INSERT/UPDATE/DELETE grants and RLS behavior are unchanged.
alter default privileges for role supabase_admin in schema public
revoke truncate, references, trigger, maintain on tables
from public, anon, authenticated;
