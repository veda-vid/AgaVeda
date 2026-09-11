// components/profile/ProfileHeader.tsx — Location radar + role-adaptive dashboard

import { useRef, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, Animated, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, DEFAULT_SHOP_BIO, createDynamicStyles } from '../../constants/theme';
import {
  formatCoverageLabel,
  formatCompactCount,
  formatShopHours,
  categoryRankLabel,
  shopHandle,
  unicodeProsStyle,
} from '../../lib/profileUtils';
import {
  getRoleBadgeLabel,
  getRoleEmoji,
  isLocationLocked,
  isMerchantSeller,
  isServiceProvider,
} from '../../stores/roleUtils';
import { formatResponseTime } from '../../lib/enquiryUtils';
import { getProCategoryLabel } from '../../lib/prosUtils';
import type { ServiceProProfileStats } from '../../lib/api';
import type {
  Profile, SellerCompetitiveProfile, SellerEnquiryStats, ServiceProvider, Shop,
} from '../../types';
import { SpringPressable } from '../ui/modernSurfaces';

type Props = {
  profile: Profile;
  sellerShop: Shop | null;
  serviceProRecord: ServiceProvider | null;
  serviceProStats: ServiceProProfileStats | null;
  serviceProStatsLoading?: boolean;
  competitiveProfile: SellerCompetitiveProfile | null;
  competitiveLoading?: boolean;
  enquiryStats: SellerEnquiryStats | null;
  enquiryStatsLoading?: boolean;
  postsCount: number;
  followingCount: number;
  savedItemsCount: number;
  activeOrdersCount: number;
  proLeadCount: number;
  newEnquiryCount: number;
  proAvailable: boolean;
  onOpenRadius: () => void;
  onOpenSettings: () => void;
  onChangeAvatar: () => void;
  onEditProfile: () => void;
  onShareProfile: () => void;
  onUpload: () => void;
  onOpenEnquiries: () => void;
  onOpenProLeads: () => void;
  onOpenOrders: () => void;
  onOpenSaved: () => void;
  onSwitchToSeller: () => void;
  onManageShop: () => void;
  onEditSkills: () => void;
  onToggleAvailability: (next: boolean) => void;
};

function LocationCoverageBar({
  city,
  radiusKm,
  locked,
  onPress,
}: {
  city: string;
  radiusKm: number;
  locked: boolean;
  onPress: () => void;
}) {
  return (
    <SpringPressable
      style={s.locationChip}
      pressedScale={0.98}
      onPress={onPress}
    >
      <Text style={s.pin}>📍</Text>
      <Text style={s.locationText} numberOfLines={1}>
        {formatCoverageLabel(city, radiusKm)}
      </Text>
      <Text style={s.editPencil}>{locked ? '🔒' : '✏️'}</Text>
    </SpringPressable>
  );
}

function PulseRing({ color, children }: { color: string; children: React.ReactNode }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={s.pulseWrap}>
      <Animated.View
        style={[
          s.pulseRing,
          {
            borderColor: color,
            transform: [{ scale: pulse }],
            opacity: pulse.interpolate({ inputRange: [1, 1.4], outputRange: [0.9, 0.3] }),
          },
        ]}
      />
      {children}
    </View>
  );
}

