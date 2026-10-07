// Suggests a handful of film recipes likely to suit a given photo's color
// statistics. This is a **deterministic rule-based heuristic** — simple
// pattern-matching against ImageStats and each SonyRecipe's own numeric
// fields/name — not a trained classifier. No model, no "AI" in the
// neural-network sense; see src/ai/imageStats.ts's own doc comment for the
// same distinction, and src/ai/subjectDetector.ts for the one module in this
// directory that actually is an on-device ML model.
import type { ImageStats } from './imageStats';
import { SONY_RECIPES } from '../data/sonyRecipes';
import type { SonyRecipe } from '../engine/types';

export interface RecipeSuggestion {
  index: number;
  recipe: SonyRecipe;
  score: number;
  reason: string;
}

interface ScoredReason {
  score: number;
  reason: string;
}

const PORTRAIT_NAME_HINTS = ['portra', 'astia', 'pro neg'];
const LOW_LIGHT_NAME_HINTS = ['1600', '3200', 'tri-x', 'delta', 'hc mono'];
const AIRY_NAME_HINTS = ['pale & light', 'soft high-key'];
const WARM_NAME_HINTS = ['gold 200', 'agfa vista'];

function nameHas(recipe: SonyRecipe, hints: string[]): boolean {
  const name = recipe.name.toLowerCase();
  return hints.some((hint) => name.includes(hint));
}

/**
 * Scores one recipe against the photo's stats, accumulating every rule that
 * applies but keeping only the single strongest-contributing rule's text as
 * the displayed reason (concatenating all matched reasons reads as noise).
 */
function scoreRecipe(recipe: SonyRecipe, stats: ImageStats, hasFace: boolean): ScoredReason {
  let total = 0;
  let bestReason = '';
  let bestContribution = -Infinity;

  const consider = (contribution: number, reason: string) => {
    if (contribution <= 0) return;
    total += contribution;
    if (contribution > bestContribution) {
      bestContribution = contribution;
      bestReason = reason;
    }
  };

  // Portrait: a detected face in the photo.
  if (hasFace) {
    const isPortraitStock = recipe.style === 'portrait' || nameHas(recipe, PORTRAIT_NAME_HINTS);
    if (isPortraitStock) {
      consider(5, 'Portrait-friendly tones for the face in your photo');
    }
  }

  // Low-key / dark scene: high-speed, pushed, or rough-mono (pe 7) mono stocks.
  if (stats.avgLuma < 0.3) {
    const isLowLightStock = (recipe.style === 'mono' && recipe.pe === 7) || nameHas(recipe, LOW_LIGHT_NAME_HINTS);
    if (isLowLightStock) {
      consider(4.5, 'Built for low light — handles shadows without crushing them');
    }
  }

  // High-key / bright scene: airy, light stocks.
  if (stats.avgLuma > 0.75) {
    const isAiryStock = recipe.style === 'light' || recipe.pe === 5 || nameHas(recipe, AIRY_NAME_HINTS);
    if (isAiryStock) {
      consider(4, 'Airy, high-key rendering for a bright scene');
    }
  }

  // Already colorful scene: either lean in (vivid) or strip it back (mono) —
  // mix both so results aren't monotonous.
  if (stats.saturationEstimate > 0.35) {
    if (recipe.style === 'vivid' && recipe.sat >= 1) {
      consider(3.5, "Leans into the color you've already got");
    }
    if (recipe.style === 'mono') {
      consider(2.5, 'A monochrome option to strip the color back');
    }
  }

  // Flat/desaturated scene (e.g. overcast): add some life.
  if (stats.saturationEstimate < 0.12) {
    if (recipe.sat >= 2 || recipe.style === 'deep') {
      consider(3.5, 'Adds punch to a flat, overcast-looking scene');
    }
  }

  // Cool cast: warm it up.
  if (stats.warmth < -0.15) {
    if (recipe.ab >= 2 || nameHas(recipe, WARM_NAME_HINTS)) {
      consider(3, 'Warms up a cool white balance');
    }
  }

  // Warm cast: balance it out.
  if (stats.warmth > 0.15) {
    if (recipe.ab <= 0 && (recipe.style === 'neutral' || recipe.style === 'clear')) {
      consider(3, 'Balances out a warm cast');
    }
  }

  // Flat/low-contrast source: build contrast back in.
  if (stats.contrastEstimate < 0.08) {
    if (recipe.con >= 2) {
      consider(2.5, 'Builds contrast back into a flat image');
    }
  }

  // Safe, well-rounded default — a modest baseline so the list is never
  // empty even when nothing above fires strongly.
  if ((recipe.style === 'std' || recipe.style === 'neutral') && Math.abs(recipe.sat) <= 1 && Math.abs(recipe.con) <= 1) {
    consider(1, 'A balanced, versatile look for this photo');
  }

  return { score: total, reason: bestReason };
}

export function recommendRecipes(stats: ImageStats, options: { hasFace?: boolean; count?: number } = {}): RecipeSuggestion[] {
  const { hasFace = false, count = 5 } = options;

  const scored: RecipeSuggestion[] = SONY_RECIPES.map((recipe, index) => {
    const { score, reason } = scoreRecipe(recipe, stats, hasFace);
    return { index, recipe, score, reason };
  }).filter((s) => s.score > 0 && s.reason);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count);
}
