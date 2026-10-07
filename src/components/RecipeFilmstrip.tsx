import type { SonyRecipe } from '../engine/types';

export interface RecipeFilmstripGroup {
  group: string;
  items: { recipe: SonyRecipe; index: number }[];
}

export interface RecipeFilmstripProps {
  groups: RecipeFilmstripGroup[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** One thumbnail data-URL per recipe, indexed the same as `index` below.
   * `null`/missing while they're still being generated — falls back to a
   * plain text card so the strip is usable immediately. */
  thumbnails?: string[] | null;
}

const CARD_SIZE = 64;

/** Snapseed-style horizontal card strip: a square preview thumbnail per
 * recipe (not just a text pill) with its name below, so you can flick
 * through looks and see the actual result without losing the main preview
 * off-screen — built for narrow/mobile layouts. */
export function RecipeFilmstrip({ groups, selectedIndex, onSelect, thumbnails }: RecipeFilmstripProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollSnapType: 'x proximity',
        padding: '2px 4px 8px',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {groups.map(({ group, items }, i) => (
        <div key={group} style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: 18 }}>
          {i > 0 && (
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                fontSize: 20,
                fontWeight: 300,
                color: 'var(--color-border)',
                lineHeight: 1,
                alignSelf: 'stretch',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              |
            </span>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--color-accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              paddingLeft: 2,
            }}
          >
            {group}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            {items.map(({ recipe, index }) => {
              const active = index === selectedIndex;
              const thumb = thumbnails?.[index];
              return (
                <button
                  key={recipe.name}
                  onClick={() => onSelect(index)}
                  style={{
                    scrollSnapAlign: 'start',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    width: CARD_SIZE,
                  }}
                >
                  <div
                    style={{
                      width: CARD_SIZE,
                      height: CARD_SIZE,
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      background: 'var(--color-muted)',
                      border: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                      boxShadow: active ? '0 2px 8px rgba(217, 119, 6, 0.35)' : 'none',
                      transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
                    }}
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        width={CARD_SIZE}
                        height={CARD_SIZE}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          color: 'var(--color-muted-foreground)',
                          textAlign: 'center',
                          padding: 4,
                        }}
                      >
                        {recipe.name}
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: active ? 700 : 500,
                      color: active ? 'var(--color-accent)' : 'var(--color-foreground)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: CARD_SIZE,
                    }}
                  >
                    {recipe.name}
                  </span>
                </button>
              );
            })}
          </div>
          </div>
        </div>
      ))}
    </div>
  );
}
