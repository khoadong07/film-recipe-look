import { useCallback, useRef } from 'react';

export interface DialProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  label?: string;
  formatValue?: (v: number) => string;
}

const TICK_COUNT = 48;
const START_ANGLE = -220; // degrees, matches a ~280° sweep like the reference dial
const SWEEP = 280;

function angleForValue(value: number, min: number, max: number): number {
  const t = (value - min) / (max - min);
  return START_ANGLE + t * SWEEP;
}

/** Circular rotary dial: drag around the rim, or focus + arrow keys. */
const defaultFormat = (v: number, max: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}${max <= 100 ? '%' : ''}`;

export function Dial({ value, min = 0, max = 100, onChange, label, formatValue }: DialProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max]);

  const valueFromPointer = useCallback(
    (clientX: number, clientY: number): number => {
      const svg = svgRef.current;
      if (!svg) return value;
      const rect = svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      // atan2 in degrees, 0 = pointing right, clockwise positive.
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      // Rotate so START_ANGLE lines up with the dial's physical gap at the
      // bottom (same convention as angleForValue above).
      deg = deg - START_ANGLE;
      deg = ((deg % 360) + 360) % 360;
      const t = Math.min(1, Math.max(0, deg / SWEEP));
      return clamp(min + t * (max - min));
    },
    [clamp, max, min, value],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      onChange(valueFromPointer(e.clientX, e.clientY));
    },
    [onChange, valueFromPointer],
  );

  const handlePointerUp = useCallback(() => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  }, [handlePointerMove]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      onChange(valueFromPointer(e.clientX, e.clientY));
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [handlePointerMove, handlePointerUp, onChange, valueFromPointer],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = (max - min) / 100 || 1;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        onChange(clamp(value + step));
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        onChange(clamp(value - step));
      }
    },
    [clamp, max, min, onChange, value],
  );

  const size = 180;
  const center = size / 2;
  const outerR = size / 2 - 10;
  const innerR = outerR - 10;
  const activeAngle = angleForValue(value, min, max);

  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const t = i / (TICK_COUNT - 1);
    const angle = START_ANGLE + t * SWEEP;
    const rad = (angle * Math.PI) / 180;
    const active = angle <= activeAngle;
    const x1 = center + innerR * Math.cos(rad);
    const y1 = center + innerR * Math.sin(rad);
    const x2 = center + outerR * Math.cos(rad);
    const y2 = center + outerR * Math.sin(rad);
    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={active ? 'var(--color-accent)' : 'var(--color-border)'}
        strokeWidth={active ? 2.5 : 1.5}
        strokeLinecap="round"
      />
    );
  });

  const displayValue = (formatValue ?? ((v: number) => defaultFormat(v, max)))(value);

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <svg
        ref={svgRef}
        width={size}
        height={size}
        role="slider"
        tabIndex={0}
        aria-label={label ?? 'Dial'}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        style={{ touchAction: 'none', outline: 'none' }}
      >
        {ticks}
        <circle
          cx={center}
          cy={center}
          r={innerR - 16}
          fill="var(--color-card)"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(15,23,42,0.08))' }}
        />
        <text
          x={center}
          y={center + 6}
          textAnchor="middle"
          fontSize={22}
          fontWeight={600}
          fontFamily="var(--font-heading)"
          fill="var(--color-foreground)"
        >
          {displayValue}
        </text>
      </svg>
      {label && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--color-muted-foreground)',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
