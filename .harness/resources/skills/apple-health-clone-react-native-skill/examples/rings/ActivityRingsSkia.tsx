import React, { useMemo } from 'react';
import { View, Text, Pressable, AccessibilityInfo } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
} from '@shopify/react-native-skia';
import type { RingProgress } from '../data/healthModels';
import { getRingGeometry, ringAccessibilityLabel } from './ringMath';

type Props = {
  rings: RingProgress[];
  size?: number;
  strokeWidth?: number;
  gap?: number;
  colors: Record<string, string>;
  trackColor?: string;
  onRingPress?: (ring: RingProgress) => void;
};

function arcPath(cx: number, cy: number, radius: number, start: number, end: number) {
  const path = Skia.Path.Make();
  // Skia arc API uses degrees and bounding rect.
  const left = cx - radius;
  const top = cy - radius;
  const right = cx + radius;
  const bottom = cy + radius;
  const startDeg = (start * 180) / Math.PI;
  const sweepDeg = ((end - start) * 180) / Math.PI;
  path.addArc({ x: left, y: top, width: right - left, height: bottom - top }, startDeg, sweepDeg);
  return path;
}

export function ActivityRingsSkia({
  rings,
  size = 220,
  strokeWidth = 18,
  gap = 6,
  colors,
  trackColor = 'rgba(142,142,147,0.22)',
  onRingPress,
}: Props) {
  const center = size / 2;
  const sorted = useMemo(() => [...rings].sort((a, b) => a.ringId.localeCompare(b.ringId)), [rings]);

  const accessibilityLabel = sorted
    .map((ring) => ringAccessibilityLabel(ring.label, ring.value, ring.goal, ring.unit))
    .join('. ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => sorted[0] && onRingPress?.(sorted[0])}
      style={{ width: size, height: size }}
    >
      <Canvas style={{ width: size, height: size }}>
        <Group>
          {sorted.map((ring, index) => {
            const radius = center - strokeWidth / 2 - index * (strokeWidth + gap);
            const geometry = getRingGeometry({ progress: ring.progress });
            const activePath = arcPath(center, center, radius, geometry.startAngle, geometry.endAngle);
            const color = colors[ring.colorToken] ?? ring.colorToken;

            return (
              <React.Fragment key={ring.ringId}>
                <Circle
                  cx={center}
                  cy={center}
                  r={radius}
                  color={trackColor}
                  style="stroke"
                  strokeWidth={strokeWidth}
                />
                <Path
                  path={activePath}
                  color={color}
                  style="stroke"
                  strokeWidth={strokeWidth}
                  strokeCap="round"
                />
              </React.Fragment>
            );
          })}
        </Group>
      </Canvas>
    </Pressable>
  );
}

// Production upgrades to add:
// - Reanimated shared values for progress interpolation.
// - SweepGradient for each arc.
// - Overflow lap treatment above 100%.
// - Reduced Motion fallback.
// - Dedicated center labels and ring hit-testing.
// - Snapshot tests for ring math and visual regression tests for common states.
