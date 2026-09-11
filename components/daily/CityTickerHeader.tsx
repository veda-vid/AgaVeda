// components/daily/CityTickerHeader.tsx — Sticky City Veda pulse (Discover-style cards)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, Animated, Easing, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import type { TickerChip } from '../../services/dailyApi';
import { formatCityDisplay } from './dailyShared';

type Props = {
  city: string;
  chips: TickerChip[];
  loading?: boolean;
  onPressCity?: () => void;
};

function aqiTone(aqi?: number | null) {
  if (aqi == null) return { dot: Colors.dim, text: Colors.sub };
  if (aqi <= 50) return { dot: '#22C55E', text: '#15803D' };
  if (aqi <= 100) return { dot: '#EAB308', text: '#A16207' };
  if (aqi <= 150) return { dot: '#F97316', text: '#C2410C' };
  return { dot: '#EF4444', text: '#B91C1C' };
}

function TrendBadge({ chip }: { chip: TickerChip }) {
  if (chip.changePct == null) return null;
  const up = chip.trend === 'up';
  const down = chip.trend === 'down';
  const arrow = up ? '▲' : down ? '▼' : '•';
  const pct = `${chip.changePct >= 0 ? '+' : ''}${chip.changePct.toFixed(1)}%`;
  return (
    <View style={[s.trend, up && s.trendUp, down && s.trendDown]}>
      <Text style={[s.trendText, up && s.trendTextUp, down && s.trendTextDown]}>
        {arrow} {pct}
      </Text>
    </View>
  );
}

