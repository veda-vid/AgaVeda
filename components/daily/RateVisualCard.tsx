// components/daily/RateVisualCard.tsx — Stylized metallic rate / mandi tile backgrounds

import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { unicodeContentStyle } from './dailyShared';
import type { DailyWidgetMeta } from '../../types';

const GRADIENTS: Record<string, readonly [string, string, string]> = {
  gold: ['#78350F', '#F59E0B', '#FDE68A'],
  silver: ['#1E293B', '#94A3B8', '#F8FAFC'],
  fuel: ['#0F172A', '#14532D', '#22C55E'],
  mandi: ['#14532D', '#166534', '#86EFAC'],
  fx: ['#1E1B4B', '#4338CA', '#A5B4FC'],
  index: ['#0F172A', '#1E3A8A', '#60A5FA'],
};

const SHIMMER: Record<string, readonly [string, string, string, string]> = {
  gold: ['#FDE68A', '#F59E0B', '#B45309', '#FDE68A'],
  silver: ['#F8FAFC', '#CBD5E1', '#64748B', '#F8FAFC'],
};

type Props = {
  widget: DailyWidgetMeta;
  compact?: boolean;
};

export function RateVisualCard({ widget, compact }: Props) {
  const kind = widget.kind || 'index';
  const colors = GRADIENTS[kind] || GRADIENTS.index;
  const shimmer = SHIMMER[kind];
  const headline = widget.value || widget.items?.[0]?.price || '—';
  const sub = widget.unit || widget.label || 'Market Rate';
  const change = widget.changePct;
  const changeText = change != null
    ? `${change >= 0 ? '▲' : '▼'} ${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
    : widget.cadence === 'weekly' ? 'WEEKLY' : 'LIVE SPOT';

  const inner = (
    <LinearGradient colors={[...colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.root}>
      <View style={s.shine} />
      <Text style={s.kindLabel}>{widget.label || 'Rates'}</Text>
      <Text style={[s.price, compact && s.priceSm]}>{headline}</Text>
      <Text style={[s.sub, unicodeContentStyle]} numberOfLines={1}>{sub}</Text>
      <View style={[s.badge, change != null && change < 0 && s.badgeDown]}>
        <Text style={s.badgeText}>{changeText}</Text>
      </View>
      {widget.items && widget.items.length > 1 ? (
        <View style={s.previewRows}>
          {widget.items.slice(0, compact ? 2 : 3).filter(r => r.name !== 'Day change').map(row => (
            <View key={row.name} style={s.previewRow}>
              <Text style={[s.previewName, unicodeContentStyle]} numberOfLines={1}>{row.name}</Text>
              <Text style={s.previewPrice}>{row.price}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </LinearGradient>
  );

  if (shimmer) {
    return (
      <LinearGradient colors={[...shimmer]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.shimmerWrap}>
        <View style={s.shimmerInner}>{inner}</View>
      </LinearGradient>
    );
  }

  return inner;
}

const s = createDynamicStyles((Colors) => ({
  shimmerWrap: {
    ...StyleSheet.absoluteFillObject,
    padding: 1.5,
  },
  shimmerInner: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  root: {
    ...StyleSheet.absoluteFillObject,
    padding: 12,
    justifyContent: 'flex-end',
  },
  shine: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  kindLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  price: {
    color: Colors.white,
    fontSize: 26,
    fontFamily: Fonts.displayXBold,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  priceSm: { fontSize: 20 },
  sub: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.55)',
  },
  badgeDown: { borderColor: 'rgba(239,68,68,0.55)' },
  badgeText: { color: Colors.white, fontSize: 11, fontWeight: '900' },
  previewRows: { marginTop: 10, gap: 4, paddingBottom: 36 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  previewName: { color: 'rgba(255,255,255,0.82)', fontSize: 10, flex: 1, fontWeight: '600' },
  previewPrice: { color: Colors.white, fontSize: 10, fontWeight: '800' },
}));
