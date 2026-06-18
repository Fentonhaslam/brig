// The world Chronicle — shared lore written at the keep. Reads are open to any
// signed-in player; inserts are stamped with the author (enforced by RLS).
// Moderation: admins can soft-hide entries; RLS strips hidden rows from the
// SELECT for non-admins automatically.

import { supabase, online } from './supabase.js';

export async function listLore(limit = 100) {
  if (!online) return [];
  // include hidden_at so admins can see + label hidden rows; for non-admins
  // RLS removes hidden rows entirely.
  const { data, error } = await supabase
    .from('lore_entries')
    .select('id, author_id, author_handle, title, body, kind, pos_x, pos_z, created_at, hidden_at')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) { console.warn('[lore] list failed', error.message); return []; }
  return data;
}

export async function addLore({ session, handle, title, body, kind = 'monument', pos = null }) {
  if (!online || !session) throw new Error('Not signed in.');
  const row = { author_id: session.user.id, author_handle: handle, title, body, kind };
  if (pos) { row.pos_x = pos.x; row.pos_z = pos.z; }
  const { data, error } = await supabase
    .from('lore_entries').insert(row).select().single();
  if (error) {
    // surface the trigger's rate-limit message as a friendly error
    if (error.message && error.message.includes('rate_limit')) {
      const e = new Error('Too many inscriptions in the last hour — wait a while before raising another stone.');
      e.code = 'rate_limit';
      throw e;
    }
    throw error;
  }
  return data;
}

// admin moderation: soft-hide / restore an entry. RLS enforces that only
// admins can land this update (any non-admin caller silently no-ops).
export async function hideLore({ id }) {
  if (!online) throw new Error('Offline.');
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('lore_entries')
    .update({ hidden_at: new Date().toISOString(), hidden_by: user?.id || null })
    .eq('id', id);
  if (error) throw error;
}

export async function unhideLore({ id }) {
  if (!online) throw new Error('Offline.');
  const { error } = await supabase
    .from('lore_entries')
    .update({ hidden_at: null, hidden_by: null })
    .eq('id', id);
  if (error) throw error;
}

// Live: fire `cb(entry)` whenever any player adds a new entry.
export function subscribeLore(cb) {
  if (!online) return () => {};
  const ch = supabase
    .channel('lore-inserts')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'lore_entries' },
      (payload) => cb(payload.new))
    .subscribe();
  return () => supabase.removeChannel(ch);
}
