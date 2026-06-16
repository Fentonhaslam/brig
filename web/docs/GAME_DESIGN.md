# Brig — Game Design & Build Plan

> The premise: you arrive in 1519 **Sevilla** as a nobody on foot. You work the
> city, the river quarter of **Triana**, the Andalusian **campiña** (countryside),
> and the river-mouth port of **Sanlúcar de Barrameda** — trading and running
> linked questlines — until you have gathered enough timber, canvas, rope and
> pitch to have a **shipwright build you your first little sailing skiff**. You
> learn to **fish** and provision, and only when you are properly outfitted do you
> dare the **Atlantic crossing** to Hispaniola — a punishing, roguelike passage
> where pirates, whales and weather will sink the unprepared and take your cargo
> (and your boat) with them.
>
> The grand nao currently at the Sevilla quay is **admin/dev-owned only**. Every
> ordinary player earns their way up from a rowboat.

This document is the source of truth. Loops/workflows build against it.

---

## 1. Player fantasy & core loop

1. **Arrive** — an interactive, cinematic intro: you step off a river barge onto
   the Sevilla quay, name your character, and a mentor (the harbourmaster) sets
   you your first objective. You *feel* dropped into a living world.
2. **Earn** — questlines + trade across Sevilla → Triana → the campiña →
   Sanlúcar. Coin and reputation, plus raw materials.
3. **Gather** — fell timber, buy/weave canvas, lay rope, render pitch. Materials
   are real inventory items with weight.
4. **Build** — bring materials (and coin) to the **shipwright** (Triana/Sanlúcar);
   he builds your **skiff** (a small single-sail boat). This is your first vessel.
5. **Provision** — **fish** the river and coast, lay in food + water, buy
   repair stock, maybe a swivel gun. Condition matters.
6. **Cross** — sail downriver to Sanlúcar, then out into the open Atlantic for
   the **crossing** to Santo Domingo. Roguelike: storms, pirates and whales
   damage the hull; run out of condition and you founder — losing the boat and
   cargo (scaled by difficulty).
7. **Arrive in the Indies** — Hispaniola becomes a new land region with its own
   questlines, trade and progression (later arc). The loop deepens.

The loop is **gather → build → provision → risk → reward → bigger boat**.

---

## 2. World & geography (one contiguous Andalusian region)

A single fixed map, walked on foot and (later) sailed down the river:

- **Sevilla** — the inland river city (already built: cathedral + Giralda, Torre
  del Oro, Alcázar, walls, cobbled streets, market). The hub: trade, the Casa de
  Contratación, the start of most questlines.
- **The Guadalquivir** — the great river running SW from Sevilla to the Atlantic.
  Walkable banks + a quay you can later take a boat down.
- **Triana** — across the river from Sevilla: the **mariners' and shipwrights'**
  quarter (also potters). Where small boats are built and crews are found.
- **The campiña** — Andalusian countryside between the city and the coast: olive
  groves, a farm/cortijo, woodland (timber), a chapel, dusty roads. Gather +
  outdoor questlines.
- **Sanlúcar de Barrameda** — the port at the river **mouth** on the Atlantic.
  The real departure point for the Indies. Shipwright + fishing + the place you
  actually set sail. Reaching it is a progression beat.
- **Hispaniola / Santo Domingo** — across the ocean (existing). The destination.

### New town pick
**Sanlúcar de Barrameda** is the headline new town (river-mouth departure port);
**Triana** is added as Sevilla's across-the-river shipwright quarter. Both are
historically real and thematically perfect for a boat-building progression.

---

## 3. Architecture: two modes

The engine already has a **ship-at-origin / world-counter-transform** model for
sailing. We formalise **two modes**:

- **LAND mode** — used on foot in the Andalusian region (and later Hispaniola).
  The world is **static** (no counter-transform churn); the full region has real
  ground + structure **colliders**; the player roams freely. This generalises the
  current "berthed" state into a proper explorable land region. *(This is the fix
  for "the land isn't walkable" — terrain currently has no colliders; only the
  quay does.)*
- **SAIL mode** — your vessel rides at the origin, the world counter-transforms
  (existing model). Used for river travel + the ocean crossing.

**Transition:** board your skiff at the Sanlúcar quay → SAIL mode → crossing →
make landfall → LAND mode at the destination. Casting off / berthing are the mode
switches (already the seam in the code).

### Walkable terrain (foundation task)
- Add collider helpers to `core/physics.js`:
  - `staticTrimesh(vertices, indices, pos?, euler?)` — bake any mesh as a fixed
    collider (for ground, slopes, irregular terrain).
  - `staticHeightfield(...)` optional later for big smooth terrain.
- Region ground + obstacles get colliders baked at LAND-mode entry (transformed
  through the world matrix, like the harbour colliders are today), removed on exit.
