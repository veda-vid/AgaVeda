// components/daily/PinterestArticleView.tsx — InShorts English reader + floating action bar

import { useMemo, useRef, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet,
  Linking, Platform, Animated, PanResponder, Dimensions,
} from 'react-native';
import { Colors, Fonts, Radius } from '../../constants/theme';
import { buildInShortsContent, getTopicImageUrl } from '../../lib/dailyPublicFeed';
import { categoryMeta, formatTimeAgo, unicodeContentStyle } from './DailyMosaic';
import type { CityNews } from '../../types';

type Props = {
  item: CityNews;
  onLikeToggle: () => void;
  onShare: () => void;
  onRepost: () => void;
  onComment: () => void;
  onSave: () => void;
  onClose: () => void;
  saved?: boolean;
};

function publisherLabel(item: CityNews) {
  try {
    if (item.source_url) return new URL(item.source_url).hostname.replace(/^www\./, '');
  } catch { /* noop */ }
  return item.city || 'Daily';
}

function heroFor(item: CityNews, attempt = 0) {
  if (
    attempt === 0
    && item.image_url
    && /^https?:\/\//i.test(item.image_url)
    && !/placehold|picsum\.photos|source\.unsplash/i.test(item.image_url)
  ) {
    return item.image_url;
  }
  return getTopicImageUrl(item.category, item.title, attempt);
}

