// components/seller/SellerHeaderHero.tsx — Merchant Command Center

import { useEffect } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors, Fonts, Radius, Shadow, createDynamicStyles } from '../../constants/theme';
import type { SellerCommandMetrics } from '../../services/sellerApi';
import { SpringPressable } from '../ui/modernSurfaces';

type SellerHeaderHeroProps = {
  metrics: SellerCommandMetrics | null;
  loading?: boolean;
  unreadEnquiries: number;
  onFlashDeal: () => void;
  onAddProduct: () => void;
  onPostSpark: () => void;
  onViewEnquiries: () => void;
};

function formatCount(value: number) {
  if (value >= 100000) return `${(value / 1000).toFixed(0)}k`;
  if (value >= 10000) return `${(value / 1000).toFixed(1)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function formatTrend(pct: number) {
  if (pct === 0) return { label: '— 0% vs yesterday', up: false, flat: true };
  const up = pct > 0;
  return {
    label: `${up ? '▲' : '▼'} ${up ? '+' : ''}${pct.toFixed(1)}% vs yesterday`,
    up,
    flat: false,
  };
}

function MiniSparkline({ samples, color }: { samples: number[]; color: string }) {
  return (
    <View style={sparkStyles.row} pointerEvents="none">
      {samples.map((v, i) => (
        <View
          key={i}
          style={[
            sparkStyles.bar,
            {
              height: 4 + v * 18,
              backgroundColor: color,
              opacity: 0.25 + v * 0.55,
            },
          ]}
        />
      ))}
    </View>
  );
}

const sparkStyles = StyleSheet.create({
  row: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    left: 6,
    height: 22,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    opacity: 0.9,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 3,
  },
});

export function SellerHeaderHero({
  metrics,
  loading,
  unreadEnquiries,
  onFlashDeal,
  onAddProduct,
  onPostSpark,
  onViewEnquiries,
}: SellerHeaderHeroProps) {
  const leads = metrics?.new_leads ?? unreadEnquiries ?? 0;
  const hasLeads = leads > 0;

  return (
    <View style={s.root}>
      <View style={s.titleRow}>
        <Text style={s.title}>Merchant Command Center</Text>
        <Text style={s.subtitle}>Hyper-local performance and publish tools</Text>
      </View>

      <View style={s.metricsBar}>
        <MetricTile
          label="Daily Views"
          value={loading ? '—' : formatCount(metrics?.daily_views ?? 0)}
          trend={formatTrend(metrics?.views_trend_pct ?? 0)}
          sparkline={metrics?.views_sparkline ?? []}
          loading={loading}
          accent={Colors.orange}
        />
        <MetricTile
          label="Product Saves"
          value={loading ? '—' : formatCount(metrics?.product_saves ?? 0)}
          trend={formatTrend(metrics?.saves_trend_pct ?? 0)}
          sparkline={metrics?.saves_sparkline ?? []}
          loading={loading}
          accent="#3B82F6"
        />
        <MetricTile
          label="New Leads"
          value={loading ? '—' : formatCount(leads)}
          trend={formatTrend(metrics?.leads_trend_pct ?? 0)}
          sparkline={metrics?.leads_sparkline ?? []}
          loading={loading}
          accent={Colors.green}
          highlight={hasLeads}
          pulse={hasLeads}
          onPress={hasLeads ? onViewEnquiries : undefined}
        />
      </View>

      <View style={s.actionsRow}>
        <GradientAction
          emoji="⚡"
          title="Flash Deal Story"
          subtitle="24h offer bubble"
          colors={['#FF6B2C', '#FF3D00']}
          onPress={onFlashDeal}
        />
        <GradientAction
          emoji="📦"
          title="Add Product Catalog"
          subtitle="New listing"
          colors={['#1E293B', '#334155']}
          onPress={onAddProduct}
        />
        <GradientAction
          emoji="🎬"
          title="Create Moments"
          subtitle="Short video"
          colors={['#7C3AED', '#DB2777']}
          onPress={onPostSpark}
        />
      </View>

      {hasLeads ? (
        <SpringPressable style={s.leadBanner} pressedScale={0.98} onPress={onViewEnquiries}>
          <Text style={s.leadBannerText}>
            You have {leads} new customer enquir{leads === 1 ? 'y' : 'ies'} waiting
          </Text>
          <Text style={s.leadBannerCta}>Open →</Text>
        </SpringPressable>
      ) : null}
    </View>
  );
}

function MetricTile({
  label,
  value,
  trend,
  sparkline,
  loading,
  highlight,
  pulse,
  accent,
  onPress,
}: {
  label: string;
  value: string;
  trend: { label: string; up: boolean; flat: boolean };
  sparkline: number[];
  loading?: boolean;
  highlight?: boolean;
  pulse?: boolean;
  accent: string;
  onPress?: () => void;
}) {
  const glow = useSharedValue(1);

  useEffect(() => {
    if (!pulse) {
      glow.value = 1;
      return;
    }
    glow.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse, glow]);

  // Opacity-only worklet — avoid dynamic borderColor strings / undefined (Reanimated crash on Android).
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  const body = (
    <Animated.View style={[s.metricTile, highlight && s.metricTileHighlight, pulse ? pulseStyle : null]}>
      {sparkline.length > 0 ? <MiniSparkline samples={sparkline} color={accent} /> : null}
      {loading ? <ActivityIndicator size="small" color={Colors.orange} /> : null}
      <Text style={[s.metricValue, highlight && s.metricValueHighlight]}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
      <Text
        style={[
          s.trend,
          trend.flat ? s.trendFlat : trend.up ? s.trendUp : s.trendDown,
        ]}
        numberOfLines={1}
      >
        {trend.label}
      </Text>
    </Animated.View>
  );

  if (onPress) {
    return (
      <SpringPressable style={{ flex: 1 }} pressedScale={0.97} onPress={onPress}>
        {body}
      </SpringPressable>
    );
  }
  return <View style={{ flex: 1 }}>{body}</View>;
}

function GradientAction({
  emoji,
  title,
  subtitle,
  colors,
  onPress,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  colors: [string, string];
  onPress: () => void;
}) {
  return (
    <SpringPressable
      style={s.actionPress}
      contentStyle={{ flex: 1 }}
      pressedScale={0.94}
      onPress={onPress}
      accessibilityRole="button"
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.actionGrad}
      >
        <Text style={s.actionEmoji}>{emoji}</Text>
        <Text style={s.actionTitle} numberOfLines={2}>{title}</Text>
        <Text style={s.actionSub} numberOfLines={1}>{subtitle}</Text>
      </LinearGradient>
    </SpringPressable>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    ...Shadow.md,
  },
  titleRow: { marginBottom: 12 },
  title: {
    fontSize: 17,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.sub,
  },
  metricsBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metricTile: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 28,
    paddingHorizontal: 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 92,
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  metricTileHighlight: {
    borderColor: Colors.orange,
    backgroundColor: Colors.orange + '14',
    ...Platform.select({
      ios: {
        shadowColor: Colors.orange,
        shadowOpacity: 0.45,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  metricValue: {
    fontSize: 18,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: Colors.text,
  },
  metricValueHighlight: { color: Colors.orange },
  metricLabel: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '600',
    color: Colors.dim,
    textAlign: 'center',
  },
  trend: {
    marginTop: 4,
    fontSize: 9,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  trendUp: { color: Colors.green },
  trendDown: { color: Colors.red },
  trendFlat: { color: Colors.dim },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionPress: { flex: 1 },
  actionGrad: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: Radius.md,
    minHeight: 96,
    justifyContent: 'center',
  },
  actionEmoji: { fontSize: 22, marginBottom: 6 },
  actionTitle: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.white,
    textAlign: 'center',
    lineHeight: 14,
  },
  actionSub: {
    marginTop: 4,
    fontSize: 9,
    fontFamily: Fonts.bodySemiBold,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
  },
  leadBanner: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: Radius.md,
    backgroundColor: Colors.orange + '18',
    borderWidth: 1,
    borderColor: Colors.orange + '55',
  },
  leadBannerText: {
    flex: 1,
    color: Colors.orange,
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
  },
  leadBannerCta: {
    color: Colors.orange,
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
}));
