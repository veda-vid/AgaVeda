import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors, Fonts, Radius, Shadow } from '../../constants/theme';
import type { SellerDashboardMetrics } from '../../types';

type SellerHeaderHeroProps = {
  metrics: SellerDashboardMetrics | null;
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

export function SellerHeaderHero({
  metrics,
  loading,
  unreadEnquiries,
  onFlashDeal,
  onAddProduct,
  onPostSpark,
  onViewEnquiries,
}: SellerHeaderHeroProps) {
  return (
    <View style={s.root}>
      <View style={s.titleRow}>
        <Text style={s.title}>Merchant Command Center</Text>
        <Text style={s.subtitle}>Track performance and publish in one place</Text>
      </View>

      <View style={s.metricsBar}>
        <MetricTile
          label="Daily Views"
          value={loading ? '—' : formatCount(metrics?.daily_views ?? 0)}
          loading={loading}
        />
        <MetricTile
          label="Product Saves"
          value={loading ? '—' : formatCount(metrics?.product_saves ?? 0)}
          loading={loading}
        />
        <MetricTile
          label="New Leads"
          value={loading ? '—' : formatCount(metrics?.new_leads ?? 0)}
          loading={loading}
          highlight={(metrics?.new_leads ?? 0) > 0}
        />
      </View>

      <View style={s.actionsRow}>
        <ActionButton
          emoji="⚡"
          title="Flash Deal"
          subtitle="Story or offer"
          onPress={onFlashDeal}
          accent
        />
        <ActionButton
          emoji="📦"
          title="Add Product"
          subtitle="Catalog listing"
          onPress={onAddProduct}
        />
        <ActionButton
          emoji="🎬"
          title="Post Spark"
          subtitle="Short video"
          onPress={onPostSpark}
        />
      </View>

      {unreadEnquiries > 0 ? (
        <TouchableOpacity style={s.leadBanner} onPress={onViewEnquiries} activeOpacity={0.9}>
          <Text style={s.leadBannerText}>
            📥 You have {unreadEnquiries} new customer enquir{unreadEnquiries === 1 ? 'y' : 'ies'}
          </Text>
          <Text style={s.leadBannerCta}>View →</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function MetricTile({
  label,
  value,
  loading,
  highlight,
}: {
  label: string;
  value: string;
  loading?: boolean;
  highlight?: boolean;
}) {
  return (
    <View style={[s.metricTile, highlight && s.metricTileHighlight]}>
      {loading ? <ActivityIndicator size="small" color={Colors.orange} /> : null}
      <Text style={[s.metricValue, highlight && s.metricValueHighlight]}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({
  emoji,
  title,
  subtitle,
  onPress,
  accent,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.actionBtn, accent && s.actionBtnAccent]}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text style={s.actionEmoji}>{emoji}</Text>
      <Text style={[s.actionTitle, accent && s.actionTitleAccent]}>+ {title}</Text>
      <Text style={[s.actionSub, accent && s.actionSubAccent]}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: {
    marginHorizontal: 16,
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
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 68,
    justifyContent: 'center',
  },
  metricTileHighlight: {
    borderColor: Colors.orange,
    backgroundColor: Colors.orange + '12',
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
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  actionBtnAccent: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  actionEmoji: { fontSize: 20, marginBottom: 4 },
  actionTitle: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  actionTitleAccent: { color: Colors.white },
  actionSub: {
    marginTop: 2,
    fontSize: 9,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.dim,
    textAlign: 'center',
  },
  actionSubAccent: { color: Colors.white + 'CC' },
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
});
