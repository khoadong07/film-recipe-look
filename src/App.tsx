import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { computeImageStats, type ImageStats } from './ai/imageStats';
import { AutoCropPanel } from './components/AutoCropPanel';
import { ColorMatchPanel } from './components/ColorMatchPanel';
import { Dial } from './components/Dial';
import { GlassPanel } from './components/GlassPanel';
import { IconRail } from './components/IconRail';
import { RecipeFilmstrip } from './components/RecipeFilmstrip';
import { RecipeSuggestions } from './components/RecipeSuggestions';
import { SliderRow } from './components/SliderRow';
import { TopToolbar } from './components/TopToolbar';
import { GROUPS } from './data/groups';
import { SONY_RECIPES } from './data/sonyRecipes';
import { ADJ_RANGE, IDENTITY_ADJUSTMENTS, isIdentityAdjustments, type RecipeAdjustments } from './engine/types';
import { buildShaderParams } from './engine/lookEngine';
import { LookRenderer } from './gl/lookRenderer';
import { renderRecipeThumbnails, squareThumbnailSource } from './gl/thumbnailRenderer';
import { useMediaQuery } from './hooks/useMediaQuery';
import { decodeRawToImageBitmap, isRawFile, RAW_ACCEPT } from './raw/decodeRaw';

type RailId = 'filters' | 'tune' | 'ai';

// "Match a Photo" / "Auto Crop" are built and working but hidden from the UI
// for now — flip this back to true to bring the "AI Tools" tab back.
const SHOW_AI_TOOLS = false;
type SourceImage = HTMLImageElement | ImageBitmap;

function imageDimensions(image: SourceImage): { width: number; height: number } {
  if (image instanceof HTMLImageElement) {
    return { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
  }
  return { width: image.width, height: image.height };
}

const RAIL_ITEMS = [
  {
    id: 'filters' as RailId,
    label: 'Filters',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'tune' as RailId,
    label: 'Tune',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="4" y1="6" x2="20" y2="6" />
        <circle cx="9" cy="6" r="2.2" fill="currentColor" stroke="none" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <circle cx="16" cy="12" r="2.2" fill="currentColor" stroke="none" />
        <line x1="4" y1="18" x2="20" y2="18" />
        <circle cx="11" cy="18" r="2.2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'ai' as RailId,
    label: 'AI Tools',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    ),
  },
];

function droLabel(v: number): string {
  if (v === 0) return 'Off';
  if (v === 6) return 'Auto';
  return `Lv${v}`;
}

