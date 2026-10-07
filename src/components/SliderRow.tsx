export interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  formatValue?: (v: number) => string;
  onChange: (v: number) => void;
}

const defaultFormat = (v: number) => (v > 0 ? `+${v}` : `${v}`);

/** Labeled horizontal slider row with a numeric value pill, e.g. "SAT  -3..3". */
export function SliderRow({ label, value, min, max, step = 1, formatValue = defaultFormat, onChange }: SliderRowProps) {
  return (
    <div className="slider-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
      <span
        style={{
          width: 64,
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--color-muted-foreground)',
        }}
      >
        {label}
      </span>
      <input
        type="range"
        className="slider-row__input"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        style={{
          flex: 1,
          // Per-instance fill percentage: set inline (scoped to this exact
          // element) rather than via a shared class selector, since every
          // SliderRow on the page uses the same `.slider-row__input` class —
          // a shared rule here would let the last-rendered row's percentage
          // win for every row's track fill.
          background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${((value - min) / (max - min)) * 100}%, var(--color-border) ${((value - min) / (max - min)) * 100}%, var(--color-border) 100%)`,
        }}
      />
      <span
        style={{
          minWidth: 40,
          textAlign: 'right',
          fontSize: 12,
          fontVariantNumeric: 'tabular-nums',
          background: 'var(--color-muted)',
          color: 'var(--color-foreground)',
          borderRadius: 999,
          padding: '3px 8px',
        }}
      >
        {formatValue(value)}
      </span>

      <style>{`
        .slider-row__input {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 999px;
        }
        .slider-row__input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--color-card);
          border: 2px solid var(--color-accent);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.2);
          cursor: pointer;
          transition: transform var(--transition-fast);
        }
        .slider-row__input::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        .slider-row__input::-moz-range-track {
          height: 4px;
          border-radius: 999px;
          background: var(--color-border);
        }
        .slider-row__input::-moz-range-progress {
          height: 4px;
          border-radius: 999px;
          background: var(--color-accent);
        }
        .slider-row__input::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--color-card);
          border: 2px solid var(--color-accent);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
