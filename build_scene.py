"""
build_scene.py — Golden-hour departure from Sevilla, c. 1500s.

Run inside Unreal Engine 5.3+:
    Tools -> Execute Python Script... -> select this file
Or via the Output Log's Python tab:
    py "/Users/fentonhaslam/Projects/brig/build_scene.py"

What this script builds programmatically:
  - Sun (DirectionalLight) at golden-hour angle, warm color
  - SkyAtmosphere, SkyLight, VolumetricCloud, ExponentialHeightFog
  - WaterBodyOcean (requires Water plugin enabled)
  - PostProcessVolume with cinematic / anamorphic-style settings
  - CineCameraActor framing a heroic low-angle hero shot
  - Ship actor (you supply the mesh path in SHIP_MESH_PATH below)

Plugins required (enable via Edit -> Plugins, then restart):
  - Water
  - Movie Render Queue
  - Python Editor Script Plugin (usually on by default)

The only thing you must supply: a ship static mesh. See SETUP.md.
"""

import unreal
import math

# ---------------------------------------------------------------------------
# CONFIG — edit these
# ---------------------------------------------------------------------------

# Path to your imported ship StaticMesh asset. Example:
#   "/Game/Ships/SpanishGalleon/SM_Galleon"
# Leave as None to spawn a placeholder cube where the ship should go.
SHIP_MESH_PATH = None

# Render output
RENDER_OUTPUT_DIR = "/Users/fentonhaslam/Projects/brig/renders"
RENDER_RESOLUTION = (3840, 1600)  # 2.39:1 anamorphic-ish at 4K width

# Golden-hour sun angle (degrees). ~8° elevation = warm low sun.
SUN_ELEVATION_DEG = 9.0
SUN_AZIMUTH_DEG = 235.0   # behind-left of camera, so ship is rim-lit

# Sevilla skyline silhouette — placed on the camera-forward horizon beyond the ship.
BUILD_SEVILLA_SKYLINE = True
SKYLINE_DISTANCE = 22000.0   # cm from origin along camera-forward direction
SKYLINE_BEARING_DEG = 35.0   # matches the hero camera's forward yaw

# ---------------------------------------------------------------------------
# Setup helpers
# ---------------------------------------------------------------------------

EAS = unreal.EditorActorSubsystem()
ELL = unreal.EditorLevelLibrary  # legacy fallback for some ops

def log(msg):
    unreal.log(f"[brig] {msg}")

def spawn(actor_class, location=(0, 0, 0), rotation=(0, 0, 0), label=None):
    loc = unreal.Vector(*location)
    rot = unreal.Rotator(*rotation)
    actor = EAS.spawn_actor_from_class(actor_class, loc, rot)
    if actor and label:
        actor.set_actor_label(label)
    return actor

def find_or_spawn(actor_class, label, location=(0, 0, 0), rotation=(0, 0, 0)):
    """Idempotent: returns existing actor with that label, or spawns a new one."""
    for a in EAS.get_all_level_actors():
        if a.get_actor_label() == label:
            return a
    return spawn(actor_class, location, rotation, label)

# ---------------------------------------------------------------------------
# 1. Sun — DirectionalLight at golden-hour angle
# ---------------------------------------------------------------------------

def build_sun():
    sun_pitch = -SUN_ELEVATION_DEG
    sun_yaw = SUN_AZIMUTH_DEG
    sun = find_or_spawn(unreal.DirectionalLight, "Sun_GoldenHour",
                        location=(0, 0, 50000),
                        rotation=(0, sun_pitch, sun_yaw))
    comp = sun.light_component
    comp.set_intensity(8.0)  # lux units in UE5 physical lighting
    comp.set_light_color(unreal.LinearColor(1.0, 0.62, 0.32, 1.0))
    comp.set_editor_property("use_temperature", True)
    comp.set_editor_property("temperature", 3200.0)
    comp.set_editor_property("atmosphere_sun_light", True)
    comp.set_editor_property("forward_shading_priority", 1)
    log("Sun configured for golden hour.")
    return sun

