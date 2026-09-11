// components/daily/LocalNewsFeed.tsx — Hyper-local news cards with image fallbacks

import { useMemo, useState } from 'react';
import {
  View, Text, Image, Pressable, useWindowDimensions,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { DynamicNewsVisual } from './DynamicNewsVisual';
import { formatTimeAgo, unicodeContentStyle } from './dailyShared';
import { classifyNewsPill } from '../../services/dailyApi';
import { heroImageFor, isHeroImageUsable } from '../../lib/dailyPublicFeed';
import type { CityNews } from '../../types';

type Props = {
  city: string;
  items: CityNews[];
  loading?: boolean;
  onPressItem: (item: CityNews) => void;
};

function NewsCard({
  item,
  width,
  index,
  onPress,
}: {
  item: CityNews;
  width: number;
  index: number;
  onPress: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pill = classifyNewsPill(item);
  const uri = heroImageFor(item, attempt);
  const showImage = !imgFailed && isHeroImageUsable(uri);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 40, 240)).springify()}>
      <Pressable style={[s.card, { width }]} onPress={onPress}>
        <View style={s.media}>
          {showImage ? (
            <Image
              source={{ uri: uri! }}
              style={s.thumb}
              onError={() => {
                if (attempt < 2) setAttempt(a => a + 1);
                else setImgFailed(true);
              }}
            />
          ) : (
            <DynamicNewsVisual
              category={item.category}
              title={item.title}
              badgeLabel={pill}
              isVideo={item.media_type === 'video'}
            />
          )}
          <View style={s.pill}>
            <Text style={s.pillText}>{pill}</Text>
          </View>
        </View>
        <View style={s.body}>
          <Text style={[s.title, unicodeContentStyle]} numberOfLines={2}>{item.title}</Text>
          <Text style={[s.summary, unicodeContentStyle]} numberOfLines={2}>{item.body}</Text>
          <View style={s.meta}>
            <Text style={s.metaText} numberOfLines={1}>📍 {item.city}</Text>
            <Text style={s.metaDot}>·</Text>
            <Text style={s.metaText}>{formatTimeAgo(item.created_at)}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function SkeletonCard({ width }: { width: number }) {
  return (
    <View style={[s.card, { width }]}>
      <View style={[s.media, s.skelMedia]} />
      <View style={s.body}>
        <View style={s.skelLine} />
        <View style={[s.skelLine, { width: '70%', marginTop: 8 }]} />
      </View>
    </View>
  );
}

export function LocalNewsFeed({ city, items, loading, onPressItem }: Props) {
  const { width } = useWindowDimensions();
  const gap = 10;
  const pad = 16;
  const colW = (width - pad * 2 - gap) / 2;

  const rows = useMemo(() => {
    const left: CityNews[] = [];
    const right: CityNews[] = [];
    items.forEach((item, i) => {
      (i % 2 === 0 ? left : right).push(item);
    });
    return { left, right };
  }, [items]);

  return (
    <View style={s.section}>
      <View style={s.head}>
        <Text style={s.heading}>Local News</Text>
        <Text style={s.sub}>Stories near {city || 'you'}</Text>
      </View>

      {loading && !items.length ? (
        <View style={s.columns}>
          <View style={s.col}>
            <SkeletonCard width={colW} />
            <SkeletonCard width={colW} />
          </View>
          <View style={s.col}>
            <SkeletonCard width={colW} />
            <SkeletonCard width={colW} />
          </View>
        </View>
      ) : !items.length ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No local stories yet</Text>
          <Text style={s.emptyText}>Pull to refresh or try another city.</Text>
        </View>
      ) : (
        <View style={s.columns}>
          <View style={s.col}>
            {rows.left.map((item, i) => (
              <NewsCard
                key={item.id}
                item={item}
                width={colW}
                index={i * 2}
                onPress={() => onPressItem(item)}
              />
            ))}
          </View>
          <View style={s.col}>
            {rows.right.map((item, i) => (
              <NewsCard
                key={item.id}
                item={item}
                width={colW}
                index={i * 2 + 1}
                onPress={() => onPressItem(item)}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  section: {
    marginTop: 18,
    paddingHorizontal: 16,
  },
  head: { marginBottom: 12 },
  heading: {
    fontSize: 18,
    fontFamily: Fonts.display,
    fontWeight: '800',
    color: Colors.text,
  },
  sub: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.sub,
  },
  columns: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  col: { flex: 1, gap: 10 },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  media: {
    height: 128,
    backgroundColor: Colors.card,
    overflow: 'hidden',
  },
  thumb: { width: '100%', height: '100%' },
  pill: {
    position: 'absolute',
    left: 8,
    top: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.2,
  },
  body: { padding: 10 },
  title: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 19,
  },
  summary: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.sub,
    lineHeight: 16,
  },
  meta: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: { fontSize: 11, color: Colors.dim, flexShrink: 1 },
  metaDot: { fontSize: 11, color: Colors.dim },
  empty: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  emptyText: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.sub,
  },
  skelMedia: { backgroundColor: Colors.card },
  skelLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.card,
    width: '100%',
  },
}));