- The character controller already handles slopes ≤55°, autostep 0.6, snap 0.5 —
  so once colliders exist, hills/steps/banks are walkable for free.

---

## 4. Progression, items & the shipwright

### Materials (new inventory goods, with weight)
- **timber** (fell trees / buy in Triana), **canvas** (sailcloth), **rope**
  (hemp), **pitch** (caulking), **iron** (fittings/nails). Plus existing trade
  goods + **coin**.

### The skiff (first vessel)
- A small single-mast sailing boat (new low-poly toon model + its own sailing
  feel — slower, lighter, fragile). Built by the shipwright from a recipe:
  e.g. `timber×12, canvas×4, rope×6, pitch×3, iron×2, coin×N`.
- **Condition** (0–100): degrades from weather/combat/whale strikes; repaired
  with timber+pitch at a shipwright or with carried repair stock at sea.

### Vessel ownership & roles
- Player state carries a `role`: `player` (default) or `admin`/`dev`.
- The **grand nao** is flagged owner-restricted: only `admin` may take its helm.
  Players see it at the quay as set dressing + lore ("the Crown's ship"), and
  must build their own. (Role comes from the account; a dev allowlist.)

### Difficulty config (the "configurations" ask)
A `config/difficulty.js` with tiers — **Forgiving / Standard / Harsh** — knobs:
- hull damage multipliers (storm, pirate hit, whale strike)
- pirate spawn frequency + aggression
- weather severity + frequency on the crossing
- **loss on founder**: Forgiving = towed back, keep cargo; Standard = lose cargo,
  keep boat; Harsh/roguelike = lose boat + cargo, respawn in Sevilla on foot.
Default tier = **Harsh (roguelike)** per the design call; selectable.

---

## 5. Quests (linked questlines)

A small **quest framework** (`systems/quests.js`): quests are state machines with
objectives, triggers (talk, deliver, gather, reach, fish, build, sail), rewards
(coin, materials, reputation, unlocks), and **persisted** progress. Questlines
chain and cross locations:

- **"A Berth of Your Own" (spine)** — the harbourmaster sends you to earn passage
  money → introduces trade → sends you to Triana to meet the shipwright → who
  needs materials → which sends you to the campiña → … → your skiff is built →
  provision at Sanlúcar → the crossing unlocks.
- **Sevilla side-quests** — Casa de Contratación errands, a merchant's lost
  manifest, the friar's plea, a debt to settle.
- **Triana** — the shipwright's apprentice tasks, a boat race, finding a crew.
- **Campiña** — fell timber for the carpenter, clear a grove, deliver to a
  cortijo, a roadside encounter.
- **Sanlúcar** — fishing trials, caulk a hull, the pilot's warning about the
  crossing (foreshadows the danger).

