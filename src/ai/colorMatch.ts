// Deterministic, heuristic "match a reference photo" logic — plain signal
// processing on top of imageStats.ts's pixel aggregates, NOT a neural
// network or any trained model. It compares a target photo's ImageStats
// against a reference photo's and derives RecipeAdjustments deltas that
// would nudge the target's look toward the reference's.
import { ADJ_RANGE, clampToRange, IDENTITY_ADJUSTMENTS, type RecipeAdjustments } from '../engine/types';
import type { ImageStats } from './imageStats';

/**
 * Suggests adjustment values (layered on top of `base`) that would push
 * `target`'s rendered look toward `reference`'s, based purely on aggregate
 * color statistics (brightness, saturation, contrast, warmth, tint).
 *
 * Known limitations, left untouched here on purpose:
 *  - `sharp` isn't inferred — perceived sharpness isn't something these
 *    aggregate stats (means/variance of downsampled pixels) can tell you
 *    anything reliable about, so it's passed through from `base` unchanged.
 *  - `dro` (shadow lift) isn't inferred either — shadowClip/highlightClip
 *    alone can't distinguish "this photo has genuinely crushed blacks as a
 *    style choice" from "this photo just has more shadow area in frame",
 *    so guessing a shadow-lift delta from them would be unreliable. Passed
 *    through from `base` unchanged.
 */
export function suggestAdjustmentsFromReference(
  target: ImageStats,
  reference: ImageStats,
  base: RecipeAdjustments = IDENTITY_ADJUSTMENTS,
): RecipeAdjustments {
  const evDelta = (reference.avgLuma - target.avgLuma) * 40;
  const satDelta = (reference.saturationEstimate - target.saturationEstimate) * 9;
  const conDelta = (reference.contrastEstimate - target.contrastEstimate) * 14;
  const abDelta = (reference.warmth - target.warmth) * 5.5;
  const gmDelta = (reference.tintBalance - target.tintBalance) * 5.5;

  return {
    ev: clampToRange(Math.round(base.ev + evDelta), ADJ_RANGE.ev),
    sat: clampToRange(Math.round(base.sat + satDelta), ADJ_RANGE.sat),
    con: clampToRange(Math.round(base.con + conDelta), ADJ_RANGE.con),
    ab: clampToRange(Math.round(base.ab + abDelta), ADJ_RANGE.ab),
    gm: clampToRange(Math.round(base.gm + gmDelta), ADJ_RANGE.gm),
    sharp: base.sharp,
    dro: base.dro,
  };
}

/** Minimum perceptible-difference thresholds, in each stat's own units. */
const DESCRIBE_THRESHOLDS = {
  luma: 0.035, // ~a third of a stop
  saturation: 0.035,
  contrast: 0.02,
  warmth: 0.06,
  tint: 0.06,
};

/**
 * Short, human-readable bullets describing what matching `reference` would
 * change about `target` — only includes a bullet when the stats differ by
 * more than a small perceptible-difference threshold, so an already-similar
 * reference photo yields an empty (or near-empty) list instead of noise.
 */
export function describeMatch(target: ImageStats, reference: ImageStats): string[] {
  const bullets: string[] = [];

  const lumaDiff = reference.avgLuma - target.avgLuma;
  if (Math.abs(lumaDiff) > DESCRIBE_THRESHOLDS.luma) {
    const stops = Math.abs(lumaDiff) * 40 / 3; // evDelta is in 1/3-stop units
    bullets.push(`${lumaDiff > 0 ? 'Brighter' : 'Darker'} by ~${stops.toFixed(1)} stop${stops >= 1.05 ? 's' : ''}`);
  }

  const satDiff = reference.saturationEstimate - target.saturationEstimate;
  if (Math.abs(satDiff) > DESCRIBE_THRESHOLDS.saturation) {
    bullets.push(satDiff > 0 ? 'More saturated' : 'Less saturated');
  }

  const conDiff = reference.contrastEstimate - target.contrastEstimate;
  if (Math.abs(conDiff) > DESCRIBE_THRESHOLDS.contrast) {
    bullets.push(conDiff > 0 ? 'Higher contrast' : 'Flatter, lower contrast');
  }

  const warmthDiff = reference.warmth - target.warmth;
  if (Math.abs(warmthDiff) > DESCRIBE_THRESHOLDS.warmth) {
    bullets.push(warmthDiff > 0 ? 'Warmer white balance' : 'Cooler white balance');
  }

  const tintDiff = reference.tintBalance - target.tintBalance;
  if (Math.abs(tintDiff) > DESCRIBE_THRESHOLDS.tint) {
    bullets.push(tintDiff > 0 ? 'Shifted toward green' : 'Shifted toward magenta');
  }

  return bullets.slice(0, 4);
}
