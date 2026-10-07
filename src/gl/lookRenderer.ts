// Canvas/WebGL2 renderer for the look shader (see lookShader.ts). Mirrors
// lib/editor/look_renderer.dart's two entry points:
//  - a live preview draw, sized to whatever the caller sized the canvas to
//    (unlike the Flutter version, which always evaluated the shader at the
//    source image's native resolution even for the preview — doing that in
//    the browser for arbitrary user-photo sizes would be wasteful; sizing to
//    the destination canvas is the standard, and still-correct, WebGL
//    approach, and renderFullRes below still renders the real export at full
//    native resolution).
//  - a full-resolution render encoded straight to a JPEG Blob via the
//    browser's own canvas encoder — no extra image-encoding library needed,
//    unlike the Flutter port, which had to pull in the `image` package for
//    this because dart:ui only encodes PNG.
import type { RgbColor, ShaderParams } from '../engine/types';
import { LOOK_FRAGMENT_SHADER, LOOK_VERTEX_SHADER } from './lookShader';

type GLImageSource = HTMLImageElement | ImageBitmap;

function getImageSize(image: GLImageSource): { width: number; height: number } {
  if (image instanceof HTMLImageElement) {
    return { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
  }
  return { width: image.width, height: image.height };
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, LOOK_VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, LOOK_FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program.');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${log}`);
  }
  return program;
}

function createQuadBuffer(gl: WebGL2RenderingContext): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('Failed to create buffer.');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // Triangle strip covering clip space, drawn with gl.TRIANGLE_STRIP.
  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  return buffer;
}

function bindQuadAndDraw(gl: WebGL2RenderingContext, quadBuffer: WebGLBuffer): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function createTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error('Failed to create texture.');
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}

function uploadImage(gl: WebGL2RenderingContext, texture: WebGLTexture, image: GLImageSource): void {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // Deliberately NOT using gl.pixelStorei(UNPACK_FLIP_Y_WEBGL, true) here —
  // see the vertex shader's comment in lookShader.ts for why: that flag is
  // ignored for ImageBitmap sources, so the Y-flip is handled uniformly in
  // UV math instead, independent of which source type this is.
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
}

/**
 * Binds every ShaderParams field to its named uniform on the currently-used
 * `program`. Pure w.r.t. GL state beyond that: doesn't touch textures,
 * viewport, or the quad buffer, so it's easy to reason about independent of
 * how/where the draw call happens.
 */
export function bindShaderParams(gl: WebGL2RenderingContext, program: WebGLProgram, params: ShaderParams): void {
  const loc = (name: string) => gl.getUniformLocation(program, name);
  const setf = (name: string, value: number) => gl.uniform1f(loc(name), value);

  setf('uSaturation', params.saturation);
  setf('uContrast', params.contrast);
  setf('uWarmth', params.warmth);
  setf('uTint', params.tint);
  setf('uExposure', params.exposure);
  setf('uShadowLift', params.shadowLift);
  setf('uMonochrome', params.monochrome ? 1 : 0);
  setf('uSharpness', params.sharpness);

  setf('uStyleHueShift', params.styleHueShift);
  const styleTint = params.styleTint;
  setf('uStyleTintR', styleTint?.r ?? 0);
  setf('uStyleTintG', styleTint?.g ?? 0);
  setf('uStyleTintB', styleTint?.b ?? 0);
  setf('uStyleTintStrength', params.styleTintStrength);

  const effect = params.effect;
  setf('uEffectId', effect ? effect.id : 0);
  setf('uEffectSub', params.sub);

  let amount1 = 0;
  let amount2 = 0;
  let tintColor: RgbColor | null = null;
  let tintStrength = 0;

  if (effect) {
    switch (effect.kind) {
      case 'retroPhoto':
        amount1 = effect.fadeAmount;
        tintColor = effect.tintColor;
        tintStrength = effect.tintStrength;
        break;
      case 'softHighKey': {
        amount1 = effect.liftAmount;
        amount2 = effect.bloomAmount;
        const idx = Math.min(Math.max(params.sub, 0), effect.subTints.length - 1);
        tintColor = effect.subTints[idx] ?? null;
        tintStrength = effect.tintStrength;
        break;
      }
      case 'roughMono':
        amount1 = effect.blackCrush;
        amount2 = effect.contrastBoost;
        break;
    }
  }

  setf('uEffectAmount1', amount1);
  setf('uEffectAmount2', amount2);
  setf('uEffectTintR', tintColor?.r ?? 0);
  setf('uEffectTintG', tintColor?.g ?? 0);
  setf('uEffectTintB', tintColor?.b ?? 0);
  setf('uEffectTintStrength', tintStrength);
}