# ---------------------------------------------------------------------------
# 2. Sky — Atmosphere + SkyLight + Clouds + Fog
# ---------------------------------------------------------------------------

def build_sky():
    sky_atmo = find_or_spawn(unreal.SkyAtmosphere, "SkyAtmosphere")

    sky_light = find_or_spawn(unreal.SkyLight, "SkyLight",
                              location=(0, 0, 15000))
    sky_light.light_component.set_editor_property("real_time_capture", True)
    sky_light.light_component.set_editor_property("intensity_scale", 1.0)

    clouds = find_or_spawn(unreal.VolumetricCloud, "VolumetricClouds")

    fog = find_or_spawn(unreal.ExponentialHeightFog, "ExpHeightFog",
                        location=(0, 0, 200))
    fog_comp = fog.get_component_by_class(unreal.ExponentialHeightFogComponent)
    fog_comp.set_editor_property("fog_density", 0.025)
    fog_comp.set_editor_property("fog_height_falloff", 0.15)
    fog_comp.set_editor_property("start_distance", 5000.0)
    fog_comp.set_editor_property("fog_inscattering_luminance",
                                 unreal.LinearColor(0.55, 0.38, 0.22, 1.0))
    fog_comp.set_editor_property("volumetric_fog", True)
    fog_comp.set_editor_property("volumetric_fog_distance", 80000.0)

    log("Sky, clouds, and fog configured.")
    return sky_atmo, sky_light, clouds, fog

# ---------------------------------------------------------------------------
# 3. Ocean — Water plugin
# ---------------------------------------------------------------------------

def build_ocean():
    try:
        ocean_class = unreal.load_class(None, "/Script/Water.WaterBodyOcean")
    except Exception:
        ocean_class = None
    if ocean_class is None:
        log("WARNING: Water plugin not enabled. Skipping ocean — enable via "
            "Edit -> Plugins -> Water, restart, and re-run.")
        return None
    ocean = find_or_spawn(ocean_class, "Ocean_Atlantic",
                          location=(0, 0, 0))
    log("Ocean spawned.")
    return ocean

# ---------------------------------------------------------------------------
# 4. Post-process — cinematic / anamorphic Master & Commander feel
# ---------------------------------------------------------------------------

def build_post_process():
    ppv = find_or_spawn(unreal.PostProcessVolume, "PostProcess_Cinematic")
    ppv.set_editor_property("unbound", True)
    settings = ppv.settings

    # Exposure — manual for cinematic control
    settings.set_editor_property("override_auto_exposure_method", True)
    settings.set_editor_property("auto_exposure_method",
                                 unreal.AutoExposureMethod.AEM_MANUAL)
    settings.set_editor_property("override_auto_exposure_bias", True)
    settings.set_editor_property("auto_exposure_bias", 11.5)

    # Bloom — warm, lifted
    settings.set_editor_property("override_bloom_intensity", True)
    settings.set_editor_property("bloom_intensity", 0.9)

    # Lens / anamorphic
    settings.set_editor_property("override_lens_flares_intensity", True)
    settings.set_editor_property("lens_flares_intensity", 0.6)
    settings.set_editor_property("override_lens_flares_tint", True)
    settings.set_editor_property("lens_flares_tint",
                                 unreal.LinearColor(1.0, 0.85, 0.6, 1.0))

    # Color grading — warm shadows, cool-warm split-tone
    settings.set_editor_property("override_color_saturation", True)
    settings.set_editor_property("color_saturation",
                                 unreal.Vector4(1.05, 1.05, 1.0, 1.0))
    settings.set_editor_property("override_color_contrast", True)
    settings.set_editor_property("color_contrast",
                                 unreal.Vector4(1.05, 1.05, 1.05, 1.0))
    settings.set_editor_property("override_color_gamma_shadows", True)
    settings.set_editor_property("color_gamma_shadows",
                                 unreal.Vector4(1.0, 0.95, 0.85, 1.0))
    settings.set_editor_property("override_color_gain_highlights", True)
    settings.set_editor_property("color_gain_highlights",
                                 unreal.Vector4(1.0, 0.92, 0.78, 1.0))

    # Vignette
    settings.set_editor_property("override_vignette_intensity", True)
    settings.set_editor_property("vignette_intensity", 0.5)

    # Film grain — light, gives 35mm feel
    settings.set_editor_property("override_film_grain_intensity", True)
    settings.set_editor_property("film_grain_intensity", 0.25)

    # Motion blur — cinematic
    settings.set_editor_property("override_motion_blur_amount", True)
    settings.set_editor_property("motion_blur_amount", 0.5)

    log("Cinematic post-process configured.")
    return ppv

