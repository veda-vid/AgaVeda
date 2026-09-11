// components/daily/DailyMosaic.tsx — High-performance Pinterest masonry (MasonryFlashList)

import { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { MasonryFlashList, type MasonryListRenderItemInfo } from '@shopify/flash-list';
import { Colors, createDynamicStyles } from '../../constants/theme';
import { DailyTile, tileHeightFor } from './DailyTile';
import type { CityNews } from '../../types';

export { DAILY_CATEGORIES, DAILY_REGIONS, unicodeContentStyle, formatTimeAgo, formatCityDisplay, localRegionTabLabel, categoryMeta } from './dailyShared';
export type { DailyFilterId, DailyRegion } from './dailyShared';
export { tileHeightFor } from './DailyTile';

type MosaicProps = {
  items: CityNews[];
  gap?: number;
  contentWidth: number;
  listHeight: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  scrollHandlers?: {
    onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
    scrollEventThrottle?: number;
  };
  ListHeaderComponent?: React.ReactElement | null;
  isSaved: (newsId: string) => boolean;
  onPress: (item: CityNews) => void;
  onLike: (item: CityNews) => void;
  onShare: (item: CityNews) => void;
  onSave: (item: CityNews) => void;
  onTogglePin: (item: CityNews) => void;
};

export function DailyMosaic({
  items,
  gap = 8,
  contentWidth,
  listHeight,
  refreshing = false,
  onRefresh,
  scrollHandlers,
  ListHeaderComponent,
  isSaved,
  onPress,
  onLike,
  onShare,
  onSave,
  onTogglePin,
}: MosaicProps) {
  const numColumns = contentWidth >= 900 ? 3 : 2;
  const colWidth = Math.floor((contentWidth - gap * (numColumns - 1)) / numColumns);

  const layoutHeights = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.id, tileHeightFor(item, colWidth));
    }
    return map;
  }, [items, colWidth]);

  const overrideItemLayout = useCallback((
    layout: { span?: number; size?: number },
    item: CityNews,
  ) => {
    layout.span = 1;
    layout.size = layoutHeights.get(item.id) ?? tileHeightFor(item, colWidth);
  }, [layoutHeights, colWidth]);

  const renderItem = useCallback(({ item }: MasonryListRenderItemInfo<CityNews>) => {
    const height = layoutHeights.get(item.id) ?? tileHeightFor(item, colWidth);
    return (
      <View style={{ width: colWidth, marginBottom: gap }}>
        <DailyTile
            item={item}
            width={colWidth}
            height={height}
            saved={isSaved(item.id)}
            onPress={onPress}
            onLike={onLike}
            onShare={onShare}
            onSave={onSave}
            onTogglePin={onTogglePin}
          />
      </View>
    );
  }, [
    colWidth,
    gap,
    isSaved,
    layoutHeights,
    onLike,
    onPress,
    onSave,
    onShare,
    onTogglePin,
  ]);

  if (!items.length) {
    return (
      <View style={s.emptyState}>
        <Text style={s.emptyEmoji}>📰</Text>
        <Text style={s.emptyTitle}>No Daily stories yet</Text>
        <Text style={s.emptyText}>Pull to refresh or try another category.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, height: listHeight, width: contentWidth, alignSelf: 'center' }}>
      <MasonryFlashList
        data={items}
        keyExtractor={item => item.id}
        numColumns={numColumns}
        estimatedItemSize={280}
        optimizeItemArrangement
        overrideItemLayout={overrideItemLayout}
        renderItem={renderItem}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onScroll={scrollHandlers?.onScroll}
        scrollEventThrottle={scrollHandlers?.scrollEventThrottle ?? 16}
        ListHeaderComponent={ListHeaderComponent ?? undefined}
        contentContainerStyle={{
          paddingHorizontal: 8,
          paddingBottom: 100,
        }}
        drawDistance={480}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        extraData={`${colWidth}-${items.length}-${items[0]?.id ?? ''}`}
      />
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8, paddingHorizontal: 24 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { color: Colors.sub, fontSize: 16, fontWeight: '700' },
  emptyText: { color: Colors.dim, fontSize: 13, textAlign: 'center' },
}));
