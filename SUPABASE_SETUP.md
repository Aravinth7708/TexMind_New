# Supabase persistence setup

The Node.js API persists its SQLite-backed portal data to a private Supabase
snapshot. The browser never receives the database secret.

1. In the Supabase dashboard for project `ejmcolpttrmdhrcejxul`, open **SQL Editor**
   and run `supabase/migrations/20261102000000_texmind_portal_state.sql`.
2. Copy `nodejs-backend/.env.example` to `nodejs-backend/.env`.
3. In Supabase **Project Settings → API Keys**, copy the project's **secret**
   key (or legacy **service_role** key) into `SUPABASE_SERVICE_ROLE_KEY` in
   `nodejs-backend/.env`. Keep it only on the backend. The anon key is designed
   for public clients and is not sufficient for this server-side snapshot with
   RLS enabled.
4. Start the backend from `nodejs-backend` using `npm run dev`.

On first startup, the current local database is saved as the initial Supabase
snapshot. Later backend starts restore the snapshot, and successful API writes
queue an updated snapshot. Local administrator accounts and business records
are part of the protected snapshot.
