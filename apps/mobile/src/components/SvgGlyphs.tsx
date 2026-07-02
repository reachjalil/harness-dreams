import Svg, { Path } from "react-native-svg";

export function CheckmarkIcon({
  color = "#34c759",
  size = 18,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path
        d="M20 6 9 17l-5-5"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.4}
      />
    </Svg>
  );
}

export function ChevronDownIcon({
  color = "#7b8794",
  expanded = false,
  size = 18,
}: {
  color?: string;
  expanded?: boolean;
  size?: number;
}) {
  return (
    <Svg
      height={size}
      style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
      viewBox="0 0 24 24"
      width={size}
    >
      <Path
        d="m6 9 6 6 6-6"
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.2}
      />
    </Svg>
  );
}
