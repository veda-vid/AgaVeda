import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Switch, Platform, ScrollView, Pressable,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { hapticLight, hapticSuccess } from '../../lib/haptics';
import { CAT_TINT, getProCategoryLabel, unicodeProsStyle } from '../../lib/prosUtils';
import { GlassSurface, SpringPressable } from '../ui/modernSurfaces';
import { CategoryIcon } from '../services/ServiceIcons';
import type { ServiceProDashboardStats } from '../../lib/api';
import type { ServiceProvider } from '../../types';

const HERO_GLASS = {
  bg: 'rgba(255, 255, 255, 0.05)',
  border: 'rgba(255, 255, 255, 0.1)',
  radius: 16,
} as const;

const COLLAPSED_H = 48;
const EXPANDED_H = 160;

type ServiceProHeaderHeroProps = {
  stats: ServiceProDashboardStats | null;
  loading?: boolean;
  isAvailable: boolean;
  providerProfileId: string;
  provider?: ServiceProvider | null;
  rating?: number;
  reviewCount?: number;
  onToggleAvailability: (next: boolean) => void;
  onListService: () => void;
  onOpenActiveRequests: () => void;
  onOpenQuoteInquiries: () => void;
  onStatsChange?: (stats: ServiceProDashboardStats) => void;
};

type MetricChipProps = {
  label: string;
  onPress?: () => void;
};

function MetricChip({ label, onPress }: MetricChipProps) {
  const body = (
    <View style={s.metricChip}>
      <Text style={s.metricChipText}>{label}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <SpringPressable onPress={onPress} haptic pressedScale={0.97}>
      {body}
    </SpringPressable>
  );
}

export function ServiceProHeaderHero({
  stats,
  loading,
  isAvailable,
  providerProfileId,
  provider,
  rating = 0,
  reviewCount = 0,
  onToggleAvailability,
  onListService,
  onOpenActiveRequests,
  onOpenQuoteInquiries,
  onStatsChange,
}: ServiceProHeaderHeroProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const expand = useSharedValue(0);
  const pulse = useSharedValue(1);

  const businessName = provider?.business_name?.trim() || 'Your Business';
  const catLabel = provider ? getProCategoryLabel(provider) : 'Service Pro';
  const tint = CAT_TINT[provider?.category ?? 'other'] ?? Colors.orange;
  const rateLabel = provider?.base_rate_label?.trim();
  const requests = loading ? '—' : String(stats?.active_requests ?? 0);
  const quotes = loading ? '—' : String(stats?.quote_inquiries ?? 0);
  const ratingLabel = loading ? '—' : rating > 0 ? `${rating.toFixed(1)} Rating` : 'New Rating';
  const presenceEmoji = isAvailable ? '🟢' : '🟠';
  const presenceText = isAvailable ? 'Online' : 'Away';

  useEffect(() => {
    expand.value = withSpring(isCollapsed ? 0 : 1, { damping: 18, stiffness: 220 });
  }, [isCollapsed, expand]);

  useEffect(() => {
    if (isAvailable) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [isAvailable, pulse]);

  useEffect(() => {
    if (!providerProfileId) return;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const refreshCounts = async () => {
      const [activeRes, quoteRes] = await Promise.all([
        supabase
          .from('pro_conversations')
          .select('id', { count: 'exact', head: true })
          .eq('provider_profile_id', providerProfileId),
        supabase
          .from('pro_conversations')
          .select('id', { count: 'exact', head: true })
          .eq('provider_profile_id', providerProfileId)
          .gte('updated_at', weekAgo),
      ]);
      onStatsChange?.({
        active_requests: activeRes.count ?? 0,
        quote_inquiries: quoteRes.count ?? 0,
        is_available: isAvailable,
      });
    };

    void refreshCounts();

    const channel = supabase
      .channel(`pro-hero-${providerProfileId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pro_conversations',
        filter: `provider_profile_id=eq.${providerProfileId}`,
      }, () => { void refreshCounts(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [providerProfileId, isAvailable, onStatsChange]);

  const shellStyle = useAnimatedStyle(() => ({
    height: interpolate(expand.value, [0, 1], [COLLAPSED_H, EXPANDED_H]),
  }));

  const expandedStyle = useAnimatedStyle(() => ({
    opacity: expand.value,
    transform: [{ translateY: interpolate(expand.value, [0, 1], [6, 0]) }],
  }));

  const collapsedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expand.value, [0, 1], [1, 0]),
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(expand.value, [0, 1], [0, 180])}deg` }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: isAvailable ? pulse.value : 1 }],
  }));

  const handleToggleAvailability = (next: boolean) => {
    void (next ? hapticSuccess() : hapticLight());
    onToggleAvailability(next);
  };

  const toggleCollapse = () => {
    void hapticLight();
    setIsCollapsed(prev => !prev);
  };

  return (
    <Animated.View style={[s.shell, shellStyle]}>
      <GlassSurface style={s.card} radius={HERO_GLASS.radius} intensity={22}>
        <View style={s.cardInner}>
          <Animated.View style={[s.collapsedRow, collapsedStyle]} pointerEvents={isCollapsed ? 'auto' : 'none'}>
            <Pressable style={s.collapsedPress} onPress={toggleCollapse}>
              <Animated.View style={[s.presenceDot, { backgroundColor: isAvailable ? Colors.green : Colors.amber }, dotStyle]} />
              <Text style={[s.collapsedText, unicodeProsStyle]} numberOfLines={1}>
                {presenceEmoji} {presenceText} · {businessName} ({catLabel})
              </Text>
              {rateLabel ? (
                <View style={s.ratePillCompact}>
                  <Text style={[s.ratePillText, unicodeProsStyle]} numberOfLines={1}>{rateLabel}</Text>
                </View>
              ) : null}
              <Animated.Text style={[s.chevron, chevronStyle]}>▼</Animated.Text>
            </Pressable>
          </Animated.View>

          <Animated.View style={[s.expandedBody, expandedStyle]} pointerEvents={isCollapsed ? 'none' : 'auto'}>
            <View style={s.topRow}>
              <View style={[s.avatar, { backgroundColor: tint + '22' }]}>
                <CategoryIcon id={provider?.category ?? 'other'} size={20} color={tint} />
              </View>
              <View style={s.identityCol}>
                <Text style={[s.businessName, unicodeProsStyle]} numberOfLines={1}>{businessName}</Text>
                <Text style={[s.categoryText, unicodeProsStyle]} numberOfLines={1}>{catLabel}</Text>
              </View>
              {rateLabel ? (
                <View style={s.ratePill}>
                  <Text style={[s.ratePillText, unicodeProsStyle]} numberOfLines={1}>{rateLabel}</Text>
                </View>
              ) : null}
              <View style={s.availCol}>
                <Text style={[s.availLabel, { color: isAvailable ? Colors.green : Colors.amber }]}>
                  {presenceEmoji} {presenceText}
                </Text>
                <Switch
                  value={isAvailable}
                  onValueChange={handleToggleAvailability}
                  trackColor={{ false: 'rgba(255,255,255,0.1)', true: Colors.orange + '55' }}
                  thumbColor={isAvailable ? Colors.orange : '#94A3B8'}
                  ios_backgroundColor="rgba(255,255,255,0.1)"
                  style={s.switch}
                />
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.metricRail}
              style={s.metricScroll}
            >
              <MetricChip label={`📬 ${requests} Requests`} onPress={onOpenActiveRequests} />
              <MetricChip label={`💬 ${quotes} Quotes`} onPress={onOpenQuoteInquiries} />
              <MetricChip label={`★ ${ratingLabel}`} />
            </ScrollView>

            <View style={s.bottomRow}>
              <SpringPressable onPress={onListService} haptic style={s.manageBtn} pressedScale={0.98}>
                <Text style={s.manageBtnText}>⚡ Manage Skills & Portfolio</Text>
              </SpringPressable>
              <SpringPressable onPress={toggleCollapse} haptic style={s.collapseBtn} pressedScale={0.92}>
                <Animated.Text style={[s.chevron, chevronStyle]}>▼</Animated.Text>
              </SpringPressable>
            </View>
          </Animated.View>
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

