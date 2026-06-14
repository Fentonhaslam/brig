// Supabase client — created from Vite env vars (safe to ship: the publishable
// / anon key is a public client key, protected by Row-Level Security).
//
//   VITE_SUPABASE_URL   = https://<project-ref>.supabase.co
//   VITE_SUPABASE_KEY   = <publishable or anon key>
//
// Put these in web/.env (see .env.example). If they're missing the game still
// runs offline — auth/multiplayer just stay disabled.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const online = Boolean(url && key);

export const supabase = online
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 12 } },
    })
  : null;

if (!online) {
  console.warn('[brig] Supabase not configured — running offline (no login / multiplayer).');
}
