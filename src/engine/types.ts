// Shared type contracts for the look-rendering pipeline, ported 1:1 in spirit
// from the Flutter app's lib/engine/*.dart + lib/data/sony_recipes.dart.
// Keep field names/units identical to the Dart originals so the data and GL
// ports can be cross-checked against them.

export type CreativeStyle =
  | 'std'
  | 'vivid'
  | 'neutral'
  | 'portrait'
  | 'landscape'
  | 'mono'
  | 'clear'
  | 'deep'
  | 'light'
  | 'sunset'
  | 'night'
  | 'autumn'
  | 'sepia';

export interface SonyRecipe {
  group: string;
  name: string;
  style: CreativeStyle;
  sat: number;
  con: number;
  sharp: number;
  wbMode: number;
  kelvin: number;
  ab: number;
  gm: number;
  pe: number;
  ev: number;
  dro: number;
  sub: number;
  note?: string;
}

export const DRO_OFF = 0;
export const DRO_AUTO = 6;
export const WB_AS_IS = 0;
export const WB_AUTO = 1;
export const WB_KELVIN = 14;

export interface StyleProfile {
  baseSaturation: number;
  baseContrast: number;
  hueShift: number; // degrees, -180..180
  tint: [number, number, number] | null; // straight 0..1 RGB
  tintStrength: number; // 0..1
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/** Mirrors lib/engine/effect_layer.dart's sealed EffectLayer subtypes. */
export type EffectLayer =
  | { kind: 'retroPhoto'; id: 4; fadeAmount: number; tintColor: RgbColor; tintStrength: number }
  | { kind: 'softHighKey'; id: 5; liftAmount: number; bloomAmount: number; subTints: RgbColor[]; tintStrength: number }
  | { kind: 'roughMono'; id: 7; blackCrush: number; contrastBoost: number };

/** Mirrors lib/engine/shader_params.dart's ShaderParams. */
export interface ShaderParams {
  saturation: number;
  contrast: number;
  warmth: number; // -1..1
  tint: number; // -1..1
  exposure: number; // multiplier
  shadowLift: number; // 0..~0.4
  sharpness: number; // -1..1
  monochrome: boolean;
  effect: EffectLayer | null;
  sub: number;
  styleHueShift: number;
  styleTint: RgbColor | null;
  styleTintStrength: number;
}

/** Mirrors lib/engine/recipe_adjustments.dart's RecipeAdjustments. */
export interface RecipeAdjustments {
  sat: number;
  con: number;
  sharp: number;
  ab: number;
  gm: number;
  ev: number;
  dro: number | null; // null = use the recipe's own DRO
}

export const IDENTITY_ADJUSTMENTS: RecipeAdjustments = {
  sat: 0,
  con: 0,
  sharp: 0,
  ab: 0,
  gm: 0,
  ev: 0,
  dro: null,
};

export const ADJ_RANGE = {
  sat: [-3, 3] as const,
  con: [-3, 3] as const,
  sharp: [-3, 3] as const,
  ab: [-7, 7] as const,
  gm: [-7, 7] as const,
  ev: [-15, 15] as const,
  dro: [0, 6] as const,
};

export function clampToRange(value: number, range: readonly [number, number]): number {
  return Math.min(range[1], Math.max(range[0], value));
}

export function isIdentityAdjustments(a: RecipeAdjustments): boolean {
  return a.sat === 0 && a.con === 0 && a.sharp === 0 && a.ab === 0 && a.gm === 0 && a.ev === 0 && a.dro === null;
}