# ---------------------------------------------------------------------------
# 5. Camera — heroic low-angle, 35mm anamorphic
# ---------------------------------------------------------------------------

def build_camera():
    cam = find_or_spawn(unreal.CineCameraActor, "HeroCam_Departure",
                        location=(-2500, -1800, 250),
                        rotation=(0, -2.0, 35.0))
    cam_comp = cam.get_cine_camera_component()

    # 35mm anamorphic-style frame
    filmback = cam_comp.get_editor_property("filmback")
    filmback.set_editor_property("sensor_width", 24.89)
    filmback.set_editor_property("sensor_height", 18.66)
    cam_comp.set_editor_property("filmback", filmback)

    # Lens: 35mm prime
    cam_comp.set_editor_property("current_focal_length", 35.0)
    cam_comp.set_editor_property("current_aperture", 4.0)

    # Focus on the ship origin
    focus = cam_comp.get_editor_property("focus_settings")
    focus.set_editor_property("focus_method",
                              unreal.CameraFocusMethod.MANUAL)
    focus.set_editor_property("manual_focus_distance", 3200.0)
    cam_comp.set_editor_property("focus_settings", focus)

    log("Hero camera configured (35mm, low angle).")
    return cam

# ---------------------------------------------------------------------------
# 5b. Sevilla skyline silhouette
# ---------------------------------------------------------------------------

SILHOUETTE_MAT_PATH = "/Game/Generated/M_CitySilhouette"

def get_or_create_silhouette_material():
    """Create (once) a pure-black unlit material so distant geometry reads as
    a true silhouette regardless of sun direction."""
    existing = unreal.EditorAssetLibrary.load_asset(SILHOUETTE_MAT_PATH)
    if existing:
        return existing
    try:
        tools = unreal.AssetToolsHelpers.get_asset_tools()
        factory = unreal.MaterialFactoryNew()
        mat = tools.create_asset("M_CitySilhouette", "/Game/Generated",
                                 unreal.Material, factory)
        mat.set_editor_property(
            "shading_model", unreal.MaterialShadingModel.MSM_UNLIT)
        color_node = unreal.MaterialEditingLibrary.create_material_expression(
            mat, unreal.MaterialExpressionConstant3Vector, -300, 0)
        color_node.constant = unreal.LinearColor(0.004, 0.003, 0.002, 1.0)
        unreal.MaterialEditingLibrary.connect_material_property(
            color_node, "", unreal.MaterialProperty.MP_EMISSIVE_COLOR)
        unreal.MaterialEditingLibrary.recompile_material(mat)
        unreal.EditorAssetLibrary.save_loaded_asset(mat)
        log("Created silhouette material at " + SILHOUETTE_MAT_PATH)
        return mat
    except Exception as e:
        log(f"WARNING: couldn't create silhouette material ({e}). "
            "Buildings will use default material.")
        return None

def _skyline_world_pos(forward_offset_cm, lateral_offset_cm, height_cm):
    """Place a building relative to the skyline center, which sits along the
    camera's forward bearing at SKYLINE_DISTANCE."""
    bearing = math.radians(SKYLINE_BEARING_DEG)
    fwd = (math.cos(bearing), math.sin(bearing))
    right = (math.cos(bearing + math.pi / 2),
             math.sin(bearing + math.pi / 2))
    base_x = SKYLINE_DISTANCE * fwd[0] + lateral_offset_cm * right[0] \
        + forward_offset_cm * fwd[0]
    base_y = SKYLINE_DISTANCE * fwd[1] + lateral_offset_cm * right[1] \
        + forward_offset_cm * fwd[1]
    return (base_x, base_y, height_cm / 2.0)

