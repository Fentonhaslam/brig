// The world Chronicle — shared lore written at the keep. Reads are open to any
// signed-in player; inserts are stamped with the author (enforced by RLS).

import { supabase, online } from './supabase.js';

export async function listLore(limit = 100) {
  if (!online) return [];
  const { data, error } = await supabase
    .from('lore_entries')
    .select('id, author_handle, title, body, kind, pos_x, pos_z, created_at')
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
  if (error) throw error;
  return data;
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
