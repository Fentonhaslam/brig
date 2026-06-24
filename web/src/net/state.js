// Cloud-backed player progression — quests, hull condition, vessel, and last
// known ship position. Keyed by the authenticated user's UUID (FK to
// auth.users) so only the owner can read or write their own row (see
// player_state RLS in supabase/schema.sql). Guests stay localStorage-only;
// cloud sync activates on sign-in. Silent no-op when offline.

import { supabase, online } from './supabase.js';

// fetch the stored state blob for the signed-in user, or null (no row / offline)
export async function pullState(userId) {
  if (!online) return null;
  try {
    const { data, error } = await supabase
      .from('player_state').select('state').eq('user_id', userId).maybeSingle();
    if (error || !data) return null;
    return data.state || null;
  } catch { return null; }
}

// upsert the state blob for the signed-in user
export async function pushState(userId, state) {
  if (!online) return;
  try {
    await supabase.from('player_state').upsert(
      { user_id: userId, state, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  } catch {}
}
