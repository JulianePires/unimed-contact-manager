// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const paletteCss = readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
const themeCss = readFileSync(new URL('index.css', import.meta.url), 'utf8');

type Oklch = [lightness: number, chroma: number, hue: number];
type Rgb = [number, number, number];

const palette = new Map<string, Oklch>();
for (const [, name, l, c, h] of paletteCss.matchAll(
  /--color-([a-z]+-\d+): oklch\(([\d.]+)% ([\d.]+) ([\d.]+|none)\)/g,
)) {
  palette.set(name ?? '', [Number(l) / 100, Number(c), h === 'none' ? 0 : Number(h)]);
}

const tokens = new Map<string, string>();
for (const [, token, color] of themeCss.matchAll(
  /--color-([a-z-]+): var\(--color-([a-z]+-\d+)\)/g,
)) {
  tokens.set(token ?? '', color ?? '');
}

/** oklch → sRGB linear (CSS Color 4), recortado ao gamut. */
function linearRgb(token: string): Rgb {
  const color = palette.get(tokens.get(token) ?? '');
  if (!color) throw new Error(`Token sem cor da paleta: ${token}`);
  const [lightness, chroma, hue] = color;
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [
    luminance(linearRgb(foreground)),
    luminance(linearRgb(background)),
  ].sort((x, y) => y - x);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

const SURFACES = ['background', 'surface', 'surface-raised'];

/** Texto (1.4.3): ≥ 4,5:1. */
const TEXT_PAIRS: [string, string][] = [
  ...['foreground', 'muted-foreground', 'accent', 'warning', 'danger'].flatMap((text) =>
    SURFACES.map((surface): [string, string] => [text, surface]),
  ),
  ['primary-foreground', 'primary'],
  ['primary-foreground', 'primary-hover'],
  ['danger-foreground', 'danger'],
  ['danger-foreground', 'danger-hover'],
  ['warning-foreground', 'warning'],
];

/** Contornos de controle e indicador de foco (1.4.11, 2.4.13): ≥ 3:1. */
const NON_TEXT_PAIRS: [string, string][] = ['input', 'ring', 'danger-border'].flatMap((token) =>
  SURFACES.map((surface): [string, string] => [token, surface]),
);

describe('tokens de cor (WCAG 2.2 AA)', () => {
  it('todos os tokens apontam para cores da paleta do Tailwind', () => {
    for (const token of tokens.keys()) expect(() => linearRgb(token)).not.toThrow();
  });

  it.each(TEXT_PAIRS)('texto %s sobre %s ≥ 4,5:1', (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT_PAIRS)('%s sobre %s ≥ 3:1', (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(3);
  });

  it('a conversão confere com valores de referência (branco sobre zinc-950 ≈ 19:1)', () => {
    palette.set('ref-white', [1, 0, 0]);
    tokens.set('ref-white', 'ref-white');
    expect(contrast('ref-white', 'background')).toBeCloseTo(19.8, 0);
  });
});
