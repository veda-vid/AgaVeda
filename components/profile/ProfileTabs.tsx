// components/profile/ProfileTabs.tsx — High-density media & activity tabs

import { View, Text, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { formatCompactCount, unicodeProsStyle, type ProfilePostItem } from '../../lib/profileUtils';
import { getProfileTabsForRole, type ProfileTabId } from '../../stores/roleUtils';
import { isProfileVideoItem } from '../../lib/profileMedia';
import { ProfileGridThumb } from './ProfileGridThumb';
import { DailyBoardsSection } from '../daily/DailyBoardsSection';
import type { CityNews, Order, UserRole } from '../../types';
import { SpringPressable } from '../ui/modernSurfaces';

type Props = {
  role?: UserRole | null;
  activeTab: ProfileTabId;
  onChangeTab: (tab: ProfileTabId) => void;
  posts: ProfilePostItem[];
  loading?: boolean;
  userId?: string;
  orders?: Order[];
  ordersLoading?: boolean;
  leadCount?: number;
  dense?: boolean;
  onOpenPost: (posts: ProfilePostItem[], index: number) => void;
  onOpenDailyPin: (item: CityNews) => void;
  onOpenOrder: (order: Order) => void;
  onOpenLeads: () => void;
};

export function ProfileTabs({
  role,
  activeTab,
  onChangeTab,
  posts,
  loading,
  userId,
  orders = [],
  ordersLoading,
  leadCount = 0,
  dense,
  onOpenPost,
  onOpenDailyPin,
  onOpenOrder,
  onOpenLeads,
}: Props) {
  const tabs = getProfileTabsForRole(role);
  const { width } = useWindowDimensions();
  const columns = 3;
  const gap = dense ? 2 : 6;
  const pad = dense ? 0 : 8;
  const itemWidth = (width - pad * 2 - gap * (columns - 1)) / columns;

  const emptyCopy = (() => {
    if (activeTab === 'videos') {
      return { title: 'No Moments yet', text: 'Upload a Moment or video and it will appear here.' };
    }
    if (activeTab === 'reposts') {
      return { title: 'No reposts yet', text: 'Quoted and shared posts will show up here.' };
    }
    if (activeTab === 'saved') {
      return { title: 'No saved items yet', text: 'Save posts from the feed or pin Daily stories to your boards.' };
    }
    if (activeTab === 'orders') {
      return { title: 'No orders yet', text: 'Orders you place from the cart will appear here.' };
    }
    if (activeTab === 'leads') {
      return { title: 'No leads yet', text: 'Incoming service requests will appear in your leads inbox.' };
    }
    return {
      title: 'No posts yet',
      text: role === 'service_provider'
        ? 'Share work photos or project updates from the home feed.'
        : 'Create your first post to build your profile grid.',
    };
  })();

  return (
    <View style={s.wrap}>
      <View style={[s.tabsRow, dense && s.tabsRowDense]}>
        {tabs.map(tab => {
          const active = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => onChangeTab(tab.id)}
              style={[s.tabBtn, dense && s.tabBtnDense, active && s.tabBtnActive]}
              activeOpacity={0.85}
            >
              <Text style={[s.tabIcon, active && s.tabIconActive]}>{tab.icon}</Text>
              {!dense ? (
                <Text style={[s.tabLabel, active && s.tabLabelActive]}>{tab.label}</Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'saved' && userId ? (
        <View style={s.savedBlock}>
          <DailyBoardsSection userId={userId} onOpenItem={onOpenDailyPin} />
          {posts.length > 0 ? (
            <Text style={s.sectionLabel}>Saved marketplace & feed items</Text>
          ) : null}
        </View>
      ) : null}

      {activeTab === 'orders' ? (
        ordersLoading ? (
          <View style={s.state}>
            <ActivityIndicator color={Colors.orange} />
            <Text style={s.stateText}>Loading orders…</Text>
          </View>
        ) : orders.length > 0 ? (
          <View style={s.ordersWrap}>
            {orders.map(order => (
              <SpringPressable
                key={order.id}
                style={s.orderCard}
                pressedScale={0.98}
                onPress={() => onOpenOrder(order)}
              >
                <Text style={[s.orderShop, unicodeProsStyle]} numberOfLines={1}>
                  {order.shop?.name ?? 'Shop order'}
                </Text>
                <Text style={s.orderMeta}>
                  {order.status} · ₹{Number(order.total_amount).toFixed(0)} ·{' '}
                  {new Date(order.placed_at).toLocaleDateString()}
                </Text>
                {order.delivery_address ? (
                  <Text style={[s.orderAddress, unicodeProsStyle]} numberOfLines={2}>
                    {order.delivery_address}
                  </Text>
                ) : null}
              </SpringPressable>
            ))}
          </View>
        ) : (
          <EmptyState {...emptyCopy} icon="📦" />
        )
      ) : null}

      {activeTab === 'leads' ? (
        <View style={s.leadsWrap}>
          <SpringPressable style={s.leadsCard} pressedScale={0.97} onPress={onOpenLeads}>
            <Text style={s.leadsTitle}>📥 Incoming leads</Text>
            <Text style={s.leadsBody}>
              {leadCount > 0
                ? `${leadCount} active request${leadCount === 1 ? '' : 's'} waiting for a reply.`
                : 'No active leads right now. Keep your availability on to receive requests.'}
            </Text>
            <Text style={s.leadsCta}>Open leads inbox →</Text>
          </SpringPressable>
        </View>
      ) : null}

      {activeTab !== 'orders' && activeTab !== 'leads' ? (
        loading ? (
          <View style={s.state}>
            <ActivityIndicator color={Colors.orange} />
            <Text style={s.stateText}>Loading {activeTab}…</Text>
          </View>
        ) : posts.length > 0 ? (
          <View style={[s.gridHost, { paddingHorizontal: pad }]}>
            <FlashList
              data={posts}
              numColumns={columns}
              estimatedItemSize={itemWidth}
              keyExtractor={(item, index) => item.feed_item_id ?? item.id ?? `grid-${index}`}
              scrollEnabled={false}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[
                    s.gridItem,
                    {
                      width: itemWidth,
                      height: itemWidth,
                      marginRight: (index + 1) % columns === 0 ? 0 : gap,
                      marginBottom: gap,
                    },
                  ]}
                  onPress={() => onOpenPost(posts, index)}
                >
                  <View style={[s.thumb, dense && s.thumbDense]}>
                    <ProfileGridThumb post={item} style={s.thumbFill} />
                    {isProfileVideoItem(item) ? (
                      <View style={s.badge}><Text style={s.badgeText}>▶</Text></View>
                    ) : (item.media_urls?.length ?? 0) > 1 ? (
                      <View style={s.badge}><Text style={s.badgeText}>⧉</Text></View>
                    ) : null}
                    {dense ? (
                      <View style={s.countPill}>
                        <Text style={s.countText}>{formatCompactCount(item.total_likes)}</Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        ) : activeTab === 'saved' ? null : (
          <EmptyState
            {...emptyCopy}
            icon={activeTab === 'posts' ? '📷' : activeTab === 'videos' ? '▶' : activeTab === 'reposts' ? '↺' : '🔖'}
          />
        )
      ) : null}
    </View>
  );
}

function EmptyState({
  title, text, icon,
}: { title: string; text: string; icon: string }) {
  return (
    <View style={s.state}>
      <Text style={s.stateIcon}>{icon}</Text>
      <Text style={s.stateTitle}>{title}</Text>
      <Text style={s.stateText}>{text}</Text>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  wrap: { paddingBottom: 24 },
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border2,
    overflow: 'hidden',
  },
  tabsRowDense: {
    marginHorizontal: 0,
    borderRadius: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  tabBtnDense: { paddingVertical: 12 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: Colors.orange },
  tabIcon: { fontSize: 16, color: Colors.dim },
  tabIconActive: { color: Colors.orange },
  tabLabel: { fontSize: 10, fontWeight: '700', color: Colors.dim },
  tabLabelActive: { color: Colors.orange },
  savedBlock: { paddingHorizontal: 8, marginBottom: 8 },
  sectionLabel: {
    marginTop: 12,
    marginBottom: 8,
    marginHorizontal: 8,
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.sub,
  },
  gridHost: { minHeight: 120 },
  gridItem: { overflow: 'hidden' },
  thumb: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  thumbDense: { borderRadius: 0, borderWidth: 0 },
  thumbFill: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#000000AA',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  countPill: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: '#00000099',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  countText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  state: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 8 },
  stateIcon: { fontSize: 36, marginBottom: 4 },
  stateTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  stateText: { color: Colors.dim, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  ordersWrap: { paddingHorizontal: 16, gap: 10 },
  orderCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 14,
    gap: 4,
  },
  orderShop: { color: Colors.text, fontSize: 15, fontWeight: '800' },
  orderMeta: { color: Colors.sub, fontSize: 12, fontWeight: '600' },
  orderAddress: { color: Colors.dim, fontSize: 12, marginTop: 2 },
  leadsWrap: { paddingHorizontal: 16 },
  leadsCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 16,
    gap: 8,
  },
  leadsTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  leadsBody: { fontSize: 13, color: Colors.sub, lineHeight: 18 },
  leadsCta: { marginTop: 4, fontSize: 13, fontWeight: '800', color: Colors.orange },
}));
