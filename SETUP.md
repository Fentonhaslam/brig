# Brig Departure — Sevilla, Golden Hour

Render setup for Unreal Engine 5.3+ on macOS.

## What the script does

Spawns and configures, in your active level:
- **Sun** — DirectionalLight at ~9° elevation, 3200K, warm rim-lighting from behind-left
- **Sky** — SkyAtmosphere, SkyLight (real-time capture), VolumetricCloud
- **Fog** — Exponential height fog with volumetric inscatter, warm golden tint
- **Ocean** — WaterBodyOcean (requires Water plugin)
- **Post-process** — Manual exposure (EV 11.5), warm bloom, anamorphic-style lens flares, split-tone color grade (warm shadows + warm highlights), gentle vignette, 35mm grain, motion blur
- **Camera** — CineCameraActor, 35mm lens at f/4, 2.39:1 sensor, low hero angle
- **Ship** — your imported mesh, or a placeholder cube if you haven't grabbed one yet
- **Sevilla skyline silhouette** — Torre del Oro, Cathedral mass, Giralda, city walls, scattered rooftops, all spawned as primitives with a near-black unlit material, ~220m beyond the ship along the camera's forward bearing. Reads as a true silhouette against the warm sky regardless of sun angle.
- **Movie Render Queue job** — pre-configured at 3840×1600 PNG sequence

## One-time setup

### 1. Enable plugins
`Edit → Plugins`, then enable and restart:
- **Water**
- **Movie Render Queue**
- **Python Editor Script Plugin** (usually on by default)

### 2. Get a ship mesh

UE has no built-in conquistador-era ship. Pick one:

**Free / cheap options:**
- **Fab.com** (Epic's marketplace) — search `galleon`, `carrack`, `tall ship`. The *Pirate Ship* / *Spanish Galleon* packs by various creators are usually $0–$30.
- **Sketchfab** — search `carrack` or `galleon`, filter to CC-BY or downloadable. Export as FBX, import via `Content Drawer → +Add → Import`.
- **Quaternius / Kenney** — free low-poly ship assets, good for blockout/previs.

Once imported, copy the asset's content-browser path (right-click → Copy Reference, strip the wrapper) and paste it into `build_scene.py`:

```python
SHIP_MESH_PATH = "/Game/Ships/SpanishGalleon/SM_Galleon"
```

### 3. Configure the script (optional)
Edit the CONFIG block at the top of `build_scene.py`:
- `SHIP_MESH_PATH` — your ship asset path
- `RENDER_OUTPUT_DIR` — where rendered frames land
- `RENDER_RESOLUTION` — defaults to 4K-wide 2.39:1
- `SUN_ELEVATION_DEG`, `SUN_AZIMUTH_DEG` — re-aim the sun if you want different lighting

## Running it

1. Open or create a new empty level (`File → New Level → Empty Level`).
2. `Tools → Execute Python Script…` → pick `/Users/fentonhaslam/Projects/brig/build_scene.py`.
3. Watch the Output Log for `[brig]` messages.

If you see `WARNING: Water plugin not enabled`, you missed step 1 above.

## Previewing the shot

In the viewport's perspective dropdown (top-left), pick `HeroCam_Departure`. That's the framing the script set up.

## Rendering

1. `Window → Cinematics → Movie Render Queue`
2. The job `BrigDeparture_Sevilla_GoldenHour` should already be in the queue.
3. Click **Render (Local)**. Output PNGs land in `RENDER_OUTPUT_DIR`.

For a single still, set the job's playback range to 1 frame in the queue's job config.

## Where to take it next

The script gives you the lighting/atmosphere/camera. To push toward a finished shot:
- **Sails** — most ship meshes ship with sails as a separate mesh; rotate them to catch wind from sun-back
- **Crowd** — Quixel/MetaHumans on the foreground dock; even silhouetted, ~20 figures sell "100 men aboard + dockside crowd"
- **Sevilla skyline** — already built. To tune: `BUILD_SEVILLA_SKYLINE = False` disables it; `SKYLINE_DISTANCE` (cm) pushes the city nearer/farther; `SKYLINE_BEARING_DEG` rotates it around the ship. Individual landmarks are spawned with stable labels (`Sevilla_Giralda_Shaft`, `Sevilla_TorreDelOro_Base`, etc.) so you can nudge any one of them in the editor without breaking idempotency
- **River, not ocean** — swap `WaterBodyOcean` for `WaterBodyRiver` if you want the Guadalquivir feel; ocean reads more epic but less geographically true

## Known gotchas

- **Mac + Movie Render Queue**: works in UE 5.3+, but path-traced renders are CPU-only on Mac (slow). Stick with the deferred renderer (what the script configures).
- **First-frame artifacts**: MRQ's first frame often shows TSR/Lumen warm-up artifacts. The script doesn't set warm-up frames; add 32 warm-up frames in the queue job's Anti-Aliasing settings if you see flicker.
- **Idempotency**: re-running the script won't double-spawn actors — it finds by label and reuses. Safe to iterate.
