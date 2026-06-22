// Tidier console output. Two jobs:
//  1) a small structured [brig] logger (info / warn / perf) with consistent
//     styling, so our own diagnostics stand out from third-party noise.
//  2) a narrow filter that swallows a handful of KNOWN-BENIGN messages — the
//     404s from optional Supabase tables that aren't provisioned yet, and the
//     "running offline" notice — so the DevTools console isn't a wall of red on
//     a fresh/offline setup. Everything else passes through untouched.

const BENIGN = [
  /inventories/i, /lore_entries/i, /player_state/i, /feedback.*(404|not found)/i,
  /Failed to load resource.*(supabase|404)/i, /supabase.*(offline|realtime)/i,
];
const isBenign = (args) => {
  const s = args.map((a) => (typeof a === 'string' ? a : (a && a.message) || '')).join(' ');
  return BENIGN.some((re) => re.test(s));
};

let installed = false;
export function installLogFilter() {
  if (installed) return; installed = true;
  const err = console.error.bind(console);
  const warn = console.warn.bind(console);
  console.error = (...a) => { if (!isBenign(a)) err(...a); };
  console.warn = (...a) => { if (!isBenign(a)) warn(...a); };
}

const tag = 'color:#e8b860;font-weight:600';
export const log = {
  info: (...a) => console.log('%c[brig]', tag, ...a),
  warn: (...a) => console.warn('%c[brig]', tag, ...a),
  perf: (...a) => console.log('%c[brig·perf]', 'color:#9fd29a;font-weight:600', ...a),
};
