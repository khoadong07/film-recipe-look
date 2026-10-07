// Lightweight, fully client-side image statistics — pure canvas-2D pixel
// math, no ML model. Downsamples to `sampleSize`×`sampleSize` first so the
// cost is constant regardless of the source photo's real resolution.
//
// Used as the shared signal for colorMatch.ts (match a reference photo's
// look) and recipeRecommender.ts (suggest recipes for a scene) — both of
// those are explicitly *heuristic*, not neural-network "AI"; subjectDetector.ts
// is the one module in src/ai/ that's actually a trained on-device model.

export interface ImageStats {
  /** 0..1, mean luma (Rec.709 weights). */
  avgLuma: number;
  avgR: number;
  avgG: number;
  avgB: number;
  /** Roughly -1 (cool/blue) .. +1 (warm/amber), derived from the R-B balance. */
  warmth: number;
  /** Roughly -1 (magenta) .. +1 (green), derived from the G vs R+B balance. */
  tintBalance: number;
  /** 0..~1.5+, mean per-pixel chroma distance from its own luma (higher = more saturated). */
  saturationEstimate: number;
  /** 0..~0.5, stddev of luma across sampled pixels (higher = more contrasty). */
  contrastEstimate: number;
  /** 0..1, fraction of sampled pixels at/near-black. */
  shadowClip: number;
  /** 0..1, fraction of sampled pixels at/near-white. */
  highlightClip: number;
}

type SourceImage = HTMLImageElement | ImageBitmap;

function sourceDimensions(image: SourceImage): { width: number; height: number } {
  if (image instanceof HTMLImageElement) {
    return { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
  }
  return { width: image.width, height: image.height };
}

export function computeImageStats(image: SourceImage, sampleSize = 128): ImageStats {
  const { width, height } = sourceDimensions(image);
  const aspect = width / height || 1;
  const sw = aspect >= 1 ? sampleSize : Math.max(1, Math.round(sampleSize * aspect));
  const sh = aspect >= 1 ? Math.max(1, Math.round(sampleSize / aspect)) : sampleSize;

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas context is not available.');
  ctx.drawImage(image, 0, 0, sw, sh);
  const { data } = ctx.getImageData(0, 0, sw, sh);

  const n = sw * sh;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumLuma = 0;
  let sumChroma = 0;
  let shadowCount = 0;
  let highlightCount = 0;
  const lumas = new Float32Array(n);

  for (let i = 0, px = 0; i < data.length; i += 4, px++) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lumas[px] = luma;
    sumR += r;
    sumG += g;
    sumB += b;
    sumLuma += luma;
    sumChroma += Math.abs(r - luma) + Math.abs(g - luma) + Math.abs(b - luma);
    if (luma < 0.04) shadowCount++;
    if (luma > 0.96) highlightCount++;
  }

  const avgR = sumR / n;
  const avgG = sumG / n;
  const avgB = sumB / n;
  const avgLuma = sumLuma / n;

  let varianceSum = 0;
  for (let px = 0; px < n; px++) {
    const d = lumas[px] - avgLuma;
    varianceSum += d * d;
  }
  const contrastEstimate = Math.sqrt(varianceSum / n);

  return {
    avgLuma,
    avgR,
    avgG,
    avgB,
    warmth: Math.max(-1, Math.min(1, (avgR - avgB) * 3)),
    tintBalance: Math.max(-1, Math.min(1, (avgG - (avgR + avgB) / 2) * 3)),
    saturationEstimate: sumChroma / n,
    contrastEstimate,
    shadowClip: shadowCount / n,
    highlightClip: highlightCount / n,
  };
}
