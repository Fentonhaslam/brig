// Cloud-backed player progression — quests, hull condition and which vessel you
// own. The hold (cargo/coin) has its own `inventories` table; this carries the
// rest so a signed-in player keeps their progress across devices (and a cache
// wipe). Same shape as inventory's sync: best-effort, keyed by account, and a
// silent no-op when offline or before the `player_state` table is applied
// (see web/supabase/schema.sql) — the game stays fully playable on localStorage.

import { supabase, online } from './supabase.js';

// fetch the stored state blob for a key, or null (missing row / no table / offline)
export async function pullState(key) {
  if (!online) return null;
  try {
    const { data, error } = await supabase
      .from('player_state').select('state').eq('player_key', key).maybeSingle();
    if (error || !data) return null;
    return data.state || null;
  } catch { return null; }
}

// upsert the state blob for a key (handle stored for readability/debugging)
export async function pushState(key, handle, state) {
  if (!online) return;
  try {
    await supabase.from('player_state').upsert(
      { player_key: key, handle, state, updated_at: new Date().toISOString() },
      { onConflict: 'player_key' },
    );
  } catch {}
}
