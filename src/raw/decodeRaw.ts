// Decodes camera RAW files (Canon CR2/CR3/CRW, Sony ARW/SR2/SRF, and anything
// else LibRaw supports) into an ImageBitmap the look-shader pipeline can
// render exactly like any other photo. `libraw-wasm` is dynamically imported
// so its ~1.4MB wasm payload only loads for users who actually open a RAW
// file, not on every page load.

const RAW_EXTENSIONS = new Set([
  // Canon
  'cr2', 'cr3', 'crw',
  // Sony
  'arw', 'srf', 'sr2',
]);

export function isRawFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext ? RAW_EXTENSIONS.has(ext) : false;
}

/** Comma-separated extension list, for a file input's `accept` attribute. */
export const RAW_ACCEPT = Array.from(RAW_EXTENSIONS, (ext) => `.${ext}`).join(',');

export async function decodeRawToImageBitmap(file: File): Promise<ImageBitmap> {
  const { default: LibRaw } = await import('libraw-wasm');
  const bytes = new Uint8Array(await file.arrayBuffer());

  const raw = new LibRaw();
  try {
    // useCameraWb: start from the camera's as-shot white balance rather than
    // LibRaw's own auto-WB guess — film recipes expect to grade on top of a
    // "straight out of camera" base, same as the embedded JPEG would give.
    // outputColor 1 = sRGB, outputBps 8 = the Uint8 RGB triplets we convert
    // below (16-bit would need an extra downscale step).
    await raw.open(bytes, { useCameraWb: true, outputColor: 1, outputBps: 8 });
    const decoded = await raw.imageData();
    if (!decoded) throw new Error('LibRaw returned no image data for this file.');

    const { width, height, colors, data } = decoded;
    if (data.length < width * height * colors) {
      throw new Error('Decoded RAW data is smaller than its reported dimensions.');
    }

    const rgba = new Uint8ClampedArray(width * height * 4);
    const to8 = data instanceof Uint16Array ? (v: number) => v >> 8 : (v: number) => v;
    for (let px = 0, src = 0; px < width * height; px++, src += colors) {
      const r = to8(data[src]);
      const g = to8(data[src + 1]);
      const b = colors >= 3 ? to8(data[src + 2]) : g;
      const out = px * 4;
      rgba[out] = r;
      rgba[out + 1] = g;
      rgba[out + 2] = b;
      rgba[out + 3] = 255;
    }

    const imageData = new ImageData(rgba, width, height);
    return await createImageBitmap(imageData);
  } finally {
    raw.dispose();
  }
}
