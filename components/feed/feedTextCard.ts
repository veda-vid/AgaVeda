export const TEXT_CARD_BACKGROUNDS = [
  { id: 'sunset', color: '#E94F37' },
  { id: 'berry', color: '#7B2CBF' },
  { id: 'ocean', color: '#146C94' },
  { id: 'midnight', color: '#172554' },
  { id: 'forest', color: '#146B55' },
  { id: 'rose', color: '#BE185D' },
  { id: 'amber', color: '#C2410C' },
  { id: 'slate', color: '#334155' },
] as const;

export const TEXT_CARD_COLORS = [
  { id: 'white', color: '#FFFFFF' },
  { id: 'ink', color: '#111827' },
  { id: 'sun', color: '#FDE047' },
  { id: 'mint', color: '#A7F3D0' },
  { id: 'blush', color: '#FBCFE8' },
] as const;

export const TEXT_FONT_STYLES = {
  classic: { fontSize: 24, fontWeight: '600' as const },
  bold: { fontSize: 28, fontWeight: '900' as const },
  elegant: { fontSize: 26, fontFamily: 'serif', fontStyle: 'italic' as const },
  typewriter: { fontSize: 22, fontFamily: 'monospace', fontWeight: '700' as const },
};

export function getTextBackground(id?: string) {
  return TEXT_CARD_BACKGROUNDS.find(o => o.id === id)?.color ?? TEXT_CARD_BACKGROUNDS[0].color;
}

export function getTextColor(id?: string) {
  return TEXT_CARD_COLORS.find(o => o.id === id)?.color ?? TEXT_CARD_COLORS[0].color;
}

export function getTextFontStyle(id?: string) {
  if (id && id in TEXT_FONT_STYLES) return TEXT_FONT_STYLES[id as keyof typeof TEXT_FONT_STYLES];
  return id === 'headline' ? TEXT_FONT_STYLES.bold : TEXT_FONT_STYLES.classic;
}
