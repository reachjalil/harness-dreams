import React from 'react';

export interface RingInput {
  id: string;
  label: string;
  value: number;
  goal: number;
  unit: string;
  color: string;
}

function describeRing(ring: RingInput) {
  const ratio = ring.goal > 0 ? ring.value / ring.goal : 0;
  const percent = Math.round(ratio * 100);
  return `${ring.label}: ${ring.value} of ${ring.goal} ${ring.unit}, ${percent} percent of goal.`;
}

export function ActivityRingsSvg({ rings, size = 168, stroke = 14 }: { rings: RingInput[]; size?: number; stroke?: number }) {
  const center = size / 2;
  const gap = stroke + 4;
  const titleId = React.useId();
  const descId = React.useId();
  const description = rings.map(describeRing).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-labelledby={`${titleId} ${descId}`}>
      <title id={titleId}>Goal progress rings</title>
      <desc id={descId}>{description}</desc>
      {rings.map((ring, index) => {
        const radius = center - stroke / 2 - index * gap;
        const circumference = 2 * Math.PI * radius;
        const ratio = ring.goal > 0 ? Math.max(0, ring.value / ring.goal) : 0;
        const visibleRatio = Math.min(ratio, 1);
        const dash = visibleRatio * circumference;
        const overflow = Math.max(0, ratio - 1);
        return (
          <g key={ring.id} transform={`rotate(-90 ${center} ${center})`}>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.14}
              strokeWidth={stroke}
            />
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={ring.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference - dash}`}
            />
            {overflow > 0 ? (
              <circle
                cx={center}
                cy={center}
                r={radius - stroke * 0.34}
                fill="none"
                stroke={ring.color}
                strokeWidth={Math.max(3, stroke * 0.22)}
                strokeLinecap="round"
                strokeDasharray={`${Math.min(overflow, 1) * circumference} ${circumference}`}
                opacity={0.72}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
