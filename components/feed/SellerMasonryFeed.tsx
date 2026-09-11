// components/feed/SellerMasonryFeed.tsx — Smart 2-column merchant market feed

import { type ReactElement, type RefObject } from 'react';
import {
  View, Text, ActivityIndicator, Dimensions, Platform, TouchableOpacity,
  type ViewToken,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { PostCard, type FeedPost } from './PostCard';
import { FeedHydrationSkeleton, FeedRegionalBanner } from './FeedEngine';
import { safeFeedItemKey } from '../../lib/feedSafe';
import { ErrorBoundary } from '../common/ErrorBoundary';

const WINDOW_HEIGHT = Dimensions.get('window').height;

type SellerMasonryFeedProps = {
  posts: FeedPost[];
  userId: string;
  sellerShopId: string | null;
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  activePostKey: string | null;
  isRegionalFallback?: boolean;
  listHeader: ReactElement | null;
  extraDataKey: string;
  refreshControl?: any;
  scrollHandlers?: Record<string, any>;
  onRefresh?: () => void;
  onEndReached: () => void;
  onAdjustRadius?: () => void;
  onDeleted: (postId: string) => void;
  onViewableItemsChanged: RefObject<(({ viewableItems }: { viewableItems: ViewToken[] }) => void) | null> | ((info: { viewableItems: ViewToken[] }) => void);
  viewabilityConfig: { itemVisiblePercentThreshold: number };
  onRetry: () => void;
};

export function SellerMasonryFeed({
  posts,
  userId,
  sellerShopId,
  loading,
  loadingMore,
  refreshing,
  activePostKey,
  isRegionalFallback,
  listHeader,
  extraDataKey,
  refreshControl,
  scrollHandlers,
  onRefresh,
  onEndReached,
  onAdjustRadius,
  onDeleted,
  onViewableItemsChanged,
  viewabilityConfig,
  onRetry,
}: SellerMasonryFeedProps) {
  if (loading && posts.length === 0) {
    return (
      <View style={s.skeletonWrap} {...(scrollHandlers ?? {})}>
        {listHeader}
        <FeedHydrationSkeleton />
        <View style={s.masonrySkeletonRow}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={s.masonrySkeletonTile} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <ErrorBoundary onRefresh={onRetry}>
      <View style={{ flex: 1 }}>
        <FlashList
          data={posts}
          extraData={`${posts.length}-${extraDataKey}-${sellerShopId}-${activePostKey}`}
          keyExtractor={(item, index) => safeFeedItemKey(item, index)}
          numColumns={2}
          estimatedItemSize={300}
          drawDistance={WINDOW_HEIGHT * 2}
          onViewableItemsChanged={onViewableItemsChanged as any}
          viewabilityConfig={viewabilityConfig}
          {...(scrollHandlers ?? {})}
          renderItem={({ item }) => {
            if (!item?.id) return null;
            const isOwn = !!sellerShopId && item.shop_id === sellerShopId;
            return (
              <PostCard
                post={item}
                userId={userId}
                isBuyer={false}
                isSellerOwner={isOwn}
                layout="masonry"
                merchantMarket
                isMediaActive={
                  activePostKey == null
                  || activePostKey === (item.feed_item_id ?? item.id)
                }
                onDeleted={onDeleted}
              />
            );
          }}
          refreshControl={refreshControl}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color={Colors.orange} style={{ marginVertical: 16 }} />
              : null
          }
          ListHeaderComponent={
            <View>
              {Platform.OS === 'web' && onRefresh ? (
                <TouchableOpacity onPress={onRefresh} style={s.webRefresh} disabled={refreshing}>
                  <Text style={s.webRefreshText}>
                    {refreshing ? 'Refreshing…' : '↓ Tap to refresh market feed'}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {listHeader}
              {isRegionalFallback && onAdjustRadius ? (
                <FeedRegionalBanner onAdjustRadius={onAdjustRadius} />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Text style={s.emptyEmoji}>🛍️</Text>
              <Text style={s.emptyTitle}>No posts in your broadcast zone</Text>
              <Text style={s.emptyText}>
                Widen your target radius or pull down to refresh the local market feed.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          contentContainerStyle={{ paddingBottom: 80, paddingTop: 4, paddingHorizontal: 5 }}
        />
      </View>
    </ErrorBoundary>
  );
}

const s = createDynamicStyles((Colors) => ({
  skeletonWrap: { flex: 1, paddingBottom: 80, paddingTop: 4 },
  masonrySkeletonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    gap: 8,
    marginTop: 8,
  },
  masonrySkeletonTile: {
    width: '48%',
    height: 220,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  webRefresh: {
    alignSelf: 'center',
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  webRefreshText: {
    color: Colors.sub,
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  emptyTitle: {
    fontSize: 16,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.sub,
    textAlign: 'center',
    fontFamily: Fonts.bodySemiBold,
  },
}));
