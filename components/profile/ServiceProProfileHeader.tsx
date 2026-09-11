import { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet, Animated,
} from 'react-native';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import { getProCategoryLabel, unicodeProsStyle } from '../../lib/prosUtils';
import type { ServiceProProfileStats } from '../../lib/api';
import type { Profile, ServiceProvider } from '../../types';

function profileHandle(name?: string | null) {
  const trimmed = (name || 'pro').trim();
  const slug = trimmed
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, 20);
  return `@${slug || 'pro'}`;
}

type ServiceProProfileHeaderProps = {
  profile: Profile;
  provider: ServiceProvider | null;
  stats: ServiceProProfileStats | null;
  statsLoading?: boolean;
  isAvailable: boolean;
  onChangeAvatar: () => void;
  onEditProfile: () => void;
  onShareProfile: () => void;
};

export function ServiceProProfileHeader({
  profile,
  provider,
  stats,
  statsLoading,
  isAvailable,
  onChangeAvatar,
  onEditProfile,
  onShareProfile,
}: ServiceProProfileHeaderProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const categoryLabel = provider ? getProCategoryLabel(provider) : 'General Services';
  const displayName = provider?.business_name || profile.name;
  const coverageKm = provider?.coverage_radius_km ?? profile.radius_km;
  const pulseColor = isAvailable ? Colors.green : Colors.amber;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.45, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const jobsLabel = statsLoading ? '—' : String(stats?.jobs_done ?? 0);
  const ratingLabel = statsLoading
    ? '—'
    : (stats?.total_reviews ?? 0) > 0
      ? `★ ${(stats?.avg_rating ?? 0).toFixed(1)}`
      : '★ New';
  const responseLabel = statsLoading
    ? '—'
    : stats?.response_rate_pct != null
      ? `${stats.response_rate_pct}%`
      : '—';

  return (
    <View style={s.root}>
      <View style={s.identityRow}>
        <TouchableOpacity onPress={onChangeAvatar} activeOpacity={0.85}>
          <View style={s.avatarWrap}>
            <Animated.View
              style={[
                s.pulseRing,
                {
                  borderColor: pulseColor,
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseAnim.interpolate({ inputRange: [1, 1.45], outputRange: [0.9, 0.35] }),
                },
              ]}
            />
            <View style={[s.avatarRing, { borderColor: pulseColor }]}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} />
              ) : (
                <Text style={s.avatarEmoji}>🔧</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>

        <View style={s.identityText}>
          <Text style={[s.displayName, unicodeProsStyle]} numberOfLines={1}>{displayName}</Text>
          <Text style={s.handle}>{profileHandle(displayName)}</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>🛠️ Service Pro · {categoryLabel}</Text>
          </View>
        </View>
      </View>

      <View style={s.metricsRow}>
        <MetricCard value={jobsLabel} label="Jobs Done" />
        <MetricCard value={ratingLabel} label="Rating" />
        <MetricCard value={responseLabel} label="Response Rate" />
      </View>

      <View style={s.pillRow}>
        {provider?.base_rate_label ? (
          <View style={s.pill}>
            <Text style={[s.pillText, unicodeProsStyle]}>🏷️ {provider.base_rate_label}</Text>
          </View>
        ) : null}
        <View style={s.pill}>
          <Text style={[s.pillText, unicodeProsStyle]}>📍 {coverageKm} km coverage</Text>
        </View>
      </View>

      <View style={s.actionRow}>
        <TouchableOpacity style={s.actionBtn} onPress={onEditProfile} activeOpacity={0.85}>
          <Text style={s.actionBtnText}>Edit profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.actionBtn} onPress={onShareProfile} activeOpacity={0.85}>
          <Text style={s.actionBtnText}>Share profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={s.metricCard}>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  avatarWrap: {
    width: 86,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 2,
  },
  avatarRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 30 },
  identityText: { flex: 1 },
  displayName: {
    fontSize: 20,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: Colors.text,
  },
  handle: {
    marginTop: 2,
    fontSize: 13,
    color: Colors.sub,
    fontWeight: '600',
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.orange + '22',
    borderWidth: 1,
    borderColor: Colors.orange + '55',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.orange,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metricValue: {
    fontSize: 16,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: Colors.text,
  },
  metricLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    color: Colors.dim,
    textAlign: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
}));