/** Google Discover–style weather / rate pulse card. */
function ChipCard({ chip }: { chip: TickerChip }) {
  if (chip.kind === 'weather') {
    const tone = aqiTone(chip.aqi);
    return (
      <View style={s.chip}>
        <Text style={s.areaName} numberOfLines={1}>
          {chip.areaName || chip.label}
        </Text>
        <View style={s.weatherBody}>
          <View style={s.tempRow}>
            <Text style={s.tempValue}>{chip.value}</Text>
            <Text style={s.weatherEmoji}>{chip.emoji}</Text>
          </View>
          <View style={s.weatherStats}>
            {chip.rainPct != null ? (
              <View style={s.statRow}>
                <Text style={s.statIcon}>🌧️</Text>
                <Text style={s.statText}>{Math.round(chip.rainPct)}%</Text>
              </View>
            ) : null}
            {chip.aqi != null ? (
              <View style={s.statRow}>
                <View style={[s.aqiDot, { backgroundColor: tone.dot }]} />
                <Text style={[s.statText, { color: tone.text }]}>{Math.round(chip.aqi)} AQI</Text>
              </View>
            ) : (
              <View style={s.statRow}>
                <Text style={s.statIcon}>📍</Text>
                <Text style={s.statText}>Live</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={s.chip}>
      <Text style={s.areaName} numberOfLines={1}>{chip.label}</Text>
      <View style={s.rateBody}>
        <Text style={s.rateEmoji}>{chip.emoji}</Text>
        <View style={s.rateCopy}>
          <Text style={s.chipValue} numberOfLines={1}>{chip.value}</Text>
          <TrendBadge chip={chip} />
        </View>
      </View>
    </View>
  );
}

/**
 * Safe-area sticky header with Discover-style pulse cards.
 * Marquee pauses while the user holds a card to read details.
 */
export function CityTickerHeader({ city, chips, loading, onPressCity }: Props) {
  const insets = useSafeAreaInsets();
  const scrollX = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const [paused, setPaused] = useState(false);
  const offsetRef = useRef(0);

  const doubled = useMemo(() => (chips.length ? [...chips, ...chips] : []), [chips]);
  const trackWidth = Math.max(1, chips.length * 178);

  useEffect(() => {
    const id = scrollX.addListener(({ value }) => {
      offsetRef.current = value;
    });
    return () => scrollX.removeListener(id);
  }, [scrollX]);

  const stopLoop = useCallback(() => {
    loopRef.current?.stop();
    loopRef.current = null;
  }, []);

  const startLoop = useCallback(() => {
    if (chips.length < 2 || Platform.OS === 'web') return;
    stopLoop();
    let from = offsetRef.current;
    while (from < -trackWidth) from += trackWidth;
    while (from > 0) from -= trackWidth;
    scrollX.setValue(from);
    offsetRef.current = from;

    const fullDuration = Math.max(18000, chips.length * 3800);
    const distance = trackWidth + from; // how far until -trackWidth
    const firstMs = Math.max(1200, (Math.max(distance, 1) / trackWidth) * fullDuration);

    const run = () => {
      stopLoop();
      let cur = offsetRef.current;
      while (cur < -trackWidth) cur += trackWidth;
      while (cur > 0) cur -= trackWidth;
      scrollX.setValue(cur);
      const leg = Animated.timing(scrollX, {
        toValue: -trackWidth,
        duration: Math.max(1200, ((trackWidth + cur) / trackWidth) * fullDuration),
        easing: Easing.linear,
        useNativeDriver: true,
      });
      loopRef.current = leg;
      leg.start(({ finished }) => {
        if (!finished) return;
        scrollX.setValue(0);
        offsetRef.current = 0;
        run();
      });
    };

    // First leg from current offset
    const first = Animated.timing(scrollX, {
      toValue: -trackWidth,
      duration: firstMs,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    loopRef.current = first;
    first.start(({ finished }) => {
      if (!finished) return;
      scrollX.setValue(0);
      offsetRef.current = 0;
      run();
    });
  }, [chips.length, scrollX, stopLoop, trackWidth]);

  // Chip set changed — restart from the beginning.
  useEffect(() => {
    stopLoop();
    scrollX.setValue(0);
    offsetRef.current = 0;
    if (chips.length < 2 || Platform.OS === 'web') return undefined;
    if (!paused) startLoop();
    return () => stopLoop();
    // intentionally omit paused — handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chips, scrollX, startLoop, stopLoop]);

  // Hold-to-pause / release-to-resume without jumping.
  useEffect(() => {
    if (Platform.OS === 'web' || chips.length < 2) return;
    if (paused) {
      stopLoop();
      return;
    }
    startLoop();
  }, [paused, chips.length, startLoop, stopLoop]);

  const holdPause = () => setPaused(true);
  const holdResume = () => setPaused(false);

  return (
    <View style={[s.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={s.titleRow}>
        <View style={s.brandBlock}>
          <Text style={s.kicker}>CITY VEDA</Text>
          <Text style={s.title}>Daily pulse</Text>
        </View>
        <Pressable onPress={onPressCity} style={s.cityBtn} hitSlop={8}>
          <Text style={s.cityPin}>📍</Text>
          <Text style={s.cityName} numberOfLines={1}>
            {formatCityDisplay(city) || 'Your city'}
          </Text>
          <Text style={s.cityCaret}>▾</Text>
        </Pressable>
      </View>

      {loading && !chips.length ? (
        <View style={s.skeletonRow}>
          {[0, 1, 2].map(i => <View key={i} style={s.skeletonChip} />)}
        </View>
      ) : Platform.OS === 'web' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.rail}
        >
          {chips.map(chip => (
            <View key={chip.id} style={s.pressChip}>
              <ChipCard chip={chip} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <Pressable
          onPressIn={holdPause}
          onPressOut={holdResume}
          delayLongPress={80}
          onLongPress={holdPause}
          style={s.marqueeClip}
        >
          <Animated.View
            style={[s.marqueeTrack, { transform: [{ translateX: scrollX }] }]}
            pointerEvents="box-none"
          >
            {doubled.map((chip, idx) => (
              <View key={`${chip.id}-${idx}`} style={s.pressChip}>
                <ChipCard chip={chip} />
              </View>
            ))}
          </Animated.View>
        </Pressable>
      )}
      <Text style={s.hint}>
        {paused ? 'Paused — release to keep scrolling' : 'Hold to pause · Weather from your GPS area'}
      </Text>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  wrap: {
    backgroundColor: Colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  brandBlock: { flexShrink: 1 },
  kicker: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: Colors.orange,
  },
  title: {
    marginTop: 2,
    fontSize: 22,
    fontFamily: Fonts.displayXBold,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  cityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '48%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  cityPin: { fontSize: 12 },
  cityName: {
    flexShrink: 1,
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
  },
  cityCaret: { fontSize: 11, color: Colors.dim },
  marqueeClip: {
    overflow: 'hidden',
    height: 88,
  },
  marqueeTrack: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingLeft: 16,
    gap: 10,
  },
  rail: {
    paddingHorizontal: 16,
    gap: 10,
    alignItems: 'stretch',
  },
  pressChip: {
    width: 168,
  },
  chip: {
    width: 168,
    minHeight: 78,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  areaName: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '600',
    color: Colors.sub,
    marginBottom: 6,
  },
  weatherBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  tempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  tempValue: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.8,
  },
  weatherEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  weatherStats: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statIcon: { fontSize: 11 },
  statText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.sub,
  },
  aqiDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  rateBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  rateEmoji: { fontSize: 18 },
  rateCopy: { flex: 1, minWidth: 0, gap: 4 },
  chipValue: {
    fontSize: 15,
    color: Colors.text,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
  trend: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  trendUp: { backgroundColor: 'rgba(0,200,83,0.14)' },
  trendDown: { backgroundColor: 'rgba(255,23,68,0.14)' },
  trendText: { fontSize: 10, fontWeight: '800', color: Colors.dim },
  trendTextUp: { color: Colors.green },
  trendTextDown: { color: Colors.red },
  hint: {
    marginTop: 8,
    paddingHorizontal: 16,
    fontSize: 11,
    color: Colors.dim,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
  },
  skeletonChip: {
    width: 168,
    height: 78,
    borderRadius: 18,
    backgroundColor: Colors.card,
  },
}));
