import { useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';
import { getMarketTickerSnapshot, type MarketRateItem } from '../../lib/marketRates';

type MarketTickerProps = {
  city?: string;
};

function RateChip({ item }: { item: MarketRateItem }) {
  const up = item.changePct > 0;
  const down = item.changePct < 0;
  const changeColor = up ? Colors.green : down ? Colors.red : Colors.dim;
  const arrow = up ? '▲' : down ? '▼' : '—';
  const changeLabel = item.changePct === 0 ? '0.00%' : `${Math.abs(item.changePct).toFixed(2)}%`;

  return (
    <View style={s.chip}>
      <Text style={s.chipLabel}>{item.label}</Text>
      <Text style={s.chipValue}>{item.value}</Text>
      <Text style={[s.chipChange, { color: changeColor }]}>
        {arrow} {changeLabel}
      </Text>
    </View>
  );
}

export function MarketTicker({ city }: MarketTickerProps) {
  const snapshot = useMemo(() => getMarketTickerSnapshot(city), [city]);
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);

  const loopItems = useMemo(
    () => [...snapshot.items, ...snapshot.items],
    [snapshot.items],
  );

  useEffect(() => {
    const id = setInterval(() => {
      offsetRef.current += 1.2;
      scrollRef.current?.scrollTo({ x: offsetRef.current, animated: false });
      if (offsetRef.current > 1400) offsetRef.current = 0;
    }, 28);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={s.wrap} accessibilityRole="summary" accessibilityLabel="Daily market rates">
      <View style={s.badge}>
        <Text style={s.badgeText}>LIVE</Text>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={s.row}
      >
        {loopItems.map((item, index) => (
          <RateChip key={`${item.id}-${index}`} item={item} />
        ))}
      </ScrollView>
      <Text style={s.cityTag}>{snapshot.city} · {snapshot.updatedLabel}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingVertical: 8,
  },
  badge: {
    position: 'absolute',
    left: 12,
    top: 10,
    zIndex: 2,
    backgroundColor: Colors.orange,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 9,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  row: {
    paddingLeft: 56,
    paddingRight: 16,
    alignItems: 'center',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    marginRight: 10,
  },
  chipLabel: {
    color: Colors.sub,
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '600',
  },
  chipValue: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
  chipChange: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
  },
  cityTag: {
    color: Colors.dim,
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
});