Quests are **multiplayer-aware** (each player's own progress; shared world).

---

## 6. Persistence & multiplayer

- Extend Supabase player state: `role`, `coin`, `materials`, `questFlags`,
  `vessel` (type + condition + name), `stage`, `location`. Local fallback when
  offline (already the pattern).
- Multiplayer presence already shares one world (world-space coords). Players see
  each other walking Sevilla/Triana/Sanlúcar. The big nao stays admin-helmed;
  everyone else in their own skiff.

---

## 7. Build plan (phased — foundation first)

### Phase 1 — Foundation (world you can actually be in)
1. **Walkable land** — terrain collider system + bake region ground/obstacles in
   LAND mode. *(unblocks everything; the "help!")*  ✅ DONE
2. **Region build-out** — extend the map: Guadalquivir + banks, **Triana** across
   the river, the **campiña**, and **Sanlúcar** at the mouth. Detailed toon art,
   colliders, lamp/props, ambient life. Walkable end to end.
   - ✅ Guadalquivir + embankments + Puente de Barcas bridge + **Triana** (west
     bank: cobbled quay, sailors' houses, Castillo de San Jorge, the shipwright's
     slipway with a half-built hull). All walkable, verified.
   - ✅ **Campiña** fleshed out: a woodland timber stand (solid trunks), the
     cortijo farmstead (farmhouse, barn, yard walls, well, sheep), a roadside
     chapel with bell-gable, a cart + haystacks. All walkable, verified.
   - ✅ **Sanlúcar de Barrameda** — a third harbour (kind 'port', worldPoint
     (120,0,270), approachYaw 0): cobbled quay + earth town, the shipwright's
     yard + slipway, a fishing quay (boats, drying nets, barrels), fisher houses,
     the Castillo de Santiago, a church with bell-tower, and a beacon tower at
     the mouth. Berths + walkable, verified. **Phase 1.2 COMPLETE.**
3. **Interactive intro/onboarding** — cinematic arrival, name entry, mentor +
   objective UI, guided first steps. "You are entering the world."  ✅ DONE
   - Name-entry card (persists the handle), a letterbox cinematic that sweeps
     over the Sevilla quay, a Harbourmaster mentor NPC on the quay with a
     welcome/guidance conversation, a diegetic objective HUD, and a proximity
     onboarding guide (find the Harbourmaster → cross to Triana → reach the
     shipwright). Seen-once flag; returning players skip straight in. Verified.

**✅ PHASE 1 (FOUNDATION) COMPLETE** — a walkable, populated Andalusian world you
arrive into. Next: Phase 2 (quests, materials, the shipwright + your skiff).

### Phase 2 — Progression systems
4. **Quest framework** + the spine questline + first side-quests.  ◧ IN PROGRESS
   - ✅ `systems/quests.js`: quests as step state machines with talk/reach/have/
     flag triggers + rewards (coin/items), driving the objective HUD, persisted
     per-player (localStorage; Supabase sync TODO). Intro now hands off to it.
   - ✅ Spine **"A Berth of Your Own"** first steps wired end-to-end: talk
     Harbourmaster → cross to Triana → reach the shipwright (+25 coin) → gather
     materials (waits on inventory) → build (waits on a 'skiff-built' flag).
     Verified: triggers fire, reward granted, progress survives reload.
   - ✅ Shipwright NPC (Maestro Ribera) at the Triana slipway + the gather/build
     steps LIVE — the whole spine is now playable end-to-end (verified).
   - ⬜ Remaining: side-quests (Casa de Contratación, friar, merchant, etc.).
5. **Materials + gathering**  ✅ DONE — timber/canvas/rope/pitch/iron added to the
   inventory catalog; `systems/gather.js` gives located G-to-harvest points (fell
   timber at the campiña wood, cut canvas / lay rope at Triana chandlers, render
   pitch at the quay boilers) with cooldown + pickup toasts, persisted.
6. **Shipwright + the skiff**  ◧ build + the SKIFF vessel DONE; full swap-in next.
   - ✅ Lay the keel at the slipway (consumes the recipe, sets 'skiff-built').
   - ✅ `world/skiff.js` — a small single-mast toon boat with the SAME interface
     as the nao (sails/wheel/helm/colliders/update), a lighter+nimbler+fragile
     sailing profile (SKIFF_PROFILE), and solo crew. Vessel is selected at load
     (default nao; dev `setVessel('skiff')`); helm now reads a per-vessel feel
     (top speed / turn / wind). Building persists skiff ownership. Verified:
     nao default intact (len 39, 10 crew); skiff loads solo (len 9), casts off.
   - ✅ The owned skiff is now the player's ACTUAL vessel (vesselKind from
     brig:skiffOwned), and harbour quay heights are CALIBRATED per vessel:
     buildWorld({deckTop, halfLen}) sets YLIFT + BOW_GAP from the active vessel,
     so the quays meet whatever boat you sail. Verified: skiff berths + walks
     ashore level (feetY ~1.0) at BOTH Sevilla & Santo Domingo; nao unchanged
     (feetY ~3.4); no fall-through; zero errors.
7. **Role/ownership** gate (admin-only nao; players build) — ⬜ next pass: block
   taking the nao's helm for non-admins (dev allowlist/account role).
5. **Materials + gathering** (timber/canvas/rope/pitch/iron).
6. **Shipwright + the skiff** (recipe build, the new boat model + sailing feel).
7. **Role/ownership** gate (admin-only nao; players build).

### Phase 3 — Fishing, the crossing, configs
8. **Fishing** system (river + coast).
9. **Vessel condition/damage** + repair.
10. **The crossing** — punishing roguelike danger (pirates/whales/weather), loss
    rules, difficulty config tiers.
11. **Polish + QA pass** across the whole journey.

### Orchestration
- **Loops** drive phase-by-phase progress (one verified, committed feature per
  pass). **Workflows** fan out parallel, low-conflict module builds (e.g. new
  geometry modules, UI panels, quest data) then integrate in `main.js` serially.
- Every pass: build clean, headless-verify with zero real console errors, commit
  + push (auto-deploys to Vercel).

---

## 8. Definition of "high detail" (quality bar)
- Toon art consistent with the existing look (MeshToonMaterial + ink outlines +
  detail maps), rounded forms, per-material merged draw calls.
- Real colliders on everything you can bump into; nothing you fall through.
- Diegetic UI (objectives, prompts) that fits the period frame.
- Every system persisted, multiplayer-safe, and configurable where it matters.
- Verified headless each pass; no regressions to sailing/combat/market/dialogue.

---

## 9. Visual fidelity overhaul — "grounded stylized" (PBR + post)

Target: a Sea of Thieves / Fable feel — physically-lit but stylised via the
grade. The flat-toon, merged-primitive look has a hard ceiling; this rebuilds
the *foundation* and re-skins the world through it. Biggest perceived-quality
levers, in order: **lighting + post + materials**, not polygon count.

