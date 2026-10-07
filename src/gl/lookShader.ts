// WebGL2 port of recipe_look_pack's shaders/look.frag. Pipeline and constants
// are kept numerically identical to the Flutter/SkSL original: sharpness
// (unsharp mask) -> exposure -> shadow lift -> contrast -> white balance
// (warmth/tint) -> saturation -> style hue/tint bias -> monochrome ->
// picture-effect overlay (retro-photo id 4 / soft-high-key id 5 / rough-mono
// id 7). Uniforms are bound by name (see bindShaderParams in
// lookRenderer.ts), so declaration order here doesn't matter the way it did
// for Flutter's index-based uniform API.

export const LOOK_VERTEX_SHADER = `#version 300 es
precision highp float;

// Full-screen triangle strip quad in clip space. The Y flip here (rather
// than relying on gl.pixelStorei(UNPACK_FLIP_Y_WEBGL, true) at upload time)
// is deliberate: that pixel-store flag is a well-known WebGL gotcha — per
// spec it's silently ignored when the upload source is an ImageBitmap
// (only HTMLImageElement/HTMLCanvasElement/video respect it), so a RAW-
// decoded photo or a createImageBitmap()-cropped thumbnail would upload
// un-flipped while a plain <img>-decoded JPEG would still get flipped,
// making orientation depend on *how the photo was imported* instead of
// being consistent. Flipping unconditionally in UV math here instead means
// every source type is treated identically.
layout(location = 0) in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = vec2(aPosition.x * 0.5 + 0.5, 1.0 - (aPosition.y * 0.5 + 0.5));
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const LOOK_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexture; // source image
uniform vec2 uTexelSize;    // 1.0 / destination size in pixels, for the unsharp-mask taps

uniform float uSaturation;  // global saturation multiplier (1.0 = unchanged)
uniform float uContrast;    // global contrast multiplier (1.0 = unchanged)
uniform float uWarmth;      // -1..1, amber(+)/blue(-) white balance shift
uniform float uTint;        // -1..1, green(+)/magenta(-) white balance shift
uniform float uExposure;    // multiplier, e.g. 2^stops
uniform float uShadowLift;  // 0..~0.4, lifts shadows more than highlights
uniform float uMonochrome;  // 0.0 or 1.0
uniform float uSharpness;   // -1..1 unsharp-mask strength; 0 = untouched, <0 softens (blur)

uniform float uStyleHueShift;     // degrees, -180..180
uniform float uStyleTintR;        // StyleProfile.tint, straight 0..1 RGB (ignored if uStyleTintStrength <= 0)
uniform float uStyleTintG;
uniform float uStyleTintB;
uniform float uStyleTintStrength; // 0..1

uniform float uEffectId;    // 0 = none, 4 = retro-photo, 5 = soft-high-key, 7 = rough-mono
uniform float uEffectSub;   // effect sub-parameter (unused directly in-shader; selection already baked into tint on the JS side)
// Generic per-effect numeric knobs, meaning depends on uEffectId:
//   retro-photo:    amount1 = fadeAmount, amount2 = unused
//   soft-high-key:  amount1 = liftAmount, amount2 = bloomAmount
//   rough-mono:     amount1 = blackCrush, amount2 = contrastBoost
uniform float uEffectAmount1;
uniform float uEffectAmount2;
// Generic per-effect tint color (straight 0..1 RGB) + strength.
uniform float uEffectTintR;
uniform float uEffectTintG;
uniform float uEffectTintB;
uniform float uEffectTintStrength;

const vec3 kLumaWeights = vec3(0.2126, 0.7152, 0.0722);

float luma(vec3 c) {
  return dot(c, kLumaWeights);
}

vec3 applyContrast(vec3 c, float amount) {
  return (c - 0.5) * amount + 0.5;
}

vec3 applySaturation(vec3 c, float amount) {
  float l = luma(c);
  return mix(vec3(l), c, amount);
}

// Rotates rgb's hue by 'degrees' using the standard YIQ-space rotation
// matrix (cheap full-circle hue rotation without a HSL round-trip).
vec3 rotateHue(vec3 c, float degrees_) {
  float a = radians(degrees_);
  float cosA = cos(a);
  float sinA = sin(a);
  mat3 m = mat3(
    0.299, 0.587, 0.114,
    0.596, -0.274, -0.322,
    0.211, -0.523, 0.312
  );
  mat3 mInv = mat3(
    1.0, 0.956, 0.621,
    1.0, -0.272, -0.647,
    1.0, -1.106, 1.703
  );
  vec3 yiq = m * c;
  float i = yiq.y * cosA - yiq.z * sinA;
  float q = yiq.y * sinA + yiq.z * cosA;
  return mInv * vec3(yiq.x, i, q);
}

// Effect 4: "retro-photo" — faded/lifted blacks toward a tint color (amount1
// = fadeAmount), plus that same tint blended in at 'tintStrength', and
// slightly reduced contrast, approximating a vintage color-print look.
vec3 applyRetroPhoto(vec3 c, vec3 tint, float fadeAmount, float tintStrength) {
  float l = luma(c);
  float shadowAmount = 1.0 - smoothstep(0.0, 0.6, l);
  c = mix(c, mix(c, tint, 0.5), fadeAmount * shadowAmount);
  c = mix(c, c * tint * 2.0, tintStrength * 0.5);
  c = applyContrast(c, 0.9);
  return c;
}

// Effect 5: "soft-high-key" — bloom-like glow via lifting midtones/highlights
// (amount1 = liftAmount, amount2 = bloomAmount) and softened contrast, plus a
// highlight tint (already selected by 'sub' on the JS side).
vec3 applySoftHighKey(vec3 c, vec3 tint, float liftAmount, float bloomAmount, float tintStrength) {
  float l = luma(c);
  float liftMask = smoothstep(0.2, 0.9, l);
  c = mix(c, c + vec3(liftAmount), liftMask * 0.6);
  float bloomMask = smoothstep(0.55, 1.0, l);
  c += vec3(bloomAmount) * bloomMask * 0.35;
  c = applyContrast(c, 0.82);

  float highlightAmount = smoothstep(0.45, 1.0, l);
  c = mix(c, mix(c, tint, 0.5), tintStrength * highlightAmount);
  return c;
}

// Effect 7: "rough-mono" (HC Mono) — forced monochrome with a harder,
// punchier contrast curve than the plain monochrome flag gives: deeper
// blacks (blackCrush), brighter whites (contrastBoost).
vec3 applyRoughMono(vec3 c, float blackCrush, float contrastBoost) {
  float l = luma(c);
  float x = l - 0.5;
  float curved = x * abs(x) * 2.0 * contrastBoost + 0.5;
  curved = mix(l, curved, 0.8);
  curved -= blackCrush * (1.0 - smoothstep(0.0, 0.35, curved));
  return vec3(clamp(curved, 0.0, 1.0));
}

void main() {
  vec4 src = texture(uTexture, vUv);
  // Unpremultiply so math below operates on straight RGB; texture alpha is
  // carried through untouched and reapplied at the end.
  vec3 rgb = src.a > 0.0 ? src.rgb / src.a : src.rgb;

  // 1. Sharpness: cheap 4-tap unsharp mask (box-blur high-pass added back in).
  // Positive sharpens, negative softens toward the local blur.
  if (abs(uSharpness) > 0.001) {
    vec3 n = texture(uTexture, vUv + vec2(0.0, -uTexelSize.y)).rgb;
    vec3 s = texture(uTexture, vUv + vec2(0.0, uTexelSize.y)).rgb;
    vec3 e = texture(uTexture, vUv + vec2(uTexelSize.x, 0.0)).rgb;
    vec3 w = texture(uTexture, vUv + vec2(-uTexelSize.x, 0.0)).rgb;
    vec3 blurred = (n + s + e + w) * 0.25;
    rgb += (rgb - blurred) * uSharpness;
  }

  // 2. Exposure.
  rgb *= uExposure;

  // 3. Shadow lift: adds light to shadows, tapering off by mid-gray so
  // highlights are left alone.
  float l = luma(rgb);
  float shadowMask = 1.0 - smoothstep(0.0, 0.5, l);
  rgb += uShadowLift * (1.0 - rgb) * shadowMask;

  // 4. Contrast: simple pivot around mid-gray.
  rgb = applyContrast(rgb, uContrast);

  // 5. White balance: warmth pushes red up / blue down (or the reverse for
  // negative values); tint pushes green up / red+blue down (or the reverse).
  rgb += vec3(uWarmth * 0.15, 0.0, -uWarmth * 0.15);
  rgb += vec3(-uTint * 0.08, uTint * 0.15, -uTint * 0.08);

  // 6. Saturation (allows > 1 for oversaturation).
  rgb = applySaturation(rgb, uSaturation);

  // 7. Style bias: characteristic hue push + optional color tint (e.g. sepia).
  if (abs(uStyleHueShift) > 0.001) {
    rgb = rotateHue(rgb, uStyleHueShift);
  }
  if (uStyleTintStrength > 0.0) {
    vec3 styleTint = vec3(uStyleTintR, uStyleTintG, uStyleTintB);
    rgb = mix(rgb, rgb * styleTint * 2.0, uStyleTintStrength);
  }

  // 8. Monochrome flag: force full desaturation regardless of uSaturation.
  rgb = mix(rgb, vec3(luma(rgb)), uMonochrome);

  // 9. Picture-effect overlay.
  if (uEffectId > 3.5 && uEffectId < 4.5) {
    vec3 tint = vec3(uEffectTintR, uEffectTintG, uEffectTintB);
    rgb = applyRetroPhoto(rgb, tint, uEffectAmount1, uEffectTintStrength);
  } else if (uEffectId > 4.5 && uEffectId < 5.5) {
    vec3 tint = vec3(uEffectTintR, uEffectTintG, uEffectTintB);
    rgb = applySoftHighKey(rgb, tint, uEffectAmount1, uEffectAmount2, uEffectTintStrength);
  } else if (uEffectId > 6.5 && uEffectId < 7.5) {
    rgb = applyRoughMono(rgb, uEffectAmount1, uEffectAmount2);
  }

  rgb = clamp(rgb, 0.0, 1.0);
  fragColor = vec4(rgb * src.a, src.a);
}
`;
