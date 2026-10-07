import { useRef, useState } from 'react';

import { describeMatch, suggestAdjustmentsFromReference } from '../ai/colorMatch';
import { computeImageStats } from '../ai/imageStats';
import type { RecipeAdjustments } from '../engine/types';
import { GlassPanel } from './GlassPanel';

export interface ColorMatchPanelProps {
  targetImage: HTMLImageElement | ImageBitmap | null;
  currentAdjustments: RecipeAdjustments;
  onApply: (adjustments: RecipeAdjustments) => void;
}

type MatchState =
  | { phase: 'idle' }
  | { phase: 'analyzing' }
  | { phase: 'needs-target'; thumbUrl: string }
  | { phase: 'ready'; thumbUrl: string; suggested: RecipeAdjustments; bullets: string[] }
  | { phase: 'error'; message: string };

/** "Match a Photo": pick a reference image and suggest adjustment deltas
 * (via colorMatch.ts's pure signal-processing heuristics, not ML) that push
 * the target photo's look toward the reference's. */
export function ColorMatchPanel({ targetImage, currentAdjustments, onApply }: ColorMatchPanelProps) {
  const [state, setState] = useState<MatchState>({ phase: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  const pickReference = () => inputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file later
    if (!file) return;

    setState({ phase: 'analyzing' });
    const thumbUrl = URL.createObjectURL(file);

    try {
      const referenceBitmap = await createImageBitmap(file);
      if (!targetImage) {
        setState({ phase: 'needs-target', thumbUrl });
        return;
      }
      const referenceStats = computeImageStats(referenceBitmap);
      const targetStats = computeImageStats(targetImage);
      const suggested = suggestAdjustmentsFromReference(targetStats, referenceStats, currentAdjustments);
      const bullets = describeMatch(targetStats, referenceStats);
      setState({ phase: 'ready', thumbUrl, suggested, bullets });
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'Could not analyze that photo.' });
    }
  };

  const reset = () => {
    if ('thumbUrl' in state) URL.revokeObjectURL(state.thumbUrl);
    setState({ phase: 'idle' });
  };

  const apply = () => {
    if (state.phase !== 'ready') return;
    onApply(state.suggested);
    reset();
  };

  return (
    <GlassPanel title="Match a Photo">
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />

      {state.phase === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted-foreground)' }}>
            Upload a photo whose look you want — brightness, saturation, contrast and white balance will be analyzed and
            suggested as tuning deltas.
          </p>
          <button
            onClick={pickReference}
            style={{
              alignSelf: 'flex-start',
              background: 'var(--color-muted)',
              color: 'var(--color-foreground)',
              borderRadius: 999,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Choose Reference Photo
          </button>
        </div>
      )}

      {state.phase === 'analyzing' && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted-foreground)' }}>Analyzing…</p>
      )}

      {state.phase === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-destructive)' }}>{state.message}</p>
          <button
            onClick={pickReference}
            style={{ alignSelf: 'flex-start', background: 'var(--color-muted)', color: 'var(--color-foreground)', borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 600 }}
          >
            Try Again
          </button>
        </div>
      )}

      {state.phase === 'needs-target' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <img src={state.thumbUrl} alt="Reference" style={{ width: 56, height: 56, borderRadius: 'var(--radius-md)', objectFit: 'cover' }} />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted-foreground)' }}>Import a photo first, then pick a reference to match against it.</p>
          </div>
          <button
            onClick={reset}
            style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 600, color: 'var(--color-muted-foreground)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {state.phase === 'ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <img src={state.thumbUrl} alt="Reference" style={{ width: 56, height: 56, borderRadius: 'var(--radius-md)', objectFit: 'cover', flexShrink: 0 }} />
            {state.bullets.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--color-muted-foreground)', lineHeight: 1.6 }}>
                {state.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted-foreground)' }}>Already a close match.</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={apply}
              style={{ background: 'var(--color-accent)', color: 'var(--color-on-accent)', borderRadius: 999, padding: '8px 18px', fontSize: 13, fontWeight: 700 }}
            >
              Apply
            </button>
            <button
              onClick={reset}
              style={{ color: 'var(--color-muted-foreground)', fontSize: 13, fontWeight: 600, padding: '8px 10px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </GlassPanel>
  );
}
