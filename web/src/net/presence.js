// Live co-presence over Supabase Realtime. Each client tracks its own state
// (handle + world position + heading + mode) on a shared "world" channel;
// everyone receives the others' state and renders their avatars.
//
// Positions are broadcast in ABSOLUTE WORLD space (see peers.js): every client
// shares one coherent map, so two players in the same port see each other in
// the right place. If the channel drops we re-join with a short backoff — and
// if presence never delivers other players, we surface a clear hint (the usual
// cause is Realtime being disabled on the project, or the API key not being
// accepted for Realtime).

import { supabase, online } from './supabase.js';

export function joinWorld({ handle, userId }) {
  const peers = new Map();           // userId -> latest state
  let onChange = () => {};
  if (!online) {
    return { update() {}, onPeers(cb) { onChange = cb; }, leave() {}, peers };
  }

  let channel = null;
  let left = false;
  let retries = 0;
  let lastState = { handle, x: 0, y: 2.4, z: 0, heading: 0, mode: 'aboard' };
  let warnedPresence = false;

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

  function join() {
    channel = supabase.channel('world', { config: { presence: { key: userId } } });
    channel
      .on('presence', { event: 'sync' }, syncPeers)
      .on('presence', { event: 'join' }, syncPeers)
      .on('presence', { event: 'leave' }, syncPeers)
      .subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          retries = 0;
          await channel.track(lastState);
        } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') && !left) {
          // re-join with a capped backoff; the socket itself auto-reconnects,
          // this re-establishes the channel + presence on top of it
          if (!warnedPresence && err) {
            console.warn('[brig] world channel error — multiplayer presence may be off:', err);
          }
          if (retries < 6) {
            const delay = Math.min(1000 * 2 ** retries, 15000);
            retries += 1;
            setTimeout(() => { if (!left) { try { supabase.removeChannel(channel); } catch {} join(); } }, delay);
          }
        }
      });
  }
  join();

  let lastSend = 0;
  return {
    // throttled position broadcast (~8/s); state is world-space
    update(state, nowMs) {
      lastState = { handle, ...state };
      if (nowMs - lastSend < 120) return;
      lastSend = nowMs;
      if (channel && channel.state === 'joined') channel.track(lastState);
    },
    onPeers(cb) { onChange = cb; },
    leave() { left = true; if (channel) supabase.removeChannel(channel); },
    peers,
  };
}
