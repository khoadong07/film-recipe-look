import type { ReactNode } from 'react';

export interface IconRailItem {
  id: string;
  icon: ReactNode;
  label: string;
}

export interface IconRailProps {
  items: IconRailItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** 'vertical' (default): slim strip down the left edge, for desktop widths.
   * 'horizontal': a row of tabs, for narrow/mobile layouts. */
  direction?: 'vertical' | 'horizontal';
}

/** Slim icon strip (vertical rail or horizontal tab row), one entry highlighted as active. */
export function IconRail({ items, activeId, onSelect, direction = 'vertical' }: IconRailProps) {
  const horizontal = direction === 'horizontal';
  return (
    <nav
      style={{
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        gap: 8,
        padding: 10,
        background: 'var(--color-card)',
        borderRight: horizontal ? 'none' : '1px solid var(--color-border)',
        borderBottom: horizontal ? '1px solid var(--color-border)' : 'none',
        justifyContent: horizontal ? 'center' : 'flex-start',
      }}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-current={active ? 'true' : undefined}
            onClick={() => onSelect(item.id)}
            style={{
              width: horizontal ? 'auto' : 44,
              height: 44,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: horizontal ? 6 : 0,
              padding: horizontal ? '0 14px' : 0,
              borderRadius: 'var(--radius-md)',
              background: active ? 'var(--color-accent)' : 'transparent',
              color: active ? 'var(--color-on-accent)' : 'var(--color-muted-foreground)',
              transition: 'background var(--transition-fast), color var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.background = 'var(--color-muted)';
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.background = 'transparent';
            }}
          >
            {item.icon}
            {horizontal && <span style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
