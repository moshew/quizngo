/** Small helpers shared by the theme files and the layout engine. */

export function fontsFor(theme, lang) {
  return theme.fonts[lang] || theme.fonts.default
}

export const gradient = (angle, ...stops) => ({
  kind: 'gradient',
  gradient: { angle, stops: stops.map(([color, at]) => ({ color, at })) },
  decor: true,
})
export const solid = (color) => ({ kind: 'color', color, decor: true })
export const image = (src, overlay = null, color = '#0b0b0b') => ({ kind: 'image', src, overlay, fit: 'cover', color, decor: true })