def _spawn_silhouette_box(label, lateral, forward, width, depth, height, mat):
    """Box-shaped landmark. width/depth/height in cm. lateral offset moves it
    along the skyline horizontal; forward offset pushes it nearer/farther."""
    pos = _skyline_world_pos(forward, lateral, height)
    cube = unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Cube")
    actor = find_or_spawn(unreal.StaticMeshActor, label,
                          location=pos,
                          rotation=(0, 0, SKYLINE_BEARING_DEG + 90.0))
    smc = actor.static_mesh_component
    smc.set_static_mesh(cube)
    # Engine cube is 100x100x100 cm at scale 1.0
    actor.set_actor_scale3d(unreal.Vector(depth / 100.0,
                                          width / 100.0,
                                          height / 100.0))
    if mat:
        smc.set_material(0, mat)
    return actor

def _spawn_silhouette_cylinder(label, lateral, forward, diameter, height, mat):
    pos = _skyline_world_pos(forward, lateral, height)
    cyl = unreal.EditorAssetLibrary.load_asset("/Engine/BasicShapes/Cylinder")
    actor = find_or_spawn(unreal.StaticMeshActor, label, location=pos)
    smc = actor.static_mesh_component
    smc.set_static_mesh(cyl)
    # Engine cylinder is 100x100x200 cm at scale 1.0 (200cm tall)
    actor.set_actor_scale3d(unreal.Vector(diameter / 100.0,
                                          diameter / 100.0,
                                          height / 200.0))
    if mat:
        smc.set_material(0, mat)
    return actor

def build_sevilla_silhouette():
    """Spawn a profile of Sevilla landmarks along the camera-forward horizon.
    Heights in cm (UE units). Approximate but recognizable: Torre del Oro on
    the riverbank (left), Cathedral mass + Giralda center, walls + rooftops
    spread either side."""
    if not BUILD_SEVILLA_SKYLINE:
        return
    mat = get_or_create_silhouette_material()

    # Long, low city wall + rooftop mass — spans the whole horizon
    _spawn_silhouette_box("Sevilla_CityWall_W", lateral=-8000, forward=400,
                          width=10000, depth=600, height=1400, mat=mat)
    _spawn_silhouette_box("Sevilla_CityWall_E", lateral=4500, forward=400,
                          width=9000, depth=600, height=1300, mat=mat)
    # Scattered low rooflines in front of the walls
    _spawn_silhouette_box("Sevilla_Roofs_1", lateral=-3500, forward=-600,
                          width=1800, depth=800, height=1800, mat=mat)
    _spawn_silhouette_box("Sevilla_Roofs_2", lateral=-1200, forward=-700,
                          width=1400, depth=700, height=2100, mat=mat)
    _spawn_silhouette_box("Sevilla_Roofs_3", lateral=2200, forward=-650,
                          width=1600, depth=700, height=1900, mat=mat)
    _spawn_silhouette_box("Sevilla_Roofs_4", lateral=6500, forward=-500,
                          width=1400, depth=700, height=1700, mat=mat)

    # Torre del Oro — riverside dodecagonal tower, ~36m. Cylinder approximation.
    # Place it on the river-side (left/west of skyline center).
    _spawn_silhouette_cylinder("Sevilla_TorreDelOro_Base",
                               lateral=-6500, forward=-1200,
                               diameter=1500, height=3600, mat=mat)
    _spawn_silhouette_cylinder("Sevilla_TorreDelOro_Crown",
                               lateral=-6500, forward=-1200,
                               diameter=900, height=4500, mat=mat)

    # Sevilla Cathedral — massive bulk, ~76m tall, sprawling footprint.
    _spawn_silhouette_box("Sevilla_Cathedral_Nave",
                          lateral=200, forward=-900,
                          width=4200, depth=1600, height=4800, mat=mat)
    _spawn_silhouette_box("Sevilla_Cathedral_Crossing",
                          lateral=600, forward=-900,
                          width=1200, depth=1200, height=6200, mat=mat)

    # La Giralda — bell tower, 104m. Tall thin box for the shaft, smaller box
    # for the belfry/crown.
    _spawn_silhouette_box("Sevilla_Giralda_Shaft",
                          lateral=1900, forward=-950,
                          width=1350, depth=1350, height=8200, mat=mat)
    _spawn_silhouette_box("Sevilla_Giralda_Belfry",
                          lateral=1900, forward=-950,
                          width=900, depth=900, height=10000, mat=mat)
    _spawn_silhouette_box("Sevilla_Giralda_Crown",
                          lateral=1900, forward=-950,
                          width=500, depth=500, height=10400, mat=mat)

    log("Sevilla skyline silhouette built "
        f"(distance {SKYLINE_DISTANCE/100:.0f}m, bearing {SKYLINE_BEARING_DEG}°).")

