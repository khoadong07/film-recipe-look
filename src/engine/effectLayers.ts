// Identifier + tuning constants for a Sony Picture Effect. The actual pixel
// transform lives in the GL shader, which switches on `id`/`sub`; this module
// only carries the numbers the shader reads for that effect. Ported 1:1 from
// recipe_look_pack's lib/engine/effect_layer.dart.
import type { EffectLayer, RgbColor } from './types';

const rgb = (hex: number): RgbColor => ({
  r: ((hex >> 16) & 0xff) / 255,
  g: ((hex >> 8) & 0xff) / 255,
  b: (hex & 0xff) / 255,
});

export const EFFECT_LAYERS: Record<number, EffectLayer> = {
  // pe=4 "Retro Photo": faded, warm/brown-toned, lowered contrast.
  4: {
    kind: 'retroPhoto',
    id: 4,
    fadeAmount: 0.22,
    tintColor: rgb(0xbe9b6e),
    tintStrength: 0.28,
  },
  // pe=5 "Soft High-Key": bright, lifted, low-contrast bloom with a tint
  // selected by `sub` (0=blue, 1=pink, 2=green).
  5: {
    kind: 'softHighKey',
    id: 5,
    liftAmount: 0.22,
    bloomAmount: 0.3,
    subTints: [rgb(0x9fc6e8), rgb(0xe8b8c6), rgb(0xbfe0c0)],
    tintStrength: 0.18,
  },
  // pe=7 "Rough Mono" (HC Mono): monochrome with deep crushed blacks and a
  // steep contrast curve.
  7: {
    kind: 'roughMono',
    id: 7,
    blackCrush: 0.35,
    contrastBoost: 1.25,
  },
};
