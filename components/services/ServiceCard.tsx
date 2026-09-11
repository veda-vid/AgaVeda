// components/services/ServiceCard.tsx — Elite Pros marketplace card

import { useRef } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CAT_TINT, canChatWithPro, formatProDistance, getPresenceDisplay, getProCategoryLabel,
  hexAlpha, unicodeProsStyle,
} from '../../lib/prosUtils';
import { Colors, Fonts, Shadow, createDynamicStyles } from '../../constants/theme';
import type { ServiceProvider } from '../../types';
import {
  CategoryIcon, IconChat, IconPhone, IconStar, ScalePressable, VerifiedMark,
} from './ServiceIcons';

type ServiceCardProps = {
  svc: ServiceProvider;
  currentUserId?: string;
  onSelect: (s: ServiceProvider) => void;
  onChat: (s: ServiceProvider) => void;
  onRequest: (s: ServiceProvider) => void;
  compact?: boolean;
};

function presenceEmoji(svc: ServiceProvider) {
  const p = getPresenceDisplay(svc);
  if (p.dotColor === '#10B981' || /online/i.test(p.label)) return '🟢';
  if (/away/i.test(p.label) || p.dotColor === '#F59E0B') return '🟡';
  return '⚪';
}

function experienceBadge(years: number) {
  if (years >= 10) return '10+ yrs';
  if (years >= 5) return '5+ yrs';
  if (years >= 3) return '3+ yrs';
  if (years >= 1) return `${years}+ yrs`;
  return 'New pro';
}

