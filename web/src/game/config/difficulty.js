// Difficulty tiers for the crossing — multipliers on the things that wear your
// hull down, and the loss rule when you founder. Persisted (brig:difficulty).
// Default Harsh: the Atlantic is meant to be feared.
//
//   storm   — multiplier on storm hull-erosion at sea
//   pirate  — multiplier on a pirate cannonball's hull damage
//   whale   — multiplier on a whale-strike's hull damage
//   loss    — what foundering costs: 'towed' (keep all), 'cargo' (lose cargo,
//             keep boat), 'all' (lose boat + cargo, back to Valdara on foot)

export const TIERS = {
  forgiving: { label: 'Forgiving', storm: 0.5, pirate: 0.55, whale: 0.5, loss: 'towed' },
  standard: { label: 'Standard', storm: 1.0, pirate: 1.0, whale: 1.0, loss: 'cargo' },
  harsh: { label: 'Harsh', storm: 1.7, pirate: 1.6, whale: 1.7, loss: 'all' },
};

export function loadDifficulty() {
  try { const t = localStorage.getItem('brig:difficulty'); if (TIERS[t]) return t; } catch {}
  return 'harsh';
}
export function saveDifficulty(name) { try { localStorage.setItem('brig:difficulty', name); } catch {} }
export function tier(name) { return TIERS[name] || TIERS.harsh; }
