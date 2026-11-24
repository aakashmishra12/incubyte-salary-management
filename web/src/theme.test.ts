import { describe, expect, it } from 'vitest';
import { theme, tokens } from './theme.ts';

/** WCAG contrast ratio between two colours written as #rrggbb. */
function contrast(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
      number,
      number,
      number,
    ];
    const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  ) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

const BACKGROUNDS = {
  'white panels': tokens.canvas,
  'the page': tokens.canvasSoft,
  'inset areas': tokens.canvasSoft2,
};

describe('theme: text can be read (WCAG AA needs 4.5 to 1 for small text)', () => {
  const texts = {
    'main text': tokens.ink,
    'secondary text': tokens.body,
    'muted text, as in table headings': tokens.muted,
    'links and the Above badge': tokens.link,
    'error text': tokens.errorText,
    'warning text': tokens.warningText,
  };

  for (const [textName, color] of Object.entries(texts)) {
    for (const [backgroundName, background] of Object.entries(BACKGROUNDS)) {
      it(`${textName} on ${backgroundName}`, () => {
        expect(contrast(color, background)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('theme: the edges of controls can be seen (WCAG needs 3 to 1)', () => {
  it('the border of an input against a white panel', () => {
    expect(contrast(tokens.inputBorder, tokens.canvas)).toBeGreaterThanOrEqual(3);
  });

  it('the keyboard focus ring against white', () => {
    expect(contrast(tokens.ink, tokens.canvas)).toBeGreaterThanOrEqual(3);
  });
});

describe('theme: the components really use those colours', () => {
  /** Reads a value from inside the theme by its path, so the test does not depend on MUI's types. */
  const inTheme = (...path: string[]) =>
    path.reduce<unknown>(
      (value, key) => (value as Record<string, unknown> | undefined)?.[key],
      theme.components,
    );

  it('uses them for the palette', () => {
    expect(theme.palette.info.main).toBe(tokens.link);
    expect(theme.palette.error.main).toBe(tokens.errorText);
    expect(theme.palette.text.secondary).toBe(tokens.body);
  });

  it('uses the stronger border for inputs', () => {
    expect(
      inTheme(
        'MuiOutlinedInput',
        'styleOverrides',
        'root',
        '& .MuiOutlinedInput-notchedOutline',
        'borderColor',
      ),
    ).toBe(tokens.inputBorder);
  });

  it('uses the readable muted colour for table headings', () => {
    expect(inTheme('MuiTableCell', 'styleOverrides', 'head', 'color')).toBe(tokens.muted);
  });

  it('shows a clear ring around whatever has keyboard focus', () => {
    expect(inTheme('MuiCssBaseline', 'styleOverrides', ':focus-visible', 'outline')).toBe(
      `2px solid ${tokens.ink}`,
    );
  });

  it('stops animations for people who ask their system to reduce motion', () => {
    expect(
      inTheme('MuiCssBaseline', 'styleOverrides', '@media (prefers-reduced-motion: reduce)'),
    ).toBeDefined();
  });

  it('sizes text in rem, so the browser font size setting is respected', () => {
    for (const style of [
      theme.typography.h5,
      theme.typography.body1,
      theme.typography.body2,
      theme.typography.caption,
    ]) {
      expect(String(style.fontSize)).toMatch(/rem$/);
    }
  });
});
