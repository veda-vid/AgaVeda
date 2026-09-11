// components/daily/PinterestArticleView.tsx — InShorts English reader + floating action bar

import { useMemo, useRef, useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, StyleSheet,
  Linking, Platform, Animated, PanResponder, Dimensions,
} from 'react-native';
import { SafeVideoPlayer } from '../media/SafeVideoPlayer';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import { buildInShortsContent, heroImageFor, isRateWidgetVisual } from '../../lib/dailyPublicFeed';
import { RateVisualCard } from './RateVisualCard';
import { categoryMeta, formatTimeAgo, unicodeContentStyle } from './dailyShared';
import type { CityNews } from '../../types';

type Props = {
  item: CityNews;
  onLikeToggle: () => void;
  onShare: () => void;
  onRepost: () => void;
  onComment: () => void;
  onSave: () => void;
  onTogglePin?: () => void;
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
  return heroImageFor(item, attempt);
}

function publisherInitial(item: CityNews) {
  const label = publisherLabel(item);
  return label.charAt(0).toUpperCase();
}

function trendLabel(trend7d?: number | null) {
  if (trend7d == null || Number.isNaN(trend7d)) return '—';
  const arrow = trend7d >= 0 ? '▲' : '▼';
  const sign = trend7d >= 0 ? '+' : '';
  return `${arrow} ${sign}${Math.abs(trend7d).toFixed(1)}%`;
}

