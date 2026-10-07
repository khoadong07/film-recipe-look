import { useCallback, useState } from 'react';

import { GlassPanel } from './GlassPanel';
import { cropToImageBitmap, suggestCrop, type CropRect } from '../ai/autoCrop';
import { detectSubjects, type DetectedSubject } from '../ai/subjectDetector';

export interface AutoCropPanelProps {
  image: HTMLImageElement | ImageBitmap | null;
  onApplyCrop: (cropped: ImageBitmap) => void;
  /** Fired after each detection run, so callers (e.g. the recipe recommender,
   * which wants to know whether a face is present) don't have to run their
   * own separate, redundant detection pass. */
  onDetected?: (subject: DetectedSubject | null) => void;
}

type Status = 'idle' | 'detecting' | 'ready' | 'applying' | 'error';

function imageDimensions(image: HTMLImageElement | ImageBitmap): { width: number; height: number } {
  if (image instanceof HTMLImageElement) {
    return { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
  }
  return { width: image.width, height: image.height };
}

/** Renders `image` into a small preview box, with the suggested crop rect drawn as an overlay. */
function CropPreview({ image, rect }: { image: HTMLImageElement | ImageBitmap; rect: CropRect }) {
  const { width, height } = imageDimensions(image);
  const aspect = width / height || 1;
  const src = image instanceof HTMLImageElement ? image.src : undefined;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: aspect,
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        background: 'var(--color-muted)',
      }}
    >
      {src ? (
        // HTMLImageElement: reuse its already-loaded src, no extra decode.
        <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <BitmapPreview bitmap={image as ImageBitmap} />
      )}
      <div
        style={{
          position: 'absolute',
          left: `${rect.x * 100}%`,
          top: `${rect.y * 100}%`,
          width: `${rect.width * 100}%`,
          height: `${rect.height * 100}%`,
          border: '2px solid var(--color-accent)',
          boxShadow: '0 0 0 1000px rgba(15,23,42,0.35)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

/** Draws an ImageBitmap (no `.src` to reuse) into a canvas for the preview box. */
function BitmapPreview({ bitmap }: { bitmap: ImageBitmap }) {
  return (
    <canvas
      ref={(canvas) => {
        if (!canvas) return;
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
      }}
      style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }}
    />
  );
}

export function AutoCropPanel({ image, onApplyCrop, onDetected }: AutoCropPanelProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [subject, setSubject] = useState<DetectedSubject | null>(null);
  const [rect, setRect] = useState<CropRect | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDetect = useCallback(async () => {
    if (!image) return;
    setStatus('detecting');
    setError(null);
    try {
      const subjects = await detectSubjects(image);
      const top = subjects[0] ?? null;
      const { width, height } = imageDimensions(image);
      setSubject(top);
      setRect(suggestCrop(width, height, top));
      setStatus('ready');
      onDetected?.(top);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not detect a subject in this photo.');
      setStatus('error');
    }
  }, [image, onDetected]);

  const handleApply = useCallback(async () => {
    if (!image || !rect) return;
    setStatus('applying');
    try {
      const cropped = await cropToImageBitmap(image, rect);
      onApplyCrop(cropped);
      setStatus('idle');
      setSubject(null);
      setRect(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not apply this crop.');
      setStatus('error');
    }
  }, [image, rect, onApplyCrop]);

  const handleDismiss = useCallback(() => {
    setSubject(null);
    setRect(null);
    setStatus('idle');
    setError(null);
  }, []);

  return (
    <GlassPanel title="Auto Crop">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {!rect && (
          <>
            <button
              onClick={handleDetect}
              disabled={!image || status === 'detecting'}
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-on-accent)',
                borderRadius: 999,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: 700,
                opacity: !image || status === 'detecting' ? 0.6 : 1,
              }}
            >
              {status === 'detecting' ? 'Detecting subject…' : 'Detect & Suggest Crop'}
            </button>
            {!image && (
              <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>Import a photo first.</span>
            )}
          </>
        )}

        {error && (
          <span style={{ fontSize: 12, color: 'var(--color-destructive)' }}>{error}</span>
        )}

        {image && rect && (
          <>
            <CropPreview image={image} rect={rect} />
            <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>
              {subject
                ? `${subject.kind === 'face' ? 'Face' : subject.label} detected (${Math.round(subject.score * 100)}%)`
                : 'No clear subject — showing full frame'}
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleApply}
                disabled={status === 'applying'}
                style={{
                  flex: 1,
                  background: 'var(--color-accent)',
                  color: 'var(--color-on-accent)',
                  borderRadius: 999,
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  opacity: status === 'applying' ? 0.6 : 1,
                }}
              >
                {status === 'applying' ? 'Applying…' : 'Apply Crop'}
              </button>
              <button
                onClick={handleDismiss}
                style={{
                  background: 'var(--color-muted)',
                  color: 'var(--color-foreground)',
                  borderRadius: 999,
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Dismiss
              </button>
            </div>
          </>
        )}
      </div>
    </GlassPanel>
  );
}
