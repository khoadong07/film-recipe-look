import type { ReactNode } from 'react';

import { Logomark } from './Logomark';

export interface TopToolbarProps {
  title: string;
  subtitle?: string;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  children?: ReactNode;
}

/** App shell header: brand mark + title pill, middle slot, primary CTA. */
export function TopToolbar({ title, subtitle, onPrimaryAction, primaryActionLabel = 'Download', children }: TopToolbarProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        padding: '12px 16px',
        background: 'var(--color-card)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Logomark size={28} />
        <span
          style={{
            background: 'var(--color-muted)',
            color: 'var(--color-foreground)',
            borderRadius: 999,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 600,
            maxWidth: '40vw',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>{children}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {subtitle && <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>{subtitle}</span>}
        {onPrimaryAction && (
          <button
            onClick={onPrimaryAction}
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-on-accent)',
              borderRadius: 999,
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 700,
              transition: 'opacity var(--transition-fast)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {primaryActionLabel}
          </button>
        )}
      </div>
    </header>
  );
}