export function ProfileHeader(props: Props) {
  const insets = useSafeAreaInsets();
  const {
    profile,
    sellerShop,
    serviceProRecord,
    serviceProStats,
    serviceProStatsLoading,
    competitiveProfile,
    competitiveLoading,
    enquiryStats,
    enquiryStatsLoading,
    postsCount,
    followingCount,
    savedItemsCount,
    activeOrdersCount,
    proLeadCount,
    newEnquiryCount,
    proAvailable,
  } = props;

  const locked = isLocationLocked(profile.role);
  const coverageKm = isServiceProvider(profile.role)
    ? (serviceProRecord?.coverage_radius_km ?? profile.radius_km)
    : profile.radius_km;
  const emoji = getRoleEmoji(profile.role);
  const roleLabel = getRoleBadgeLabel(profile.role);

  const topPad = Math.max(insets.top, Platform.OS === 'ios' ? 48 : 12);

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      {/* Role top actions */}
      {isMerchantSeller(profile.role) ? (
        <View style={s.topBar}>
          <TouchableOpacity onPress={props.onUpload} style={s.iconBtn} activeOpacity={0.85}>
            <Text style={s.plusIcon}>+</Text>
          </TouchableOpacity>
          <Text style={s.brandTitle} numberOfLines={1}>
            {shopHandle(sellerShop?.name || profile.name)}
          </Text>
          <TouchableOpacity onPress={props.onOpenEnquiries} style={s.enquiryBtn} activeOpacity={0.85}>
            <Text style={s.enquiryBtnText}>
              📥{newEnquiryCount > 0 ? ` (${newEnquiryCount})` : ''}
            </Text>
            {newEnquiryCount > 0 ? <View style={s.dot} /> : null}
          </TouchableOpacity>
          <TouchableOpacity onPress={props.onOpenSettings} style={s.iconBtn} activeOpacity={0.85}>
            <Text style={s.menuIcon}>☰</Text>
          </TouchableOpacity>
        </View>
      ) : isServiceProvider(profile.role) ? (
        <View style={s.topBar}>
          <TouchableOpacity onPress={props.onUpload} style={s.iconBtn} activeOpacity={0.85}>
            <Text style={s.plusIcon}>+</Text>
          </TouchableOpacity>
          <Text style={s.brandTitle} numberOfLines={1}>
            {shopHandle(serviceProRecord?.business_name || profile.name)}
          </Text>
          <TouchableOpacity onPress={props.onOpenProLeads} style={s.enquiryBtn} activeOpacity={0.85}>
            <Text style={s.enquiryBtnText}>
              📥{proLeadCount > 0 ? ` (${proLeadCount})` : ''}
            </Text>
            {proLeadCount > 0 ? <View style={s.dot} /> : null}
          </TouchableOpacity>
          <TouchableOpacity onPress={props.onOpenSettings} style={s.iconBtn} activeOpacity={0.85}>
            <Text style={s.menuIcon}>☰</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.buyerTop}>
          <Text style={s.brandTitleCentered}>Profile</Text>
          <TouchableOpacity onPress={props.onOpenSettings} style={s.iconBtn} activeOpacity={0.85}>
            <Text style={s.menuIcon}>☰</Text>
          </TouchableOpacity>
        </View>
      )}

      <LocationCoverageBar
        city={profile.city}
        radiusKm={coverageKm}
        locked={locked}
        onPress={props.onOpenRadius}
      />

      {profile.role === 'buyer' ? (
        <BuyerDashboard
          profile={profile}
          emoji={emoji}
          roleLabel={roleLabel}
          followingCount={followingCount}
          savedItemsCount={savedItemsCount}
          activeOrdersCount={activeOrdersCount}
          onChangeAvatar={props.onChangeAvatar}
          onEditProfile={props.onEditProfile}
          onOpenOrders={props.onOpenOrders}
          onOpenSaved={props.onOpenSaved}
          onSwitchToSeller={props.onSwitchToSeller}
        />
      ) : null}

      {isMerchantSeller(profile.role) ? (
        <SellerDashboard
          profile={profile}
          shop={sellerShop}
          postsCount={postsCount}
          followingCount={followingCount}
          competitiveProfile={competitiveProfile}
          competitiveLoading={!!competitiveLoading}
          enquiryStats={enquiryStats}
          enquiryStatsLoading={!!enquiryStatsLoading}
          onChangeAvatar={props.onChangeAvatar}
          onEditProfile={props.onEditProfile}
          onShareProfile={props.onShareProfile}
          onManageShop={props.onManageShop}
          onOpenEnquiries={props.onOpenEnquiries}
          newEnquiryCount={newEnquiryCount}
        />
      ) : null}

      {isServiceProvider(profile.role) ? (
        <ProDashboard
          profile={profile}
          provider={serviceProRecord}
          stats={serviceProStats}
          statsLoading={!!serviceProStatsLoading}
          available={proAvailable}
          proLeadCount={proLeadCount}
          onChangeAvatar={props.onChangeAvatar}
          onEditProfile={props.onEditProfile}
          onShareProfile={props.onShareProfile}
          onEditSkills={props.onEditSkills}
          onToggleAvailability={props.onToggleAvailability}
          onOpenProLeads={props.onOpenProLeads}
        />
      ) : null}
    </View>
  );
}