function CommodityTable({ item }: { item: CityNews }) {
  const rows = item.widget?.items ?? [];
  if (!rows.length) return null;
  const isMetal = item.widget?.kind === 'gold' || item.widget?.kind === 'silver';
  const isMandi = item.widget?.kind === 'mandi';
  const showFullTable = isMetal || isMandi || item.widget?.kind === 'fuel' || item.widget?.kind === 'index';

  if (!showFullTable) {
    return (
      <View style={[
        s.rateBox,
        item.widget?.kind === 'gold' && s.rateGold,
        item.widget?.kind === 'silver' && s.rateSilver,
      ]}
      >
        <Text style={s.rateLabel}>{item.widget?.label}</Text>
        {rows.map(row => (
          <View key={row.name} style={s.rateRow}>
            <Text style={[s.rateName, unicodeContentStyle]}>{row.name}</Text>
            <View style={s.rateRight}>
              <Text style={s.ratePrice}>{row.price}</Text>
                      {row.changePct != null ? (
                        <Text style={[s.chg, row.changePct >= 0 ? s.chgUp : s.chgDown]}>
                          {row.changePct >= 0 ? '▲' : '▼'} {row.changePct >= 0 ? '+' : ''}{Math.abs(row.changePct).toFixed(1)}%
                        </Text>
                      ) : null}
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={[
      s.rateBox,
      item.widget?.kind === 'gold' && s.rateGold,
      item.widget?.kind === 'silver' && s.rateSilver,
    ]}
    >
      <View style={s.tableHeader}>
        <Text style={s.rateLabel}>{item.widget?.label}</Text>
        {item.widget?.updatedAt ? (
          <Text style={s.updatedBadge}>
            {item.widget.cadence === 'weekly' ? 'WEEKLY' : 'LIVE'} · {formatTimeAgo(item.widget.updatedAt)}
          </Text>
        ) : null}
      </View>
      <View style={s.tableHeadRow}>
        <Text style={[s.tableHead, s.colName]}>Commodity</Text>
        <Text style={[s.tableHead, s.colPrice]}>Current price</Text>
        <Text style={[s.tableHead, s.colTrend]}>7-day trend</Text>
      </View>
      {rows.filter(row => row.name !== 'Day change').map(row => (
        <View key={row.name} style={s.tableRow}>
          <Text style={[s.tableCell, s.colName, unicodeContentStyle]} numberOfLines={2}>{row.name}</Text>
          <Text style={[s.tableCell, s.colPrice, s.ratePrice]}>{row.price}</Text>
          <Text style={[
            s.tableCell,
            s.colTrend,
            (row.trend7d ?? row.changePct ?? 0) >= 0 ? s.chgUp : s.chgDown,
          ]}
          >
            {trendLabel(row.trend7d ?? row.changePct)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function PinterestArticleView({
  item,
  onLikeToggle,
  onShare,
  onRepost,
  onComment,
  onSave,
  onTogglePin,
  onClose,
  saved = false,
}: Props) {
  const meta = categoryMeta(item.category);
  const isVideo = item.media_type === 'video' && !!item.image_url;
  const isRateHero = isRateWidgetVisual(item);
  const [heroAttempt, setHeroAttempt] = useState(0);
  const [heroUri, setHeroUri] = useState(heroFor(item, 0));
  const [videoMuted, setVideoMuted] = useState(true);
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
            {isVideo ? (
              <TouchableOpacity
                style={s.hero}
                activeOpacity={0.95}
                onPress={() => setVideoMuted(prev => !prev)}
                accessibilityLabel={videoMuted ? 'Unmute video' : 'Mute video'}
              >
                <SafeVideoPlayer
                  uri={item.image_url!}
                  posterUri={heroUri}
                  style={s.hero}
                  contentFit="cover"
                  active
                  loop
                  muted={videoMuted}
                />
                <View style={s.videoOverlay}>
                  <Text style={s.videoMuteChip}>{videoMuted ? 'Tap to unmute' : 'Sound on'}</Text>
                </View>
              </TouchableOpacity>
            ) : isRateHero && item.widget ? (
              <RateVisualCard widget={item.widget} />
            ) : (
              <Image source={{ uri: heroUri }} style={s.hero} resizeMode="cover" onError={onHeroError} />
            )}
            <View style={s.heroTop}>
              <View style={s.publisherBadge}>
                <View style={s.publisherLogo}>
                  <Text style={s.publisherLogoText}>{publisherInitial(item)}</Text>
                </View>
                <Text style={s.publisherText}>{publisherLabel(item)}</Text>
              </View>
              <Text style={s.timeBadge}>{formatTimeAgo(item.created_at)}</Text>
            </View>
            <TouchableOpacity onPress={onShare} style={s.shareFab} accessibilityLabel="Share story">
              <Text style={s.shareFabText}>✈️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={s.closeFab}>
              <Text style={s.closeFabText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={s.body}>
            <View style={s.catPill}>
              <Text style={s.catPillText}>{meta.emoji} {meta.label}</Text>
            </View>
            <Text style={[s.headline, unicodeContentStyle]}>{headline}</Text>

            {item.widget?.items?.length ? <CommodityTable item={item} /> : null}

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
          <TouchableOpacity
            style={s.actionBtn}
            onPress={onTogglePin ?? onSave}
            accessibilityLabel={saved ? 'Saved' : 'Save'}
          >
            <Text style={s.actionIcon}>{saved ? '📌' : '＋'}</Text>
            <Text style={[s.actionLabel, saved && s.actionLabelSaved]}>
              {saved ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
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
  videoOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: '#00000099',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  videoMuteChip: { color: Colors.white, fontSize: 11, fontWeight: '800' },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#000000BB',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '72%',
  },
  publisherLogo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publisherLogoText: { color: Colors.white, fontSize: 11, fontWeight: '900' },
  publisherText: { color: Colors.white, fontSize: 11, fontWeight: '800', flexShrink: 1 },
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
  shareFab: {
    position: 'absolute',
    top: 12,
    right: 56,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00000099',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareFabText: { fontSize: 16 },
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
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rateLabel: { color: Colors.orange, fontWeight: '900', fontSize: 11, letterSpacing: 0.5, flex: 1 },
  updatedBadge: { color: Colors.sub, fontSize: 10, fontWeight: '700' },
  tableHeadRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border2,
    paddingBottom: 6,
    marginBottom: 2,
  },
  tableHead: { color: Colors.dim, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  tableCell: { fontSize: 12 },
  colName: { flex: 2.4 },
  colPrice: { flex: 1.6, textAlign: 'right' },
  colTrend: { flex: 1.2, textAlign: 'right', fontWeight: '800' },
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
  actionLabelSaved: { color: Colors.orange },
}));
