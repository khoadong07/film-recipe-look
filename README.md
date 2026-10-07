# Recipe Look

A web film-recipe photo editor — a Vite/React/TypeScript port of the Recipe Look
Flutter app. Apply one of 76 film-stock-inspired "recipes" (Sony Creative
Style, Fuji simulations, Kodak, Cine, Ricoh GR, Leica, Ilford, and more) to a
photo, fine-tune it, and export a full-resolution JPEG — all client-side.

## Features

- **76 film recipes** across 12 brand groups, each a port of the original
  Sony Creative Style/Picture Effect parameter table.
- **Live WebGL2 preview** — the same color-grade pipeline (exposure, shadow
  lift, contrast, white balance, saturation, style tint, sharpness, picture
  effects) as the Flutter app, ported to GLSL.
- **Snapseed-style card picker** — every recipe shown as an actual rendered
  thumbnail of your photo, swipeable on mobile.
- **Tune panel** — SAT/CON/SHARP/A-B/G-M/EV/DRO sliders layered on top of the
  selected recipe.
- **Canon/Sony RAW import** (CR2, CR3, CRW, ARW, SR2, SRF) via an in-browser
  LibRaw (WASM) decode — demosaiced from the actual sensor data, not just the
  camera's embedded JPEG preview.
- **Recipe suggestions** for the photo you imported, and tools to match a
  reference photo's look or auto-crop around a detected subject (currently
  hidden behind a feature flag — see `SHOW_AI_TOOLS` in `src/App.tsx`).
- Responsive down to mobile widths.

## Development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build   # tsc -b && vite build, outputs to dist/
```

## Docker

```bash
docker compose up -d --build
```

Serves the built app via nginx on `http://localhost:8080`.

## Project layout

- `src/data/` — the recipe table and brand groupings.
- `src/engine/` — pure look-rendering logic and shared types (platform-agnostic).
- `src/gl/` — the WebGL2 shader and renderer.
- `src/ai/` — image-statistics heuristics and the on-device subject-detection model.
- `src/raw/` — RAW file decoding.
- `src/components/` — UI building blocks.
