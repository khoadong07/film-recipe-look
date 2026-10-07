// Renders a small square preview of every recipe applied to the current
// photo, for the Snapseed-style "card" filter strip — reuses the same
// LookRenderer/shader as the main preview, just pointed at a tiny offscreen
// canvas, so a thumbnail is pixel-for-pixel what you'd actually get.
import { SONY_RECIPES } from '../data/sonyRecipes';
import { buildShaderParams } from '../engine/lookEngine';
import { LookRenderer } from './lookRenderer';

type SourceImage = HTMLImageElement | ImageBitmap;

function dimensions(image: SourceImage): { width: number; height: number } {
  if (image instanceof HTMLImageElement) {
    return { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
  }
  return { width: image.width, height: image.height };
}

/** Center-square-crops `image` down to a small bitmap, cheap to re-render 76 times over. */
export async function squareThumbnailSource(image: SourceImage, size = 160): Promise<ImageBitmap> {
  const { width, height } = dimensions(image);
  const s = Math.min(width, height);
  const sx = (width - s) / 2;
  const sy = (height - s) / 2;
  return createImageBitmap(image, sx, sy, s, s, { resizeWidth: size, resizeHeight: size, resizeQuality: 'medium' });
}

/** One JPEG data-URL per entry in SONY_RECIPES (same order/index), each
 * `size`×`size`. `source` should already be square (see squareThumbnailSource)
 * so every card crops the same way. */
export function renderRecipeThumbnails(source: SourceImage, size = 96): string[] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const renderer = new LookRenderer(canvas);
  try {
    return SONY_RECIPES.map((recipe) => {
      renderer.render(source, buildShaderParams(recipe));
      return canvas.toDataURL('image/jpeg', 0.72);
    });
  } finally {
    renderer.dispose();
  }
}