### A. Rendering foundation (lifts everything at once)
- ✅ **Ambient occlusion** (GTAO pass, radius ~3) — contact shadows in every
  crevice/corner/under-eave. The single biggest depth cue we were missing.
- ✅ ACES filmic tone mapping + bloom + warm split-tone grade (already present).
- ⬜ **Image-based lighting**: a PMREM environment from the sky (or an HDRI) →
  `scene.environment` for soft ambient + subtle specular once materials are PBR.
- ⬜ Softer/contact shadows; SMAA; tune exposure + AO strength per time-of-day.

### B. PBR material library (the "grounded" core)
- ✅ **IBL**: a PMREM `RoomEnvironment` → `scene.environment` (soft ambient +
  whisper of specular; sun still leads). `core/materials.js` exposes PBR surface
  materials (`MeshStandardMaterial` + the procedural detail textures reused as
  albedo `map` **and** `bumpMap` — stone, lime plaster, timber, terracotta tile,
  sailcloth, earth, water, metal). The world (islands.js) is migrated off flat
  toon onto these, keeping the merged-draw-call batching. Verified: 32 merged PBR
  surfaces; the city reads grounded under sun+env+AO+grade; zero errors.
- ✅ **Ship + characters** converted to PBR (ship.js MAT + avatar.js shared mats
  → MeshStandardMaterial w/ grain bump; refit recolour hooks intact). Whole core
  frame now consistently grounded (scene-wide 529 PBR / 32 toon). Verified.
- ⬜ Remaining (quick cleanup): the at-sea/conditional props still toon —
  sealife, skiff, enemy ships, cannonballs, lore stones. Plus bake vertex-colour
  AO into the static merges + rim/fresnel for silhouette.

### C. Detail kits + instancing (cheap, real detail)
- ✅ **Modular building kit** (`world/kit.js`): replaces box+cone with detailed
  townhouses — rounded plaster wall on a plinth, **inset windows** with cream
  frames + timber shutters + sills (ground + upper storey), recessed framed
  doors, eave/cornice overhang, hipped/gabled **terracotta roofs** with a ridge,
  chimneys. Binds to the merge builder (still few draw calls) and pushes the SAME
  single wall collider, so the walkable streets line up exactly. All towns
  (Sevilla/Triana/Sanlúcar/cortijo) re-skinned through it. Verified: streets +
  ashore stay walkable (feetY, no fall-through); the town reads architectural in
  morning light (screenshot); zero errors.
- ✅ **Instanced detail** (`world/scatter.js`): a swaying grass field across the
  campiña (one InstancedMesh, shader sway via onBeforeCompile + uTime, no
  per-frame matrix work) + scattered barrels & crates along the quays. Walkable
  (no colliders on detail), verified, zero errors.
- ⬜ Remaining: a town crowd + more foliage variety; LOD; the straggler PBR
  cleanup (sealife/skiff/combat/cannons/lore). (old plan below)
- ⬜ A modular **building kit**: beveled masses, **inset** windows/doors with
  frames + shutters, eaves, sills, varied **tiled roofs**, chimneys, balconies —
  replacing box+cone. Parameterised so towns vary.
- ⬜ `InstancedMesh` for repeated detail: roof tiles, cobbles, shutters, barrels,
  crates, **foliage/grass with wind**, crowd. Thousands of pieces, few draw calls.
- ⬜ LOD + DPR cap + frustum culling so fidelity stays performant.

### D. Atmosphere + water
- ✅ **Atmosphere** (in ambiance.js): dawn/dusk **sun shafts** (a broad warm
  additive glow that peaks when the sun is low, fades in storm), drifting **cloud
  billboards** that follow the camera + fade in for calm skies, and **dust motes**
  near the camera by day. All tied to dayNight (sun elevation/day amount) +
  weather (storm). Verified at dusk + midday, zero errors.
- ✅ **Straggler PBR cleanup**: sealife, skiff, enemy ships, cannonballs and lore
  stones converted off toon (shared `pbrMaterial()` helper) — scene-wide now
  **0 toon / all PBR**, verified with an enemy spawned + guns fired, zero errors.
- ⬜ Optional future polish: water reflections + shoreline foam (deferred — the
  custom water shader is risky to touch and the look is already strong).

**✅ VISUAL FIDELITY OVERHAUL (sec.9) COMPLETE** — grounded-stylized end to end:
AO + PBR + IBL + modular architecture + instanced detail + atmosphere, all PBR,
performant, walkable. Back to gameplay (sec.7).

### Process change
Stop hand-placing primitive boxes. Build the foundation + reusable instanced
kits + material library, then **re-skin** Sevilla/Triana/campiña/Sanlúcar/the
ship through them. Each pass: verified headless (zero real errors) + a
screenshot to confirm the visual lift, then commit.
