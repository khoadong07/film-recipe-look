// Composition helper built on top of subjectDetector.ts's detection: given a
// subject's bounding box, suggest a tighter crop centered on it that keeps
// the source photo's own aspect ratio.
import type { DetectedSubject } from './subjectDetector';

export interface CropRect {
  /** Normalized 0..1, same convention as DetectedSubject.box. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computes the tightest crop that contains `subject`'s box plus `marginFactor`
 * of padding (relative to the subject's own size) on every side, re-centered
 * and expanded along one axis as needed to match the source image's aspect
 * ratio (`imageWidth / imageHeight`) — never changes that ratio. Returns the
 * full-frame rect when `subject` is null (nothing detected, nothing to
 * suggest).
 */
export function suggestCrop(
  imageWidth: number,
  imageHeight: number,
  subject: DetectedSubject | null,
  marginFactor = 0.35,
): CropRect {
  if (!subject || imageWidth <= 0 || imageHeight <= 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  const sourceAspect = imageWidth / imageHeight;

  // 1. Pad the subject's own box by marginFactor on every side.
  const { box } = subject;
  const padX = box.width * marginFactor;
  const padY = box.height * marginFactor;
  let left = box.x - padX;
  let top = box.y - padY;
  let right = box.x + box.width + padX;
  let bottom = box.y + box.height + padY;

  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;
  let width = right - left;
  let height = bottom - top;

  // 2. Expand (never shrink) along whichever axis is needed so the padded
  // box matches the source aspect ratio, re-centered on the same point.
  const paddedAspect = width / height;
  if (paddedAspect > sourceAspect) {
    // Wider than the target ratio — grow height to match.
    height = width / sourceAspect;
  } else {
    // Taller than the target ratio — grow width to match.
    width = height * sourceAspect;
  }

  // If the subject + margin is larger than the whole frame along either
  // axis, no crop can both contain it and fit inside [0,1] — shrink the
  // margin before giving up (an extremely tight, edge-filling subject).
  if (width > 1 || height > 1) {
    const overflow = Math.max(width, height);
    const shrink = 1 / overflow;
    width *= shrink;
    height *= shrink;
  }

  left = centerX - width / 2;
  top = centerY - height / 2;

  // 3. Shift (don't independently clamp each edge, which would distort the
  // aspect ratio) so the rect stays within the frame.
  if (left < 0) left = 0;
  else if (left + width > 1) left = 1 - width;
  if (top < 0) top = 0;
  else if (top + height > 1) top = 1 - height;

  // Width/height can still exceed 1 by float epsilon after the shift above
  // in a degenerate case (width/height itself ~1) — clamp defensively.
  width = Math.min(width, 1);
  height = Math.min(height, 1);
  left = Math.max(0, Math.min(left, 1 - width));
  top = Math.max(0, Math.min(top, 1 - height));

  return { x: left, y: top, width, height };
}

export async function cropToImageBitmap(
  image: HTMLImageElement | ImageBitmap,
  rect: CropRect,
): Promise<ImageBitmap> {
  const imageWidth = image instanceof HTMLImageElement ? image.naturalWidth || image.width : image.width;
  const imageHeight = image instanceof HTMLImageElement ? image.naturalHeight || image.height : image.height;

  const sx = Math.round(rect.x * imageWidth);
  const sy = Math.round(rect.y * imageHeight);
  const sw = Math.max(1, Math.round(rect.width * imageWidth));
  const sh = Math.max(1, Math.round(rect.height * imageHeight));

  return createImageBitmap(image, sx, sy, sw, sh);
}
