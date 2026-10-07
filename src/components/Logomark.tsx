export interface LogomarkProps {
  size?: number;
}

/** Brand mark — mirrors the Flutter app's `_Logomark` (gradient amber square
 * + camera icon) so the web and mobile apps read as the same product. */
export function Logomark({ size = 28 }: LogomarkProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size * 0.28,
        background: 'linear-gradient(135deg, var(--color-accent-soft, #fde68a) 0%, var(--color-accent) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(217, 119, 6, 0.35)',
      }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="#241602" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
        <circle cx="12" cy="13" r="3.2" />
      </svg>
    </div>
  );
}
