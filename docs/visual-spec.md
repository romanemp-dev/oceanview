# Visual Spec — Oceanview (v1.0)

_English translation of the user-authored spec (the Russian original lives in git history)._
_Status: implements R-17, extends spec.md v1.0. For domain questions the source of truth is spec.md / architecture.md. Visual conflicts are discussed via decisions.md._

## 1. Concept

Oceanview is a first-person virtual desk. The desk sits flush against a window; beyond it — a seaside village view (village, sea, sky) — the visual "focal target". On the desk: stacks of notes (the macOS file-stack metaphor); in front of the user: the working zone (Today tray). Style: Makoto Shinkai — realism + dreamy; detail fidelity is not critical, atmosphere is. The key feature is the living camera: the user "turns their head".

The code-name match (Oceanview ↔ the view from the window) is a deliberate concept lock.

## 2. Presentation layer

- **Vanilla Three.js as ESM via importmap, vendored** into the repository (offline requirement). No bundler. Reconsidering Vite requires a new decisions.md entry with a real need (shader pipeline etc.).
- **Layering preserved:** the scene never reads files itself. Storage → domain → state → the scene subscribes to state.
- **DOM overlay** above the canvas for all editing: capture, editor, search, suggestion dialogs, review lists. The scene renders only short labels (counters, nameplates) via canvas textures.
- **CameraRig** — an abstraction with input sources `mouse | gyro | xr-head`. v1 — mouse only.
- **Themes without hardcoded styles** (product.md requirement): all visual parameters — palette, timings, layout density, panorama choice — live in config (`.desk/config.json`). Two presets:
    - `minimal` — a neutral calm background without window or panorama (the product.md placeholder; dev and degradation mode);
    - `oceanview` — the full scene.
- The window/panorama is designed as a **switchable environment layer** — doubling as the minimal preset and the fallback for weak machines.

## 3. Camera

|PARAMETER|VALUE|
|---|---|
|Yaw|±22° (about 45° total)|
|Pitch|two anchors: up → window fills 70–80% of the frame; down → desk 90–99%, light glints from the window|
|Input v1|normalized cursor position → target angles, no buttons held|
|Dead zone|~12% in the center|
|Smoothing|exponential lerp|
|Welcome drift|on load, over ~1.5 s the camera gently moves from the window view down to the desk (morning ritual, S2); interrupted by any input|

Gyro, drag mode, WebXR head tracking — phases 2–3.

## 4. Scene (HOME)

Layers far → near: panorama → window frame → desk → objects. Parallax grows toward the near layers.

- **Working zone** (in front of the user, bottom ~40% of the desk) = **Today tray (R-10)**: tasks due today + overdue from all stacks. Order: overdue first, then by date. Visible limit of 5 + a "+N" mini-stack at the zone edge (decision D-5/D-021, to discuss). An empty zone stays empty; the "blank sheet" is always visible.
- **Stacks**: the desk surface fits 7–9 (the "desk density" setting); the rest recede "into the depth" — smaller, more transparent, in haze, toward the edges and the window. Dreamy logic: proportions and distances are approximate. Clicking a far stack — it floats forward, the previous one recedes (~1 s).
- **Stack visual**: 5–7 sheets with offsets and micro-rotations + a counter. Ribbon/accent color — from `stack meta` in config.json.
- **Inbox** — a distinct stack: neutral color, dashed ribbon, count badge (R-11).

## 5. Mapping spec requirements to visuals

|REQ|VISUAL REALIZATION|
|---|---|
|R-01 Connect folder|Native folder picker in the DOM overlay; after connecting, the stacks "slide out" onto the desk (intro animation)|
|R-03 Desk view|The HOME state (§4)|
|R-04 Stack CRUD, moving|In the stack context; moves are animated as flights|
|R-06 Editor|DOM modal styled as a sheet of paper on the desk|
|R-07 @due tasks|Checkbox on the sheet; checking → "done stamp" animation → flight into its stack|
|R-08 Quick capture|Button + hotkey; the "blank sheet" in the working zone is always clickable. Extension (D-3/D-019): the dialog gets an optional stack picker — chosen → the file goes straight there, not → inbox/|
|R-09 Smart placement|An inbox sheet is highlighted; a ghost trajectory leads to the suggested stack; confirm → flight; dismissed → stays. v1 — heuristics, no LLM|
|R-10 Today tray|The working zone (§4)|
|R-11 Markers|Overdue — a red wax seal/edging on the stack; inbox — a badge; agent activity — a soft glow|
|R-12 Agent activity|A stamp-marker with the change count on the stack ("work: 5 agent changes"); click → the stack spreads out, the agent's "summary letter" on top, changed files highlighted; "mark reviewed" → the glow dies down, the sheets calm|
|R-13 Agent assignment|A nameplate by the stack (data from config.json), display only|
|R-14 Search (P1)|DOM overlay; result → the stack opens, the found sheet is raised|
|R-15 Slides (P1)|The same paper modal, Marp preview|
|R-17 Final theme|**Unblocked by this document**; the theme = the `oceanview` preset|

## 6. Animations

|EVENT|DURATION|EASING|
|---|---|---|
|Stack layout/assembly|0.8–1.2 s|easeOut/easeInCubic|
|Note flight into a stack|0.5–0.8 s|Bézier arc + easeInOut|
|Mass movement|~1 s|staggered|
|Depth/camera transitions|~1 s|easeInOutCubic|
|Welcome drift|1.5 s|interrupted by input|

The purpose is to show **where** things fly. Animations never block input.

## 7. Panorama

- Sector ~120–140° (a full 360° is unnecessary at ±22° yaw), wide image 3:1–4:1, local assets.
- Time of day: 4–6 keyframes of one view, a smooth blend by local time; auto/manual mode. The light on the desk is synchronized.
- Live layer: 2–3 sprites — clouds, sea glints, occasional birds.
- Style: the provided anime reference fixes the composition; the Shinkai polish — bloom, sky gradients, rim light.
- v1 asset: `assets/panorama/bay-view.jpg` (user-provided reference, cover-fitted into the window); POV composition reference: `assets/panorama/pov-reference.jpg`.

## 8. Performance

60 fps on desktop; DPR cap; bloom and the high-res panorama are a switchable environment layer (fallback = the minimal preset). Quest 3 budgets — in the WebXR phase.

## 9. Milestones

The P0 order from spec.md is unchanged. R-01, R-02 — headless, built as is. **M-rig:** the camera rig as a separate demo page, in parallel. From R-03 the scene becomes the primary UI; P0 embed into the scene right away (the minimal preset lets us verify logic without the panorama). The A0 track (panorama pipeline) starts immediately — the longest content path.

## 10. Decisions for decisions.md

- **D-1 (D-017):** Presentation layer = vanilla Three.js (ESM, importmap, vendored); no bundler.
- **D-2 (D-018):** DOM overlay for editing; the scene renders labels only.
- **D-3 (D-019):** Capture dialog with an optional stack picker (extends R-08); no selection → inbox/.
- **D-4 (D-020):** R-17 unblocked by this document; theme system with `minimal`/`oceanview` presets.
- **D-5 (D-021):** Working zone: a visible limit of 5 + a "+N" mini-stack.
- **D-6 (D-022):** Mobile webview and WebXR — phases 2–3; storage there via a storage-adapter swap (OPFS or a sync backend) per the migration path.
