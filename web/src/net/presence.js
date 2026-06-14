// Live co-presence over Supabase Realtime. Each client tracks its own state
// (handle + position + heading + mode) on a shared "world" channel; everyone
// receives the others' state and renders their avatars.

import { supabase, online } from './supabase.js';

export function joinWorld({ handle, userId }) {
  const peers = new Map();           // userId -> latest state
  let onChange = () => {};
  if (!online) {
    return { update() {}, onPeers(cb) { onChange = cb; }, leave() {}, peers };
  }

  const channel = supabase.channel('world', {
    config: { presence: { key: userId } },
  });

  function syncPeers() {
    const state = channel.presenceState();
    peers.clear();
    for (const key of Object.keys(state)) {
      if (key === userId) continue;          // skip ourselves
      const meta = state[key][0];
      if (meta) peers.set(key, meta);
    }
    onChange(peers);
  }

  channel
    .on('presence', { event: 'sync' }, syncPeers)
    .on('presence', { event: 'join' }, syncPeers)
    .on('presence', { event: 'leave' }, syncPeers)
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ handle, x: 0, z: 0, heading: 0, mode: 'aboard', t: 0 });
      }
    });

  let last = 0;
  return {
    // throttled position broadcast (~8/s)
    update(state, nowMs) {
      if (nowMs - last < 120) return;
      last = nowMs;
      channel.track({ handle, ...state });
    },
    onPeers(cb) { onChange = cb; },
    leave() { supabase.removeChannel(channel); },
    peers,
  };
}
