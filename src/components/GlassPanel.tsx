import type { CSSProperties, ReactNode } from 'react';

export interface GlassPanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** White "glass" card chrome used for side panels / settings groups. */
export function GlassPanel({ title, children, className, style }: GlassPanelProps) {
  return (
    <section
      className={['glass-panel', className].filter(Boolean).join(' ')}
      style={{
        background: 'var(--color-card)',
        color: 'var(--color-card-foreground)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid var(--color-border)',
        padding: 20,
        ...style,
      }}
    >
      {title && (
        <h3
          style={{
            margin: '0 0 14px',
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--color-muted-foreground)',
          }}
        >
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}