function evFormat(v: number): string {
  return (v / 3).toFixed(1);
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<LookRenderer | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [image, setImage] = useState<SourceImage | null>(null);
  const [zoom, setZoom] = useState(100);
  const [importing, setImporting] = useState(false);
  const [rail, setRail] = useState<RailId>('filters');
  const [recipeIndex, setRecipeIndex] = useState(0);
  const [adjustments, setAdjustments] = useState<RecipeAdjustments>(IDENTITY_ADJUSTMENTS);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFace, setHasFace] = useState(false);
  const [thumbnails, setThumbnails] = useState<string[] | null>(null);

  const recipe = SONY_RECIPES[recipeIndex];
  const params = useMemo(() => buildShaderParams(recipe, adjustments), [recipe, adjustments]);
  const imageAspect = image ? (({ width, height }) => width / height)(imageDimensions(image)) : 1;
  const imageStats = useMemo<ImageStats | null>(() => (image ? computeImageStats(image) : null), [image]);

  const groupedRecipes = useMemo(() => {
    const byGroup = new Map<string, { recipe: typeof SONY_RECIPES[number]; index: number }[]>();
    SONY_RECIPES.forEach((r, index) => {
      const list = byGroup.get(r.group) ?? [];
      list.push({ recipe: r, index });
      byGroup.set(r.group, list);
    });
    return GROUPS.map((group) => ({ group, items: byGroup.get(group) ?? [] })).filter((g) => g.items.length > 0);
  }, []);

  // Create the GL renderer once the canvas exists; tear down on unmount.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      rendererRef.current = new LookRenderer(canvas);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'WebGL2 is not supported in this browser.');
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Re-draw whenever the image, look params, or zoom level change. Zoom is
  // a CSS transform: scale() on top of this canvas (see the Zoom slider
  // below), so past 100% the drawing buffer itself needs to grow to match
  // (supersampling) or the zoomed-in view just looks like a blown-up,
  // blurry version of the same display-res render.
  const zoomSupersample = Math.max(1, zoom / 100);
  useEffect(() => {
    if (!image || !rendererRef.current) return;
    rendererRef.current.render(image, params, zoomSupersample);
  }, [image, params, zoomSupersample]);

  // Re-draw on container resize too (canvas CSS size drives drawing-buffer size).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const observer = new ResizeObserver(() => {
      rendererRef.current?.render(image, params, zoomSupersample);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [image, params, zoomSupersample]);

  // Generate the Snapseed-style card strip's thumbnails (one per recipe, at
  // its own base params — no live `adjustments` baked in, same as the
  // existing filters list) whenever a new photo comes in. Cheap: 76 tiny
  // offscreen WebGL draws against a pre-downscaled square source.
  useEffect(() => {
    if (!image) {
      setThumbnails(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const square = await squareThumbnailSource(image);
        if (cancelled) return;
        const urls = renderRecipeThumbnails(square);
        if (!cancelled) setThumbnails(urls);
      } catch {
        if (!cancelled) setThumbnails(null); // falls back to text-only cards
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [image]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);

    if (isRawFile(file)) {
      setImporting(true);
      try {
        const bitmap = await decodeRawToImageBitmap(file);
        setImage(bitmap);
        setZoom(100);
        setHasFace(false);
      } catch (e) {
        setError(e instanceof Error ? `Could not decode this RAW file: ${e.message}` : 'Could not decode this RAW file.');
      } finally {
        setImporting(false);
      }
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setZoom(100);
      setHasFace(false);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setError('Could not load that image.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `image/*,${RAW_ACCEPT}`;
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void handleFile(file);
    };
    input.click();
  }, [handleFile]);

  const handleDownload = useCallback(async () => {
    if (!image || !rendererRef.current) return;
    setExporting(true);
    setError(null);
    try {
      const blob = await rendererRef.current.renderFullRes(image, params);
      const url = URL.createObjectURL(blob);
      const slug = recipe.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const a = document.createElement('a');
      a.href = url;
      a.download = `recipe_look_${slug}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export this photo.');
    } finally {
      setExporting(false);
    }
  }, [image, params, recipe.name]);

  const selectRecipe = useCallback((index: number) => {
    setRecipeIndex(index);
    setAdjustments(IDENTITY_ADJUSTMENTS);
  }, []);

  const effectiveDro = adjustments.dro ?? recipe.dro;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'var(--font-body)' }}>
      <TopToolbar
        title={recipe.name}
        subtitle={isMobile ? undefined : recipe.group}
        onPrimaryAction={handleDownload}
        primaryActionLabel={exporting ? 'Exporting…' : isMobile ? 'Save' : 'Download'}
      >
        <button
          onClick={handleImport}
          disabled={importing}
          style={{
            background: 'var(--color-muted)',
            color: 'var(--color-foreground)',
            borderRadius: 999,
            padding: isMobile ? '8px 12px' : '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            opacity: importing ? 0.6 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {importing ? 'Decoding…' : isMobile ? 'Import' : 'Import Photo'}
        </button>
      </TopToolbar>

      {/* On mobile this wrapper itself never scrolls — only `aside` below
          does, with its own bounded height — so the canvas/zoom/filmstrip in
          `main` stay pinned on screen while tuning sliders or browsing
          recipes, instead of scrolling the preview out of view. */}
      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: 0, overflow: 'hidden' }}>
        <IconRail
          items={SHOW_AI_TOOLS ? RAIL_ITEMS : RAIL_ITEMS.filter((item) => item.id !== 'ai')}
          activeId={rail}
          onSelect={(id) => setRail(id as RailId)}
          direction={isMobile ? 'horizontal' : 'vertical'}
        />

        <main
          style={{
            flex: isMobile ? 'none' : 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            padding: isMobile ? 16 : 24,
            minWidth: 0,
          }}
        >
          <div
            style={{
              flex: isMobile ? 'none' : 1,
              height: isMobile ? '45vh' : undefined,
              width: '100%',
              maxWidth: 900,
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-muted)',
              overflow: 'auto',
              position: 'relative',
              minHeight: 0,
            }}
          >
            {!image && importing && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--color-muted-foreground)', fontSize: 14 }}>
                Decoding RAW file…
              </div>
            )}
            {!image && !importing && (
              <button
                onClick={handleImport}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  color: 'var(--color-muted-foreground)',
                  fontSize: 14,
                }}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 16V4M12 4l-5 5M12 4l5 5" />
                  <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
                </svg>
                <span>Click to import a photo</span>
                <span style={{ fontSize: 11, color: 'var(--color-border)' }}>JPEG/PNG, or Canon/Sony RAW (CR2, CR3, ARW…)</span>
              </button>
            )}
            {/* Always mounted (even before an image is picked) so the
                canvas ref is available for the WebGL renderer the moment
                it's created — conditionally mounting this on `image` meant
                the renderer never had a canvas to attach to. */}
            <div
              style={{
                width: '100%',
                height: '100%',
                display: image ? 'flex' : 'none',
                alignItems: 'center',
                justifyContent: 'center',
                // Zoom is a pure visual scale of the already-rendered
                // canvas — it doesn't touch the WebGL drawing buffer, so
                // dragging it costs nothing (no re-render, no texture
                // re-upload), and the overflow:auto frame above lets the
                // user pan around when zoomed past 100%.
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'center center',
              }}
            >
              <canvas
                ref={canvasRef}
                style={{
                  // Letterbox to the source image's own aspect ratio instead
                  // of stretching to fill the (square-ish) frame — a tall
                  // portrait photo was getting squashed wide before this.
                  aspectRatio: imageAspect,
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: 'auto',
                  height: 'auto',
                  display: 'block',
                }}
              />
            </div>
          </div>

          {image && (
            <div style={{ maxWidth: 900, width: '100%', margin: '0 auto' }}>
              <SliderRow label="Zoom" min={50} max={200} step={5} value={zoom} formatValue={(v) => `${v}%`} onChange={setZoom} />
            </div>
          )}

          {/* Mobile only: a swipeable strip right under the preview, so
              picking a look doesn't mean scrolling the canvas out of view
              the way the long vertical grouped list below would. */}
          {image && isMobile && (
            <RecipeFilmstrip groups={groupedRecipes} selectedIndex={recipeIndex} onSelect={selectRecipe} thumbnails={thumbnails} />
          )}
        </main>

        <aside
          style={
            isMobile
              ? { width: '100%', padding: 16, flex: 1, minHeight: 0, overflowY: 'auto' }
              : { width: 320, padding: 16, overflowY: 'auto', flexShrink: 0 }
          }
        >
          {error && (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: '#fee2e2',
                color: 'var(--color-destructive)',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {rail === 'filters' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <RecipeSuggestions stats={imageStats} hasFace={hasFace} onSelect={selectRecipe} selectedIndex={recipeIndex} />
              <GlassPanel title="Film Recipes">
              <div
                style={
                  isMobile
                    ? { display: 'flex', flexDirection: 'column', gap: 16 }
                    : { display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }
                }
              >
                {groupedRecipes.map(({ group, items }) => (
                  <div key={group}>
                    <h4
                      style={{
                        margin: '0 0 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--color-accent)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {group}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {items.map(({ recipe: r, index }) => {
                        const active = index === recipeIndex;
                        const thumb = thumbnails?.[index];
                        return (
                          <button
                            key={r.name}
                            onClick={() => selectRecipe(index)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              textAlign: 'left',
                              padding: '6px 10px',
                              borderRadius: 'var(--radius-sm)',
                              background: active ? 'var(--color-accent-soft)' : 'transparent',
                              color: active ? 'var(--color-accent)' : 'var(--color-foreground)',
                              fontSize: 13,
                              fontWeight: active ? 700 : 500,
                              transition: 'background var(--transition-fast)',
                            }}
                          >
                            <span
                              style={{
                                width: 32,
                                height: 32,
                                flexShrink: 0,
                                borderRadius: 'var(--radius-sm)',
                                overflow: 'hidden',
                                background: 'var(--color-muted)',
                              }}
                            >
                              {thumb && (
                                <img
                                  src={thumb}
                                  alt=""
                                  width={32}
                                  height={32}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                />
                              )}
                            </span>
                            {r.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              </GlassPanel>
            </div>
          )}

          {rail === 'tune' && (
            <GlassPanel title="Tune">
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                <Dial
                  label="Exposure"
                  min={ADJ_RANGE.ev[0]}
                  max={ADJ_RANGE.ev[1]}
                  value={recipe.ev + adjustments.ev}
                  formatValue={(v) => `${evFormat(v).startsWith('-') ? '' : '+'}${evFormat(v)}`}
                  onChange={(v) => setAdjustments((a) => ({ ...a, ev: Math.round(v) - recipe.ev }))}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <SliderRow
                  label="Sat"
                  min={ADJ_RANGE.sat[0]}
                  max={ADJ_RANGE.sat[1]}
                  value={recipe.sat + adjustments.sat}
                  onChange={(v) => setAdjustments((a) => ({ ...a, sat: v - recipe.sat }))}
                />
                <SliderRow
                  label="Con"
                  min={ADJ_RANGE.con[0]}
                  max={ADJ_RANGE.con[1]}
                  value={recipe.con + adjustments.con}
                  onChange={(v) => setAdjustments((a) => ({ ...a, con: v - recipe.con }))}
                />
                <SliderRow
                  label="Sharp"
                  min={ADJ_RANGE.sharp[0]}
                  max={ADJ_RANGE.sharp[1]}
                  value={recipe.sharp + adjustments.sharp}
                  onChange={(v) => setAdjustments((a) => ({ ...a, sharp: v - recipe.sharp }))}
                />
                <SliderRow
                  label="A-B"
                  min={ADJ_RANGE.ab[0]}
                  max={ADJ_RANGE.ab[1]}
                  value={recipe.ab + adjustments.ab}
                  onChange={(v) => setAdjustments((a) => ({ ...a, ab: v - recipe.ab }))}
                />
                <SliderRow
                  label="G-M"
                  min={ADJ_RANGE.gm[0]}
                  max={ADJ_RANGE.gm[1]}
                  value={recipe.gm + adjustments.gm}
                  onChange={(v) => setAdjustments((a) => ({ ...a, gm: v - recipe.gm }))}
                />
                <SliderRow
                  label="DRO"
                  min={ADJ_RANGE.dro[0]}
                  max={ADJ_RANGE.dro[1]}
                  value={effectiveDro}
                  formatValue={droLabel}
                  onChange={(v) => setAdjustments((a) => ({ ...a, dro: v }))}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button
                  onClick={() => setAdjustments(IDENTITY_ADJUSTMENTS)}
                  disabled={isIdentityAdjustments(adjustments)}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isIdentityAdjustments(adjustments) ? 'var(--color-muted-foreground)' : 'var(--color-accent)',
                    opacity: isIdentityAdjustments(adjustments) ? 0.5 : 1,
                  }}
                >
                  Reset
                </button>
              </div>
            </GlassPanel>
          )}

          {rail === 'ai' && SHOW_AI_TOOLS && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ColorMatchPanel targetImage={image} currentAdjustments={adjustments} onApply={setAdjustments} />
              <AutoCropPanel
                image={image}
                onDetected={(subject) => setHasFace(subject?.kind === 'face')}
                onApplyCrop={(cropped) => {
                  setImage(cropped);
                  setZoom(100);
                }}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