function BuyerDashboard({
  profile, emoji, roleLabel, followingCount, savedItemsCount, activeOrdersCount,
  onChangeAvatar, onEditProfile, onOpenOrders, onOpenSaved, onSwitchToSeller,
}: {
  profile: Profile;
  emoji: string;
  roleLabel: string;
  followingCount: number;
  savedItemsCount: number;
  activeOrdersCount: number;
  onChangeAvatar: () => void;
  onEditProfile: () => void;
  onOpenOrders: () => void;
  onOpenSaved: () => void;
  onSwitchToSeller: () => void;
}) {
  return (
    <View style={s.section}>
      <View style={s.buyerIdentity}>
        <TouchableOpacity onPress={onChangeAvatar} style={s.avatarLg} activeOpacity={0.85}>
          {profile.avatar_url
            ? <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} />
            : <Text style={s.avatarEmoji}>{emoji}</Text>}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.displayName, unicodeProsStyle]}>{profile.name}</Text>
          <View style={s.rolePill}>
            <Text style={s.rolePillText}>{emoji} {roleLabel}</Text>
          </View>
          <Text style={[s.bio, unicodeProsStyle]} numberOfLines={2}>
            {profile.bio || DEFAULT_SHOP_BIO}
          </Text>
        </View>
      </View>

      <View style={s.metricsRow}>
        <Metric value={String(savedItemsCount)} label="Saved" />
        <Metric value={String(followingCount)} label="Following" />
        <Metric value={String(activeOrdersCount)} label="Orders" />
      </View>

      <View style={s.chipActions}>
        <ActionChip label="📦 My Orders" onPress={onOpenOrders} />
        <ActionChip label="🔖 Saved Collections" onPress={onOpenSaved} />
        <ActionChip label="🛍️ Switch to Seller" onPress={onSwitchToSeller} accent />
      </View>

      <SpringPressable style={s.secondaryBtn} pressedScale={0.97} onPress={onEditProfile}>
        <Text style={s.secondaryBtnText}>✏️ Edit Profile</Text>
      </SpringPressable>
    </View>
  );
}

function SellerDashboard({
  profile, shop, postsCount, followingCount,
  competitiveProfile, competitiveLoading, enquiryStats, enquiryStatsLoading,
  onChangeAvatar, onEditProfile, onShareProfile, onManageShop, onOpenEnquiries, newEnquiryCount,
}: {
  profile: Profile;
  shop: Shop | null;
  postsCount: number;
  followingCount: number;
  competitiveProfile: SellerCompetitiveProfile | null;
  competitiveLoading: boolean;
  enquiryStats: SellerEnquiryStats | null;
  enquiryStatsLoading: boolean;
  onChangeAvatar: () => void;
  onEditProfile: () => void;
  onShareProfile: () => void;
  onManageShop: () => void;
  onOpenEnquiries: () => void;
  newEnquiryCount: number;
}) {
  const name = shop?.name || profile.name;
  const hours = formatShopHours(shop?.open_time, shop?.close_time);
  const isOpen = !!shop?.is_open;
  const rankCategory = competitiveProfile?.category || shop?.category || 'toys';

  return (
    <View style={s.section}>
      <View style={s.igRow}>
        <TouchableOpacity onPress={onChangeAvatar} style={s.avatarLg} activeOpacity={0.85}>
          {profile.avatar_url || shop?.logo_url
            ? <Image source={{ uri: profile.avatar_url || shop?.logo_url || '' }} style={s.avatarImg} />
            : <Text style={s.avatarEmoji}>🏪</Text>}
        </TouchableOpacity>
        <View style={s.igStats}>
          <Metric value={String(postsCount)} label="Posts" compact />
          <Metric value={formatCompactCount(shop?.total_followers)} label="Followers" compact />
          <Metric value={String(followingCount)} label="Following" compact />
        </View>
      </View>

      <Text style={s.displayName}>{name}</Text>
      <View style={s.handleRow}>
        <Text style={s.handle}>{shopHandle(name)}</Text>
        {shop?.is_verified ? <Text style={s.verified}>✅ Verified</Text> : null}
      </View>
      <View style={s.statusRow}>
        <View style={[s.statusPill, { backgroundColor: isOpen ? '#10B98122' : '#64748B22' }]}>
          <Text style={[s.statusPillText, { color: isOpen ? '#10B981' : Colors.sub }]}>
            {isOpen ? '🟢 Open Now' : '🔴 Closed'}
          </Text>
        </View>
        <Text style={s.hoursText}>{hours ? `🕒 ${hours}` : '🕒 Hours not set'}</Text>
      </View>
      <Text style={s.metaLine}>🏪 Seller · {profile.city}</Text>
      <Text style={s.bio} numberOfLines={3}>{shop?.description || profile.bio || DEFAULT_SHOP_BIO}</Text>

      <View style={s.actionRow}>
        <SpringPressable style={s.actionBtn} pressedScale={0.97} onPress={onEditProfile}>
          <Text style={s.actionBtnText}>Edit profile</Text>
        </SpringPressable>
        <SpringPressable style={s.actionBtn} pressedScale={0.97} onPress={onShareProfile}>
          <Text style={s.actionBtnText}>Share profile</Text>
        </SpringPressable>
        <SpringPressable style={s.iconAction} pressedScale={0.97} onPress={onManageShop}>
          <Text>🏪</Text>
        </SpringPressable>
      </View>

      <SpringPressable style={s.leadsCta} pressedScale={0.97} onPress={onOpenEnquiries}>
        <Text style={s.leadsCtaText}>
          📥 Enquiries & Leads{newEnquiryCount > 0 ? ` (${newEnquiryCount} New)` : ''}
        </Text>
      </SpringPressable>

      <View style={s.metricsGrid}>
        <Metric
          value={competitiveLoading ? '…' : competitiveProfile
            ? `#${competitiveProfile.category_rank}`
            : '—'}
          label={categoryRankLabel(rankCategory)}
        />
        <Metric
          value={competitiveLoading ? '…' : competitiveProfile
            ? competitiveProfile.monthly_successful_orders.toLocaleString()
            : '—'}
          label="Monthly Orders"
        />
        <Metric
          value={enquiryStatsLoading ? '…' : `${enquiryStats?.conversion_rate ?? 0}%`}
          label="Lead Conversion"
        />
        <Metric
          value={enquiryStatsLoading ? '…' : formatResponseTime(enquiryStats?.avg_response_minutes ?? 0)}
          label="Response Time"
        />
      </View>
    </View>
  );
}

