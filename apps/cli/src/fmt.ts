const esc = (code: string) => `\x1b[${code}m`;

export const reset = esc("0");
export const bold = (s: string) => `${esc("1")}${s}${reset}`;
export const dim = (s: string) => `${esc("2")}${s}${reset}`;
export const cyan = (s: string) => `${esc("36")}${s}${reset}`;
export const green = (s: string) => `${esc("32")}${s}${reset}`;
export const yellow = (s: string) => `${esc("33")}${s}${reset}`;
export const red = (s: string) => `${esc("31")}${s}${reset}`;
export const magenta = (s: string) => `${esc("35")}${s}${reset}`;

export function hr(char = "─", width = 60): string {
  return dim(char.repeat(width));
}

export function badge(label: string, color: (s: string) => string): string {
  return color(`[${label}]`);
}