# ---------------------------------------------------------------------------
# 6. Ship
# ---------------------------------------------------------------------------

def build_ship():
    if SHIP_MESH_PATH:
        mesh = unreal.EditorAssetLibrary.load_asset(SHIP_MESH_PATH)
        if mesh is None:
            log(f"WARNING: SHIP_MESH_PATH '{SHIP_MESH_PATH}' did not load. "
                "Falling back to placeholder.")
        else:
            ship = spawn(unreal.StaticMeshActor,
                         location=(0, 0, 50),
                         rotation=(0, 0, 110),
                         label="HeroShip_Brig")
            ship.static_mesh_component.set_static_mesh(mesh)
            log(f"Ship spawned from {SHIP_MESH_PATH}.")
            return ship

    # Placeholder: a long cube approximating brig footprint (~30m x 8m x 12m)
    placeholder_mesh = unreal.EditorAssetLibrary.load_asset(
        "/Engine/BasicShapes/Cube")
    ship = spawn(unreal.StaticMeshActor,
                 location=(0, 0, 600),
                 rotation=(0, 0, 110),
                 label="HeroShip_PLACEHOLDER")
    ship.static_mesh_component.set_static_mesh(placeholder_mesh)
    ship.set_actor_scale3d(unreal.Vector(30.0, 8.0, 12.0))
    log("Ship placeholder spawned (cube). Set SHIP_MESH_PATH to replace.")
    return ship

# ---------------------------------------------------------------------------
# 7. Render — queue a Movie Render Queue job
# ---------------------------------------------------------------------------

def setup_render(camera_actor):
    """Add a job to the Movie Render Queue. You trigger the render manually
    from Window -> Cinematics -> Movie Render Queue (safer than auto-firing)."""
    try:
        subsystem = unreal.get_editor_subsystem(
            unreal.MoviePipelineQueueSubsystem)
    except Exception:
        log("Movie Render Queue plugin not available. Enable it and re-run.")
        return

    queue = subsystem.get_queue()
    job = queue.allocate_new_job(unreal.MoviePipelineExecutorJob)
    job.job_name = "BrigDeparture_Sevilla_GoldenHour"
    world = unreal.EditorLevelLibrary.get_editor_world()
    job.map = unreal.SoftObjectPath(world.get_path_name())

    config = job.get_configuration()
    config.find_or_add_setting_by_class(
        unreal.MoviePipelineDeferredPassBase)
    output = config.find_or_add_setting_by_class(
        unreal.MoviePipelineOutputSetting)
    output.output_directory = unreal.DirectoryPath(RENDER_OUTPUT_DIR)
    output.output_resolution = unreal.IntPoint(*RENDER_RESOLUTION)
    output.file_name_format = "{sequence_name}.{frame_number}"

    config.find_or_add_setting_by_class(unreal.MoviePipelineImageSequenceOutput_PNG)

    log(f"Render job queued. Open Window -> Cinematics -> Movie Render Queue, "
        f"then click Render (Local). Output: {RENDER_OUTPUT_DIR}")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    log("=== Building scene: Brig departing Sevilla, golden hour ===")
    build_sun()
    build_sky()
    build_ocean()
    build_post_process()
    cam = build_camera()
    build_ship()
    build_sevilla_silhouette()
    setup_render(cam)
    log("=== Scene build complete. Pilot the viewport into HeroCam_Departure "
        "to preview. ===")

main()
