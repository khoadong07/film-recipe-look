// Fixed per-CreativeStyle base look, tuned once against the camera's
// pure-style sample frames. Combined with the recipe's own sat/con/WB in
// lookEngine.ts's buildShaderParams(). Ported 1:1 from recipe_look_pack's
// lib/engine/style_profile.dart.
import type { CreativeStyle, StyleProfile } from './types';

// Color(0xFF704214) straight RGB / 255.
const SEPIA_TINT: [number, number, number] = [0x70 / 255, 0x42 / 255, 0x14 / 255];

export const STYLE_PROFILES: Record<CreativeStyle, StyleProfile> = {
  std: { baseSaturation: 1.0, baseContrast: 1.0, hueShift: 0, tint: null, tintStrength: 0 },
  vivid: { baseSaturation: 1.25, baseContrast: 1.12, hueShift: 0, tint: null, tintStrength: 0 },
  neutral: { baseSaturation: 0.85, baseContrast: 0.9, hueShift: 0, tint: null, tintStrength: 0 },
  portrait: { baseSaturation: 0.95, baseContrast: 0.92, hueShift: 0, tint: null, tintStrength: 0 },
  landscape: { baseSaturation: 1.15, baseContrast: 1.08, hueShift: -15.0, tint: null, tintStrength: 0 },
  mono: { baseSaturation: 0.0, baseContrast: 1.05, hueShift: 0, tint: null, tintStrength: 0 },
  clear: { baseSaturation: 1.05, baseContrast: 0.95, hueShift: -5.0, tint: null, tintStrength: 0 },
  deep: { baseSaturation: 1.1, baseContrast: 1.1, hueShift: -5.0, tint: null, tintStrength: 0 },
  light: { baseSaturation: 0.9, baseContrast: 0.85, hueShift: 5.0, tint: null, tintStrength: 0 },
  sunset: { baseSaturation: 1.1, baseContrast: 1.0, hueShift: 25.0, tint: null, tintStrength: 0 },
  night: { baseSaturation: 0.95, baseContrast: 1.1, hueShift: -10.0, tint: null, tintStrength: 0 },
  autumn: { baseSaturation: 1.15, baseContrast: 1.0, hueShift: 20.0, tint: null, tintStrength: 0 },
  sepia: { baseSaturation: 0.3, baseContrast: 1.0, hueShift: 0, tintStrength: 0.6, tint: SEPIA_TINT },
};