const s = createDynamicStyles((Colors) => ({
  shell: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 8,
    overflow: 'hidden',
  },
  card: {
    flex: 1,
    backgroundColor: HERO_GLASS.bg,
    borderColor: HERO_GLASS.border,
    ...Platform.select({
      web: { boxShadow: '0 4px 20px rgba(0,0,0,0.28)' } as object,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
        elevation: 4,
      },
    }),
  },
  cardInner: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  collapsedRow: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  collapsedPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 32,
  },
  presenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  collapsedText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
  },
  chevron: {
    fontSize: 11,
    color: Colors.sub,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  expandedBody: {
    flex: 1,
    gap: 8,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  businessName: {
    fontSize: 14,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: Colors.text,
  },
  categoryText: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.sub,
  },
  ratePill: {
    maxWidth: 88,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.orange + '22',
    borderWidth: 1,
    borderColor: Colors.orange + '55',
  },
  ratePillCompact: {
    maxWidth: 72,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: Colors.orange + '22',
    borderWidth: 1,
    borderColor: Colors.orange + '55',
  },
  ratePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.orange,
  },
  availCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  availLabel: {
    fontSize: 9,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
  switch: {
    transform: [{ scaleX: 0.78 }, { scaleY: 0.78 }],
  },
  metricScroll: {
    flexGrow: 0,
    maxHeight: 34,
  },
  metricRail: {
    gap: 8,
    paddingRight: 4,
  },
  metricChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: HERO_GLASS.border,
  },
  metricChipText: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manageBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 107, 0, 0.18)',
    borderWidth: 1,
    borderColor: Colors.orange + '55',
    alignItems: 'center',
  },
  manageBtnText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.orange,
  },
  collapseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: HERO_GLASS.border,
  },
}));