function ProDashboard({
  profile, provider, stats, statsLoading, available, proLeadCount,
  onChangeAvatar, onEditProfile, onShareProfile, onEditSkills, onToggleAvailability, onOpenProLeads,
}: {
  profile: Profile;
  provider: ServiceProvider | null;
  stats: ServiceProProfileStats | null;
  statsLoading: boolean;
  available: boolean;
  proLeadCount: number;
  onChangeAvatar: () => void;
  onEditProfile: () => void;
  onShareProfile: () => void;
  onEditSkills: () => void;
  onToggleAvailability: (next: boolean) => void;
  onOpenProLeads: () => void;
}) {
  const name = provider?.business_name || profile.name;
  const pulseColor = available ? '#10B981' : '#F59E0B';
  const rating = statsLoading
    ? '…'
    : (stats?.total_reviews ?? 0) > 0
      ? `⭐ ${(stats?.avg_rating ?? 0).toFixed(1)}`
      : '⭐ New';
  const jobs = statsLoading ? '…' : String(stats?.jobs_done ?? 0);
  const rate = provider?.base_rate_label?.trim() || 'Rate not set';

  return (
    <View style={s.section}>
      <View style={s.proIdentity}>
        <TouchableOpacity onPress={onChangeAvatar} activeOpacity={0.85}>
          <PulseRing color={pulseColor}>
            <View style={[s.avatarRing, { borderColor: pulseColor }]}>
              {profile.avatar_url
                ? <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} />
                : <Text style={s.avatarEmoji}>🔧</Text>}
            </View>
          </PulseRing>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.displayName, unicodeProsStyle]} numberOfLines={1}>{name}</Text>
          <Text style={s.handle}>{shopHandle(name)}</Text>
          <Text style={s.proBadge}>
            🛠️ Service Pro · {provider ? getProCategoryLabel(provider) : 'General'}
          </Text>
        </View>
      </View>

      <SpringPressable
        style={[s.availToggle, available ? s.availOn : s.availBusy]}
        pressedScale={0.97}
        onPress={() => onToggleAvailability(!available)}
      >
        <Text style={s.availToggleText}>
          {available ? '🟢 Available Now' : '🟡 Busy'}
        </Text>
      </SpringPressable>

      <View style={s.metricsRow}>
        <Metric value={jobs} label="Jobs Completed" />
        <Metric value={rating} label="Rating" />
        <Metric value={rate} label="Base Rate" />
      </View>

      <View style={s.actionRow}>
        <SpringPressable style={s.actionBtn} pressedScale={0.97} onPress={onEditProfile}>
          <Text style={s.actionBtnText}>Edit profile</Text>
        </SpringPressable>
        <SpringPressable style={s.actionBtn} pressedScale={0.97} onPress={onShareProfile}>
          <Text style={s.actionBtnText}>Share profile</Text>
        </SpringPressable>
      </View>

      <SpringPressable style={s.skillsCta} pressedScale={0.97} onPress={onEditSkills}>
        <Text style={s.skillsCtaText}>🛠️ Edit Skills & Portfolio</Text>
      </SpringPressable>

      <SpringPressable style={s.leadsCta} pressedScale={0.97} onPress={onOpenProLeads}>
        <Text style={s.leadsCtaText}>
          📥 Enquiries & Leads{proLeadCount > 0 ? ` (${proLeadCount} New)` : ''}
        </Text>
      </SpringPressable>
    </View>
  );
}

