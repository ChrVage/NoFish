import type React from 'react';

const sunPhaseColors: Record<string, [number, number, number]> = {
  day:       [255, 255, 255],
  civil:     [190, 195, 210],
  nautical:  [30,  50,  90],
  night:     [0,   0,   0],
};

export function getTimeColumnStyle(
  segments: { phase: string; fraction: number }[] | undefined,
): React.CSSProperties {
  if (!segments || segments.length === 0) {return {};}

  let r = 0, g = 0, b = 0;
  for (const seg of segments) {
    const c = sunPhaseColors[seg.phase] ?? [128, 128, 128];
    r += c[0] * seg.fraction;
    g += c[1] * seg.fraction;
    b += c[2] * seg.fraction;
  }
  r = Math.round(r);
  g = Math.round(g);
  b = Math.round(b);

  const luminance = r * 0.299 + g * 0.587 + b * 0.114;
  const textColor = luminance < 140 ? '#ffffff' : '#111827';

  return { backgroundColor: `rgb(${r}, ${g}, ${b})`, color: textColor };
}
