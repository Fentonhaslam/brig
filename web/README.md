# Brig — online 3D world

A real-time 3D world: a Spanish nao departing Sevilla at golden hour, c. 1519.
Now an **online game** — sign in, sail a shared sea with other players in real
time, and write the world's history at the keep on Hispaniola, where each entry
rises as a memory-stone everyone can see.

**Online stack:** Vite + Three.js client, **Supabase** for auth + Postgres +
Realtime. See `DEPLOY.md` to put it online; `supabase/schema.sql` is the DB.

- **Sign in / enlist** — email + the name you sail under (login screen on load).
- **The Chronicle** — press **`K`** (or the 📜 button) to read the world's lore;
  signed-in players can inscribe a new entry, which raises a memory-stone in the
  keep and broadcasts to everyone live.
- **Co-presence** — other signed-in players appear and move in real time.

## Quick start

```bash
cd /Users/fentonhaslam/Projects/brig/web
npm install
npm run dev
```

Vite opens `http://localhost:5173` in your browser automatically.

**Two ways to view the ship:**
- **Cinematic orbit** (default) — drag to orbit, scroll to zoom.
- **Walk aboard** — press **`C`** to drop a sailor onto the deck. **WASD** to move, **shift** to run, move the mouse to look (click the canvas to capture the pointer). The sailor walks the continuous weather deck, climbs the companion ladders to the forecastle and quarterdeck, and is blocked by walls, rails and the hull. Press **`C`** again to return to the cinematic camera. (Deep-link straight in with `http://localhost:5173/#walk`.)
- **Interact** — press **`E`** when a prompt appears. **`E`** is context-sensitive: it talks to whoever / operates whatever you're nearest.
- **The three patrons** — walk up to any of the noblemen who underwrote the voyage and press **`E`** to talk; press **`E`** to advance the conversation:
  - **Capitán-General Don Gonzalo de Carvajal** (amidships) — the soldier, hungry for gold and glory.
  - **Don Diego de Guzmán** (forecastle) — the crusader, who sails for souls, not silver.
  - **Don Rodrigo de Mendoza** (quarterdeck, at the chart table) — the financier who has the whole voyage ledgered to the last cask.
  Each patron has follow-up topics: after his opening, pick a question with **`1`**/**`2`** to hear more, or **`E`** to take your leave. They turn to face you and gesture while they speak.
- **The ship's company** — the vessel is crewed by a hierarchy you can talk to:
  - **Maestre Esteban de Ribera** — master of the ship, above even the patrons while at sea (quarterdeck).
  - **Officers**: the **Contramaestre** (boatswain), **Condestable** (master gunner), **Carpintero** (carpenter), **Cirujano** (surgeon) and **Timonel** (helmsman) — each with role-rich branching dialogue.
  - **Rank-and-file**: topmen, midshipmen, gunners' mates, men-at-arms and carpenter's mates wander the deck on their own with a walk cycle — hail any of them (**`E`**) for a line about their duty.
- **Weigh / let go the anchor** — press **`E`** at the capstan (or **Space** at the helm). With the anchor down the ship cannot make way.
- **Ring the ship's bell**, **fire a broadside** (starboard rail) — press **`E`** when prompted.

## Sailing the open sea

Take the helm (**`E`** at the wheel) and you command the ship across an open world:
- **A/D** steer — the whole horizon (Sevilla astern, the islands ahead) swings around you.
- **W/S** set or take in sail — more canvas, more speed.
- **Space** weigh or let go the anchor — you only make way with it up.
- The HUD shows heading, speed in knots, sail %, anchor state and your range to **Santo Domingo, La Española** — an island with its fortified settlement, church, palms and a timber dock crowded with settlers awaiting the fleet. A **mainland (Tierra Firme)** stands on the far horizon. Close on the dock and let go the anchor to make harbour.
- **Take the helm** — walk to the ship's wheel on the quarterdeck and press **`E`**. From the helm: **A/D** steer (the ship heels into the turn and the horizon swings), **W/S** hoist or strike the sails. Press **`E`** to step away. (Deep-link: `#helm`.)
- **Torch** — while walking, a warm torch lights wherever you look. Press **`F`** to toggle it.
- **Music** — *Noches en Andalucía* plays once you click or press a key (browser autoplay rule). Press **`M`** to mute.
- **Day → night** — the sun runs a full cycle (~30 min), starting mid-morning, rolling through noon, golden dusk and night. After dark, the lanterns, fire baskets and your torch light the way.

If you don't have Node installed:

```bash
brew install node
```

## What's in the scene

- **Procedural galleon** — lofted hull from parametric cross-sections, raised forecastle, two-tier sterncastle with glowing windows + lantern, three masts (square rig on fore/main, lateen on mizzen), bowsprit with spritsail, full shroud/ratline/stay rigging, gun ports, Cross of Burgundy flags, ~14 crew silhouettes for scale
- **Intricate fittings (all physically attached to the hull)** — carved gilt figurehead + beakhead at the stem, ornate windowed quarter galleries on the stern corners, channels with deadeyes carrying the shrouds, fife rails with belaying pins around the working masts, rope woolding + iron hoops banding the masts, a ship's bell on its belfry, companion ladders and turned-baluster railings between every deck level
- **Walkable sailor** — a jointed third-person character (knit cap, leather jerkin, belt + dagger, cuffed boots) with a walk cycle, raycast collision against the decks/stairs/walls, gravity and step-climbing
- **Ocean** — Three.js's water shader, sun-direction-aware reflections, animated normal-map waves
- **Sky** — Preetham atmosphere shader, sun positioned at 5.5° elevation for golden hour
- **Sevilla skyline** — Torre del Oro, Cathedral mass, Giralda (3-tier), city walls, scattered rooftops, in near-black unlit material on the far horizon
- **Lighting** — directional sun (warm, casts shadows), hemisphere fill (cool sky bounce), point light from the stern lantern
- **Post-processing** — UnrealBloomPass + custom shader pass with warm split-tone grade, vignette, and 35mm film grain
- **Animation** — ship sways/rolls on the swell, sails flutter via per-vertex perturbation, Cross of Burgundy flag waves, slow auto-orbiting camera (stops on first drag)

## Tuning knobs

| File | What to change |
|------|---------------|
| `src/sky.js` | `elevation` and `azimuth` for sun position; `turbidity` and `rayleigh` for atmosphere warmth |
| `src/water.js` | `waterColor` for ocean tint; `distortionScale` for wave roughness |
| `src/ship.js` | `SHIP_LENGTH`, `SHIP_BEAM`, `HULL_DEPTH` at the top to resize the hull; material colors in the `MAT` block |
| `src/skyline.js` | `SKYLINE_DISTANCE`, `SKYLINE_BEARING_DEG` to move the city around |
| `src/post.js` | Bloom `strength`/`radius`/`threshold`; `vignetteAmount`, `warmShadow`/`coolHighlight` for grade |
| `src/main.js` | `toneMappingExposure` for overall brightness; camera position/target; `autoRotateSpeed` |

Hot reload works — save a file and the browser re-renders automatically.

## Build for deployment

```bash
npm run build
```

Outputs static files in `dist/`. Drop into Vercel, Netlify, GitHub Pages, anywhere.

## Known limits

- Water normals texture is fetched from `threejs.org/examples/` — requires internet on first load. Cache after that.
- Shadow map is 2K — bumping to 4K hurts perf on integrated GPUs.
- Ship has ~30K triangles; the scene runs comfortably at 60fps on M-series Macs.
