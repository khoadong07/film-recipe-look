import { useMemo } from 'react';

import { GlassPanel } from './GlassPanel';
import { recommendRecipes } from '../ai/recipeRecommender';
import type { ImageStats } from '../ai/imageStats';

export interface RecipeSuggestionsProps {
  stats: ImageStats | null;
  hasFace: boolean;
  onSelect: (index: number) => void;
  selectedIndex: number;
}

/** Rule-based "suggested for this photo" list — see recipeRecommender.ts for
 * the (non-ML, heuristic) scoring this renders. */
export function RecipeSuggestions({ stats, hasFace, onSelect, selectedIndex }: RecipeSuggestionsProps) {
  const suggestions = useMemo(() => (stats ? recommendRecipes(stats, { hasFace }) : []), [stats, hasFace]);

  return (
    <GlassPanel title="Suggested For This Photo">
      {!stats && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted-foreground)' }}>
          Import a photo to see suggestions.
        </p>
      )}

      {stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {suggestions.map(({ index, recipe, reason }) => {
            const active = index === selectedIndex;
            return (
              <button
                key={index}
                type="button"
                onClick={() => onSelect(index)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: active ? 'var(--color-accent-soft)' : 'transparent',
                  border: '1px solid',
                  borderColor: active ? 'var(--color-accent)' : 'transparent',
                  transition: 'background var(--transition-fast), border-color var(--transition-fast)',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: active ? 'var(--color-accent)' : 'var(--color-foreground)',
                  }}
                >
                  {recipe.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted-foreground)', marginTop: 2 }}>{reason}</div>
              </button>
            );
          })}
        </div>
      )}
    </GlassPanel>
  );
}
