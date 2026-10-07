// Ported 1:1 from recipe_look_pack's lib/engine/look_engine.dart.
import { EFFECT_LAYERS } from './effectLayers';
import { STYLE_PROFILES } from './styleProfiles';
import {
  ADJ_RANGE,
  DRO_AUTO,
  DRO_OFF,
  IDENTITY_ADJUSTMENTS,
  WB_KELVIN,
  clampToRange,
  type RecipeAdjustments,
  type ShaderParams,
  type SonyRecipe,
} from './types';

/**
 * Maps an absolute kelvin white-balance setting to the same -1(cool)..1(warm)
 * scale used by `ab`. Anchored at 5500K (daylight-balanced on this body —
 * the data's kelvin range is ~2500-6500K, so ±3000K from the anchor spans the
 * full ±1 scale).
 */
export function kelvinToWarmth(kelvin: number): number {
  if (kelvin <= 0) return 0.0;
  return Math.min(1.0, Math.max(-1.0, (5500 - kelvin) / 3000.0));
}

/** Maps DRO (0 off, 1-5 level, 6 auto) to a 0..~0.4 shadow-lift amount. */
export function droToShadowLift(dro: number): number {
  if (dro === DRO_OFF) return 0.0;
  if (dro === DRO_AUTO) return 0.12; // auto defaults to the level-3 lift
  return 0.04 * Math.min(5, Math.max(1, dro));
}

/**
 * Builds the shader-ready params for `r`, optionally overlaying `adjustments`
 * (chip-style user tuning on top of the recipe's own values). Each adjusted
 * field is clamped to the same row range recipe-lab-sony-pmca enforces on the
 * camera before it affects the look.
 */
export function buildShaderParams(
  r: SonyRecipe,
  adjustments: RecipeAdjustments = IDENTITY_ADJUSTMENTS,
): ShaderParams {
  const style = STYLE_PROFILES[r.style];
  const sat = clampToRange(r.sat + adjustments.sat, ADJ_RANGE.sat);
  const con = clampToRange(r.con + adjustments.con, ADJ_RANGE.con);
  const sharp = clampToRange(r.sharp + adjustments.sharp, ADJ_RANGE.sharp);
  const ab = clampToRange(r.ab + adjustments.ab, ADJ_RANGE.ab);
  const gm = clampToRange(r.gm + adjustments.gm, ADJ_RANGE.gm);
  const ev = clampToRange(r.ev + adjustments.ev, ADJ_RANGE.ev);
  const dro = clampToRange(adjustments.dro ?? r.dro, ADJ_RANGE.dro);

  const saturation = style.baseSaturation * (1 + (sat / 3) * 0.4);
  const contrast = style.baseContrast * (1 + (con / 3) * 0.3);
  const warmth = Math.min(
    1.0,
    Math.max(-1.0, (r.wbMode === WB_KELVIN ? kelvinToWarmth(r.kelvin) : 0.0) + (ab / 7) * 0.5),
  );
  const tint = Math.min(1.0, Math.max(-1.0, (gm / 7) * 0.5));
  // ev is stored in 1/3-EV units, so true stops = ev/3, exposure multiplier = 2^stops.
  const exposure = Math.pow(2, ev / 3);
  const shadowLift = droToShadowLift(dro);
  const sharpness = Math.min(1.0, Math.max(-1.0, (sharp / 3) * 0.5));
  const effect = EFFECT_LAYERS[r.pe] ?? null;

  return {
    saturation,
    contrast,
    warmth,
    tint,
    exposure,
    shadowLift,
    sharpness,
    monochrome: r.style === 'mono',
    effect,
    sub: r.sub,
    styleHueShift: style.hueShift,
    styleTint: style.tint ? { r: style.tint[0], g: style.tint[1], b: style.tint[2] } : null,
    styleTintStrength: style.tintStrength,
  };
}