export function PinterestArticleView({
  item,
  onLikeToggle,
  onShare,
  onRepost,
  onComment,
  onSave,
  onClose,
  saved = false,
}: Props) {
  const meta = categoryMeta(item.category);
  const [heroAttempt, setHeroAttempt] = useState(0);
  const [heroUri, setHeroUri] = useState(heroFor(item, 0));
  const translateY = useRef(new Animated.Value(0)).current;

  const { headline, summary, takeaways } = useMemo(
    () => buildInShortsContent({
      title: item.title,
      body: item.body,
      city: item.city,
      category: item.category,
      created_at: item.created_at,
    }),
    [item.title, item.body, item.city, item.category, item.created_at],
  );

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 1.1) {
          Animated.timing(translateY, { toValue: Dimensions.get('window').height, duration: 180, useNativeDriver: true })
            .start(() => onClose());
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  const onHeroError = () => {
    const next = heroAttempt + 1;
    setHeroAttempt(next);
    setHeroUri(heroFor(item, next));
  };

  const openFull = () => {
    if (item.source_url) void Linking.openURL(item.source_url);
  };

  return (
    <View style={s.root}>
      <TouchableOpacity style={s.blurBg} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={[s.card, { transform: [{ translateY }] }]}
        {...pan.panHandlers}
      >
        <View style={s.swipeHint} />
        <ScrollView showsVerticalScrollIndicator={false} bounces contentContainerStyle={s.scroll}>
          <View style={s.heroWrap}>
            <Image source={{ uri: heroUri }} style={s.hero} resizeMode="cover" onError={onHeroError} />
            <View style={s.heroTop}>
              <View style={s.publisherBadge}>
                <Text style={s.publisherText}>{publisherLabel(item)}</Text>
              </View>
              <Text style={s.timeBadge}>{formatTimeAgo(item.created_at)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.closeFab}>
              <Text style={s.closeFabText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={s.body}>
            <View style={s.catPill}>
              <Text style={s.catPillText}>{meta.emoji} {meta.label}</Text>
            </View>
            <Text style={[s.headline, unicodeContentStyle]}>{headline}</Text>

            {item.widget?.items?.length ? (
              <View style={[
                s.rateBox,
                item.widget.kind === 'gold' && s.rateGold,
                item.widget.kind === 'silver' && s.rateSilver,
              ]}
              >
                <Text style={s.rateLabel}>{item.widget.label}</Text>
                {item.widget.items.map(row => (
                  <View key={row.name} style={s.rateRow}>
                    <Text style={[s.rateName, unicodeContentStyle]}>{row.name}</Text>
                    <View style={s.rateRight}>
                      <Text style={s.ratePrice}>{row.price}</Text>
                      {row.changePct != null ? (
                        <Text style={[s.chg, row.changePct >= 0 ? s.chgUp : s.chgDown]}>
                          {row.changePct >= 0 ? '+' : ''}{row.changePct.toFixed(2)}%
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={s.section}>Summary</Text>
            <Text style={[s.summary, unicodeContentStyle]}>{summary}</Text>

            <Text style={s.section}>Key takeaways</Text>
            {takeaways.map((point, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={s.bullet}>•</Text>
                <Text style={[s.bulletText, unicodeContentStyle]}>{point}</Text>
              </View>
            ))}

            {item.source_url ? (
              <TouchableOpacity style={s.readLink} onPress={openFull}>
                <Text style={s.readLinkText}>Read full story →</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </ScrollView>

        <View style={s.actionBar}>
          <TouchableOpacity style={s.actionBtn} onPress={onLikeToggle} accessibilityLabel="Like">
            <Text style={s.actionIcon}>{item.is_liked ? '❤️' : '🤍'}</Text>
            <Text style={s.actionCount}>{item.total_likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={onComment} accessibilityLabel="Comment">
            <Text style={s.actionIcon}>💬</Text>
            <Text style={s.actionLabel}>Comment</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={onShare} accessibilityLabel="Share">
            <Text style={s.actionIcon}>✈️</Text>
            <Text style={s.actionLabel}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={onRepost} accessibilityLabel="Repost">
            <Text style={s.actionIcon}>🔁</Text>
            <Text style={s.actionLabel}>Repost</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionBtn} onPress={onSave} accessibilityLabel="Save">
            <Text style={s.actionIcon}>{saved ? '📌' : '＋'}</Text>
            <Text style={s.actionLabel}>Save</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  blurBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000AA',
    // @ts-expect-error web
    backdropFilter: Platform.OS === 'web' ? 'blur(12px)' : undefined,
  },
  card: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '94%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  swipeHint: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border2,
    marginTop: 8,
    marginBottom: 4,
  },
  scroll: { paddingBottom: 100 },
  heroWrap: { width: '100%', height: 280, backgroundColor: Colors.card },
  hero: { width: '100%', height: '100%' },
  heroTop: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  publisherBadge: {
    backgroundColor: '#000000BB',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  publisherText: { color: Colors.white, fontSize: 11, fontWeight: '800' },
  timeBadge: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#00000088',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  closeFab: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00000099',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeFabText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  body: { padding: 18, gap: 6 },
  catPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF572222',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  catPillText: { color: Colors.orange, fontSize: 11, fontWeight: '800' },
  headline: {
    color: Colors.text,
    fontSize: 24,
    fontFamily: Fonts.displayXBold,
    fontWeight: '900',
    lineHeight: 30,
    letterSpacing: -0.3,
    marginTop: 6,
  },
  rateBox: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 6,
    backgroundColor: Colors.card,
    borderColor: Colors.border2,
  },
  rateGold: {
    borderColor: '#F59E0B66',
    backgroundColor: '#F59E0B0D',
  },
  rateSilver: {
    borderColor: '#CBD5E166',
    backgroundColor: '#94A3B80D',
  },
  rateLabel: { color: Colors.orange, fontWeight: '900', fontSize: 11, letterSpacing: 0.5 },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  rateName: { color: Colors.sub, fontSize: 13, flex: 1 },
  rateRight: { alignItems: 'flex-end' },
  ratePrice: { color: Colors.text, fontWeight: '800', fontSize: 13 },
  chg: { fontSize: 11, fontWeight: '800' },
  chgUp: { color: Colors.green },
  chgDown: { color: Colors.red },
  section: { color: Colors.text, fontWeight: '800', fontSize: 14, marginTop: 14 },
  summary: { color: Colors.sub, fontSize: 15, lineHeight: 23, marginTop: 4 },
  bulletRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  bullet: { color: Colors.orange, fontWeight: '900' },
  bulletText: { color: Colors.sub, flex: 1, fontSize: 14, lineHeight: 20 },
  readLink: { marginTop: 18, marginBottom: 8 },
  readLinkText: { color: Colors.orange, fontWeight: '800', fontSize: 14 },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionBtn: { alignItems: 'center', minWidth: 52, paddingHorizontal: 4, flex: 1 },
  actionIcon: { fontSize: 22 },
  actionCount: { color: Colors.sub, fontSize: 10, fontWeight: '700', marginTop: 2 },
  actionLabel: { color: Colors.sub, fontSize: 9, fontWeight: '700', marginTop: 2 },
});