export interface RenderFullResOptions {
  mimeType?: string;
  quality?: number;
}

export class LookRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly quadBuffer: WebGLBuffer;
  private readonly texture: WebGLTexture;
  private lastUploadedImage: GLImageSource | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, alpha: true });
    if (!gl) throw new Error('WebGL2 is not supported in this browser.');
    this.canvas = canvas;
    this.gl = gl;
    this.program = createProgram(gl);
    this.quadBuffer = createQuadBuffer(gl);
    this.texture = createTexture(gl);
  }

  /** Draws `image` through the look shader into this renderer's canvas, at
   * the canvas's current drawing-buffer size (resized here to match the
   * canvas's CSS size × devicePixelRatio × `supersample`). Caller controls
   * layout/CSS size; call this again whenever `image`, `params`, or (if
   * the canvas is being CSS-scaled up, e.g. a pinch/slider zoom control)
   * the zoom level changes.
   *
   * `supersample` exists because a CSS `transform: scale(...)` zoom (see
   * App.tsx's Zoom slider) stretches whatever's already in the canvas —
   * without this, zooming past 100% just blows up the same
   * display-sized raster and looks visibly blocky/blurry. Pass
   * `Math.max(1, zoomPercent / 100)` so the drawing buffer itself grows to
   * match, keeping the zoomed-in view sharp. */
  render(image: GLImageSource, params: ShaderParams, supersample = 1): void {
    const gl = this.gl;
    const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) * supersample;
    const cssWidth = this.canvas.clientWidth;
    const cssHeight = this.canvas.clientHeight;
    let width: number;
    let height: number;
    if (cssWidth > 0 && cssHeight > 0) {
      width = Math.max(1, Math.round(cssWidth * dpr));
      height = Math.max(1, Math.round(cssHeight * dpr));
    } else {
      // Detached canvas with no CSS layout (e.g. the thumbnail renderer's
      // offscreen target) — clientWidth/Height are always 0 for these, so
      // trust the width/height attributes the caller set as-is. Deriving
      // "css size" from `this.canvas.width` here (as an earlier version did)
      // and then re-multiplying by dpr on every call compounds the scale
      // exponentially across repeated render() calls on the same canvas.
      width = this.canvas.width;
      height = this.canvas.height;
    }
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);
    // Re-uploading the full image to the GPU on every call (e.g. every
    // slider-drag tick, which only changes `params`) is what made dragging
    // feel laggy — skip it when the image itself hasn't changed.
    if (image !== this.lastUploadedImage) {
      uploadImage(gl, this.texture, image);
      this.lastUploadedImage = image;
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uTexture'), 0);
    gl.uniform2f(gl.getUniformLocation(this.program, 'uTexelSize'), 1 / this.canvas.width, 1 / this.canvas.height);
    bindShaderParams(gl, this.program, params);
    bindQuadAndDraw(gl, this.quadBuffer);
  }

  /** Renders `image` through the look shader at its own native resolution
   * into a detached offscreen canvas, and resolves the result encoded as a
   * JPEG (by default) Blob — independent of this renderer's on-screen
   * canvas/state. */
  async renderFullRes(image: GLImageSource, params: ShaderParams, opts: RenderFullResOptions = {}): Promise<Blob> {
    const { width, height } = getImageSize(image);
    const mimeType = opts.mimeType ?? 'image/jpeg';
    const quality = opts.quality ?? 0.92;

    const useOffscreen = typeof OffscreenCanvas !== 'undefined';
    const target: OffscreenCanvas | HTMLCanvasElement = useOffscreen
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });

    const gl = target.getContext('webgl2', { premultipliedAlpha: false, alpha: true }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('WebGL2 is not supported in this browser.');

    const program = createProgram(gl);
    const quadBuffer = createQuadBuffer(gl);
    const texture = createTexture(gl);

    try {
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      uploadImage(gl, texture, image);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(gl.getUniformLocation(program, 'uTexture'), 0);
      gl.uniform2f(gl.getUniformLocation(program, 'uTexelSize'), 1 / width, 1 / height);
      bindShaderParams(gl, program, params);
      bindQuadAndDraw(gl, quadBuffer);

      if (target instanceof OffscreenCanvas) {
        return await target.convertToBlob({ type: mimeType, quality });
      }
      return await new Promise<Blob>((resolve, reject) => {
        (target as HTMLCanvasElement).toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null.'))),
          mimeType,
          quality,
        );
      });
    } finally {
      gl.deleteTexture(texture);
      gl.deleteBuffer(quadBuffer);
      gl.deleteProgram(program);
    }
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteTexture(this.texture);
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteProgram(this.program);
  }
}
