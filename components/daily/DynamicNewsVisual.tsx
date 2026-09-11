// components/daily/DynamicNewsVisual.tsx — Gradient / pattern fallback when no feature image

import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import type { CityNewsCategory } from '../../types';

const PALETTES: Record<CityNewsCategory | 'spark', [string, string, string]> = {
  general: ['#1A1028', '#3D1F4A', '#FF5722'],
  alerts: ['#2A0A12', '#6B1020', '#FF1744'],
  event: ['#0A1A2A', '#1E3A5F', '#448AFF'],
  weather: ['#061820', '#0E3A4A', '#26C6DA'],
  rates: ['#14100A', '#3D2E12', '#FFA726'],
  spark: ['#1A0A14', '#4A1530', '#FF5722'],
};

type Props = {
  category: CityNewsCategory;
  title: string;
  badgeLabel: string;
  isVideo?: boolean;
};

/**
 * High-impact newspaper-style placeholder:
 * category gradient, pattern dots, badge, bold headline.
 */
export function DynamicNewsVisual({ category, title, badgeLabel, isVideo }: Props) {
  const [c0, c1, accent] = PALETTES[isVideo ? 'spark' : category] || PALETTES.general;

  return (
    <View style={[s.root, { backgroundColor: c0 }]}>
      <View style={[s.blob, { backgroundColor: c1, top: -20, right: -30 }]} />
      <View style={[s.blob, { backgroundColor: accent, opacity: 0.22, bottom: 40, left: -40, width: 140, height: 140 }]} />
      <View style={s.pattern}>
        {Array.from({ length: 18 }).map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              {
                left: ((i * 37) % 100) + '%',
                top: ((i * 53) % 90) + '%',
                opacity: 0.12 + (i % 3) * 0.06,
              } as object,
            ]}
          />
        ))}
      </View>
      <View style={[s.stripe, { backgroundColor: accent }]} />
      <View style={s.copy}>
        <View style={[s.badge, { borderColor: accent }]}>
          <Text style={[s.badgeText, { color: accent }]}>{badgeLabel}</Text>
        </View>
        <Text style={s.headline} numberOfLines={4}>{title}</Text>
        {isVideo ? <Text style={s.sparkTag}>▶ SPARK</Text> : null}
      </View>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  pattern: { ...StyleSheet.absoluteFillObject },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.white,
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  copy: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
    paddingBottom: 56,
    gap: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#00000066',
  },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  headline: {
    color: Colors.white,
    fontSize: 15,
    fontFamily: Fonts.displayXBold,
    fontWeight: '900',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  sparkTag: {
    color: Colors.orange,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
}));
