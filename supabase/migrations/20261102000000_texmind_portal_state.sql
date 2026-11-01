-- Private snapshot used by the TexMind Node.js API to persist its existing
-- SQLite-backed portal tables in Supabase. Only the backend secret key can access it.
create table if not exists public.texmind_portal_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.texmind_portal_state enable row level security;
revoke all on public.texmind_portal_state from anon, authenticated;
grant select, insert, update, delete on public.texmind_portal_state to service_role;

create or replace function public.set_texmind_portal_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists texmind_portal_state_updated_at on public.texmind_portal_state;
create trigger texmind_portal_state_updated_at
before update on public.texmind_portal_state
for each row execute function public.set_texmind_portal_state_updated_at();