function Metric({
  value, label, compact,
}: { value: string; label: string; compact?: boolean }) {
  return (
    <View style={[s.metric, compact && s.metricCompact]}>
      <Text style={s.metricValue} numberOfLines={1}>{value}</Text>
      <Text style={s.metricLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function ActionChip({
  label, onPress, accent,
}: { label: string; onPress: () => void; accent?: boolean }) {
  return (
    <SpringPressable
      style={[s.chip, accent && s.chipAccent]}
      pressedScale={0.96}
      onPress={onPress}
    >
      <Text style={[s.chipText, accent && s.chipTextAccent]}>{label}</Text>
    </SpringPressable>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: Colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  buyerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  brandTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontFamily: Fonts.displayXBold,
    fontWeight: '900',
    color: Colors.orange,
  },
  brandTitleCentered: {
    fontSize: 22,
    fontFamily: Fonts.displayXBold,
    fontWeight: '900',
    color: Colors.orange,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  plusIcon: { fontSize: 28, color: Colors.text, fontWeight: '300' },
  menuIcon: { fontSize: 18, color: Colors.text, fontWeight: '700' },
  enquiryBtn: { paddingHorizontal: 6, paddingVertical: 6, position: 'relative' },
  enquiryBtnText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  dot: {
    position: 'absolute',
    top: 4,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.orange,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    marginBottom: 12,
  },
  pin: { fontSize: 14 },
  locationText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
  },
  editPencil: { fontSize: 13 },
  section: { gap: 10, paddingBottom: 4 },
  buyerIdentity: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatarLg: {
    width: 82,
    height: 82,
    borderRadius: 41,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.border2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 34 },
  displayName: {
    fontSize: 20,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: Colors.text,
  },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: Colors.orange + '22',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rolePillText: { color: Colors.orange, fontSize: 11, fontWeight: '800' },
  bio: { color: Colors.text, fontSize: 13, lineHeight: 18, marginTop: 4 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 72,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  metricCompact: { flex: 1, minWidth: 0, flexBasis: undefined },
  metricValue: { fontSize: 15, fontWeight: '800', color: Colors.text },
  metricLabel: { marginTop: 2, fontSize: 10, fontWeight: '600', color: Colors.dim, textAlign: 'center' },
  chipActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  chipAccent: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  chipText: { fontSize: 12, fontWeight: '700', color: Colors.text },
  chipTextAccent: { color: Colors.white },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  secondaryBtnText: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  igRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  igStats: { flex: 1, flexDirection: 'row', gap: 8 },
  handleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  handle: { color: Colors.sub, fontSize: 13, fontWeight: '600' },
  verified: { fontSize: 11, fontWeight: '800', color: Colors.orange },
  statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 12, fontWeight: '800' },
  hoursText: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  metaLine: { color: Colors.sub, fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  iconAction: {
    width: 44,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadsCta: {
    backgroundColor: Colors.orange + '18',
    borderWidth: 1,
    borderColor: Colors.orange + '44',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  leadsCtaText: { color: Colors.orange, fontWeight: '800', fontSize: 14 },
  skillsCta: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  skillsCtaText: { color: Colors.text, fontWeight: '800', fontSize: 14 },
  proIdentity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pulseWrap: { width: 86, height: 86, alignItems: 'center', justifyContent: 'center' },
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
  proBadge: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.orange,
  },
  availToggle: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  availOn: { backgroundColor: '#10B98122', borderColor: '#10B98155' },
  availBusy: { backgroundColor: '#F59E0B22', borderColor: '#F59E0B55' },
  availToggleText: { fontWeight: '800', fontSize: 14, color: Colors.text },
}));