export function ServiceCard({
  svc, currentUserId, onSelect, onChat, onRequest, compact,
}: ServiceCardProps) {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (value: number) => {
    Animated.spring(scale, { toValue: value, useNativeDriver: true, friction: 7, tension: 150 }).start();
  };

  const tint = CAT_TINT[svc.category] ?? Colors.orange;
  const catLabel = getProCategoryLabel(svc);
  const chatEnabled = canChatWithPro(svc);
  const presence = getPresenceDisplay(svc);
  const isOwnListing = !!currentUserId && svc.profile_id === currentUserId;
  const distance = formatProDistance(svc.distance_km);
  const rate = svc.base_rate_label?.trim() || 'Rate on request';

  const openManage = () => {
    router.push('/pro/settings' as any);
  };

  return (
    <Animated.View style={[s.cardLift, compact && s.cardLiftCompact, { transform: [{ scale }] }]}>
      <View style={s.card}>
        <View style={[s.cardAccent, { backgroundColor: tint }]} />

        <Pressable
          onPress={() => onSelect(svc)}
          onPressIn={() => animate(0.985)}
          onPressOut={() => animate(1)}
          style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : undefined}
        >
          <View style={s.cardBody}>
            <View style={s.cardTop}>
              <View style={[s.avatarWrap, { backgroundColor: hexAlpha(tint, '22') }]}>
                <CategoryIcon id={svc.category} size={26} color={tint} />
                <View style={[s.onlineDot, { backgroundColor: presence.dotColor }]} />
              </View>

              <View style={s.cardMeta}>
                <View style={s.nameRow}>
                  <View style={s.nameCluster}>
                    <Text style={[s.name, unicodeProsStyle]} numberOfLines={1}>{svc.business_name}</Text>
                    {svc.is_verified ? (
                      <View style={s.verifiedPill}>
                        <VerifiedMark size={12} />
                        <Text style={s.verifiedText}>Verified</Text>
                      </View>
                    ) : null}
                  </View>
                  {isOwnListing ? (
                    <View style={s.selfBadge}>
                      <Text style={s.selfBadgeText}>Your Listing</Text>
                    </View>
                  ) : null}
                </View>

                <View style={s.metaRow}>
                  <Text style={[s.catText, { color: tint }, unicodeProsStyle]} numberOfLines={1}>
                    {catLabel}
                  </Text>
                  <Text style={s.presenceInline} numberOfLines={1}>
                    {presenceEmoji(svc)} {presence.label.replace('Available · ', '')}
                  </Text>
                </View>

                {distance ? (
                  <View style={s.distancePill}>
                    <Text style={s.distanceText}>{distance} away</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={s.metricsRow}>
              <View style={s.metricChip}>
                <IconStar size={12} color={Colors.amber} />
                <Text style={s.metricText}>
                  {Number(svc.avg_rating || 0).toFixed(1)}
                  {Number(svc.total_reviews) > 0 ? ` · ${svc.total_reviews} review${Number(svc.total_reviews) === 1 ? '' : 's'}` : ' · New'}
                </Text>
              </View>
              <View style={s.metricChip}>
                <Text style={s.metricText}>{experienceBadge(svc.experience_years ?? 0)}</Text>
              </View>
              <View style={[s.metricChip, s.rateChip]}>
                <Text style={s.rateText} numberOfLines={1}>₹ {rate.replace(/^₹\s*/, '')}</Text>
              </View>
            </View>
          </View>
        </Pressable>

        {isOwnListing ? (
          <View style={s.actions}>
            <ScalePressable
              containerStyle={s.actionFlex}
              style={s.manageBtn}
              pressedScale={0.96}
              onPress={openManage}
            >
              <Text style={s.manageBtnText}>🛠️ Manage My Listing</Text>
            </ScalePressable>
          </View>
        ) : (
          <View style={s.quickBar}>
            <ScalePressable
              containerStyle={s.actionFlex}
              style={[s.pill, s.pillChat, !chatEnabled && s.pillDisabled]}
              pressedScale={chatEnabled ? 0.96 : 1}
              disabled={!chatEnabled}
              onPress={() => chatEnabled && onChat(svc)}
            >
              <IconChat size={13} color={chatEnabled ? Colors.blue : Colors.dim} />
              <Text style={[s.pillTextChat, !chatEnabled && s.pillTextDisabled]}>Chat</Text>
            </ScalePressable>
            <ScalePressable
              containerStyle={s.actionFlex}
              style={[s.pill, s.pillCall]}
              pressedScale={0.96}
              onPress={() => Linking.openURL(`tel:${svc.phone}`)}
            >
              <IconPhone size={13} color={Colors.white} />
              <Text style={s.pillTextLight}>Call</Text>
            </ScalePressable>
            <ScalePressable
              containerStyle={s.actionFlex}
              style={[s.pill, s.pillQuote]}
              pressedScale={0.96}
              onPress={() => onRequest(svc)}
            >
              <Text style={s.pillTextLight}>Get Quote</Text>
            </ScalePressable>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const s = createDynamicStyles((Colors) => ({
  cardLift: { borderRadius: 20, ...Shadow.md },
  cardLiftCompact: { width: 300 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardAccent: { height: 3, width: '100%' },
  cardBody: { padding: 14, paddingBottom: 10, gap: 12 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: Colors.card,
  },
  cardMeta: { flex: 1, gap: 5, minWidth: 0 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nameCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    flexWrap: 'wrap',
  },
  name: {
    flexShrink: 1,
    fontSize: 16,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.text,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: hexAlpha(Colors.green, '18'),
    borderWidth: 1,
    borderColor: hexAlpha(Colors.green, '44'),
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.green,
  },
  selfBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.orange + '22',
    borderWidth: 1,
    borderColor: Colors.orange + '55',
  },
  selfBadgeText: {
    fontSize: 9,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.orange,
    letterSpacing: 0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  catText: { fontSize: 12, fontFamily: Fonts.bodySemiBold, fontWeight: '700' },
  presenceInline: { fontSize: 11, color: Colors.sub, fontWeight: '600' },
  distancePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  distanceText: { fontSize: 11, fontWeight: '700', color: Colors.sub },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rateChip: {
    backgroundColor: hexAlpha(Colors.orange, '14'),
    borderColor: hexAlpha(Colors.orange, '44'),
  },
  metricText: { fontSize: 11, fontWeight: '700', color: Colors.text },
  rateText: { fontSize: 11, fontWeight: '800', color: Colors.orange, maxWidth: 120 },
  actions: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 2 },
  actionFlex: { flex: 1 },
  manageBtn: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.orange,
  },
  manageBtnText: {
    color: Colors.orange,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    fontSize: 13,
  },
  quickBar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  pillChat: {
    backgroundColor: hexAlpha(Colors.blue, '14'),
    borderWidth: 1,
    borderColor: hexAlpha(Colors.blue, '44'),
  },
  pillCall: { backgroundColor: Colors.green },
  pillQuote: { backgroundColor: Colors.orange },
  pillDisabled: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border2,
    opacity: 0.7,
  },
  pillTextChat: { color: Colors.blue, fontWeight: '800', fontSize: 11 },
  pillTextLight: { color: Colors.white, fontWeight: '800', fontSize: 11 },
  pillTextDisabled: { color: Colors.dim },
}));
