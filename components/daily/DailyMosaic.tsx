// components/daily/DailyMosaic.tsx — Authentic Pinterest masonry for Daily

import { View, Text, TouchableOpacity, StyleSheet, Platform, Animated, Alert } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Colors, Fonts, Radius } from '../../constants/theme';
import { getTopicImageUrl } from '../../lib/dailyPublicFeed';
import type { CityNews, CityNewsCategory, DailyWidgetMeta } from '../../types';

export type DailyFilterId = 'all' | 'pins' | CityNewsCategory;

export const DAILY_CATEGORIES: Array<{ id: DailyFilterId; label: string; emoji: string }> = [
  { id: 'all', label: 'All', emoji: '📰' },
  { id: 'general', label: 'Top', emoji: '🔥' },
  { id: 'alerts', label: 'Alerts', emoji: '🚨' },
  { id: 'event', label: 'Events', emoji: '📍' },
  { id: 'weather', label: 'Weather', emoji: '⛅' },
  { id: 'rates', label: 'Rates', emoji: '💹' },
  { id: 'pins', label: 'Pins', emoji: '📌' },
];

/** System-safe text for Hindi / English Unicode content (avoids branded font glyph gaps). */
export const unicodeContentStyle = Platform.select({
  web: {
    fontFamily: 'system-ui, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", sans-serif',
  } as object,
  default: {
    // Native: omit custom family so OS fonts with Devanagari apply
    fontFamily: undefined,
  },
});

export function categoryMeta(category: CityNewsCategory) {
  return DAILY_CATEGORIES.find(item => item.id === category) ?? { id: category, label: category, emoji: '📰' };
}

export function formatTimeAgo(value: string) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (Number.isNaN(seconds) || seconds < 0) return 'now';
  if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function shortTitle(title: string) {
  const clean = title.replace(/^[A-Za-z0-9\s]+?:\s*/, '').trim();
  return clean.length > 72 ? `${clean.slice(0, 69)}…` : clean;
}

function ChangeBadge({ changePct }: { changePct?: number | null }) {
  if (changePct == null || Number.isNaN(changePct)) {
    return (
      <View style={[w.badge, w.badgeNeutral]}>
        <Text style={w.badgeText}>LIVE</Text>
      </View>
    );
  }
  const up = changePct >= 0;
  return (
    <View style={[w.badge, up ? w.badgeUp : w.badgeDown]}>
      <Text style={w.badgeText}>{up ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%</Text>
    </View>
  );
}

function WidgetFace({ widget, compact }: { widget: DailyWidgetMeta; compact?: boolean }) {
  if (widget.kind === 'weather') {
    return (
      <View style={[w.face, compact && w.faceCompact]}>
        <Text style={w.livePill}>LIVE</Text>
        <Text style={[w.bigValue, compact && w.bigValueSm]}>{widget.temp ?? '—'}°</Text>
        <Text style={w.faceLabel} numberOfLines={1}>{widget.condition || 'Weather'}</Text>
        {widget.label ? <Text style={w.faceSub} numberOfLines={1}>{widget.label}</Text> : null}
      </View>
    );
  }

  if ((widget.kind === 'mandi' || widget.kind === 'gold' || widget.kind === 'silver' || widget.kind === 'fuel') && widget.items?.length) {
    return (
      <View style={[w.face, compact && w.faceCompact]}>
        <View style={w.faceTop}>
          <Text style={w.livePill}>
            {widget.cadence === 'weekly' ? 'WEEKLY' : widget.live ? 'LIVE' : 'RATES'}
          </Text>
          {widget.changePct != null ? <ChangeBadge changePct={widget.changePct} /> : null}
        </View>
        <Text style={w.faceTitle} numberOfLines={1}>{widget.label || 'Rates'}</Text>
        {widget.items.slice(0, compact ? 5 : 10).map(row => (
          <View key={row.name} style={w.mandiRow}>
            <Text style={[w.mandiName, unicodeContentStyle]} numberOfLines={1}>{row.name}</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={w.mandiPrice}>{row.price}</Text>
              {row.changePct != null && row.name !== 'Day change' ? (
                <Text style={{ color: row.changePct >= 0 ? Colors.green : Colors.red, fontSize: 9, fontWeight: '800' }}>
                  {row.changePct >= 0 ? '+' : ''}{row.changePct.toFixed(2)}%
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={[w.face, compact && w.faceCompact]}>
      <View style={w.faceTop}>
        <Text style={w.livePill}>{widget.live === false ? 'SPOT' : 'LIVE'}</Text>
        <ChangeBadge changePct={widget.changePct} />
      </View>
      <Text style={w.faceTitle} numberOfLines={1}>{widget.label || 'Rate'}</Text>
      <Text style={[w.bigValue, compact && w.bigValueSm]} numberOfLines={1}>
        {widget.value || '—'}
      </Text>
      {widget.unit ? <Text style={w.faceSub}>{widget.unit}</Text> : null}
    </View>
  );
}

type TileProps = {
  item: CityNews;
  width?: number;
  height?: number;
  masonry?: boolean;
  onPress: (item: CityNews) => void;
  onLike: (item: CityNews) => void;
  onShare: (item: CityNews) => void;
  onSave: (item: CityNews) => void;
};

function tileHeightFor(item: CityNews, width: number) {
  if (item.widget?.kind === 'gold' || item.widget?.kind === 'silver' || item.widget?.kind === 'mandi') {
    return Math.round(width * 1.52);
  }
  if (item.media_type === 'video' || item.featured) return Math.round(width * 1.48);
  if (item.widget) return Math.round(width * 1.28);
  const hash = item.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  // Pinterest mobile: tall / medium / short stagger
  const ratios = [0.95, 1.12, 1.28, 1.42, 1.58];
  return Math.round(width * ratios[hash % ratios.length]);
}

function isUsableUri(url?: string | null) {
  return !!(
    url
    && /^https?:\/\//i.test(url)
    && !/placehold|picsum\.photos|source\.unsplash/i.test(url)
  );
}

export function DailyTile({
  item, width, height, masonry, onPress, onLike, onShare, onSave,
}: TileProps) {
  const isVideo = item.media_type === 'video';
  const isWidget = !!item.widget && (item.category === 'rates' || item.category === 'weather');
  const topicSeed = item.widget?.condition
    ? `${item.title} ${item.widget.condition}`
    : item.title;
  const [attempt, setAttempt] = useState(0);
  const [uri, setUri] = useState(
    isUsableUri(item.image_url)
      ? item.image_url!
      : getTopicImageUrl(item.category, topicSeed, 0),
  );
  const opacity = useRef(new Animated.Value(0)).current;
  const wpx = width || 200;
  const hpx = height || tileHeightFor(item, wpx);

  // #region agent log
  useEffect(() => {
    if (!item.id) return;
    // Log first pin structure only (avoid spam) — ids starting live:weather or first general
    const shouldLog = item.featured || item.widget?.kind === 'gold' || item.category === 'general';
    if (!shouldLog) return;
    fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9be6ad' },
      body: JSON.stringify({
        sessionId: '9be6ad',
        runId: 'pre-fix',
        hypothesisId: 'D',
        location: 'DailyMosaic.tsx:DailyTile',
        message: 'pin chrome structure',
        data: {
          id: item.id.slice(0, 32),
          masonry: !!masonry,
          wpx,
          hpx,
          borderRadius: 16,
          captionOverImage: true,
          captionBelowImage: false,
          hasDotsMenu: true,
          isWidget,
          platform: Platform.OS,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }, [item.id, masonry, wpx, hpx, isWidget]);
  // #endregion

  useEffect(() => {
    setAttempt(0);
    setUri(
      isUsableUri(item.image_url)
        ? item.image_url!
        : getTopicImageUrl(item.category, topicSeed, 0),
    );
    opacity.setValue(0);
  }, [item.id, item.image_url, topicSeed]);

  const onLoad = () => {
    Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  };

  const onError = () => {
    const next = attempt + 1;
    setAttempt(next);
    setUri(getTopicImageUrl(item.category, topicSeed, next));
    opacity.setValue(0);
  };

  const openMenu = () => {
    Alert.alert(shortTitle(item.title), undefined, [
      { text: 'Save', onPress: () => onSave(item) },
      { text: 'Share', onPress: () => onShare(item) },
      { text: item.is_liked ? 'Unlike' : 'Like', onPress: () => onLike(item) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const goldBorder = item.widget?.kind === 'gold';
  const silverBorder = item.widget?.kind === 'silver';

  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      activeOpacity={0.94}
      style={[
        t.tile,
        masonry ? t.masonryItem : { width: wpx, height: hpx },
        goldBorder && t.goldBorder,
        silverBorder && t.silverBorder,
      ]}
    >
      <Animated.Image
        source={{ uri }}
        style={[
          t.media,
          masonry ? ({ height: hpx, width: '100%', position: 'relative' } as object) : null,
          { opacity: isWidget ? 0.42 : opacity },
        ]}
        resizeMode="cover"
        onLoad={onLoad}
        onError={onError}
      />

      {isWidget ? (
        <View style={[
          t.widgetBg,
          masonry && StyleSheet.absoluteFillObject,
          item.category === 'weather' ? t.weatherBg
            : item.widget?.kind === 'fuel' ? t.fuelBg
              : item.widget?.kind === 'gold' ? t.goldBg
                : item.widget?.kind === 'silver' ? t.silverBg
                  : t.ratesBg,
        ]}
        >
          <WidgetFace widget={item.widget!} compact={hpx < wpx * 1.35} />
        </View>
      ) : null}

      {!isWidget ? (
        <View
          pointerEvents="none"
          style={[
            t.bottomScrim,
            masonry && { position: 'absolute' as const, left: 0, right: 0, bottom: 0 },
          ]}
        />
      ) : null}

      {/* Pinterest-style three-dot menu */}
      <TouchableOpacity
        style={t.dotsBtn}
        onPress={openMenu}
        hitSlop={10}
        accessibilityLabel="More options"
      >
        <Text style={t.dotsText}>···</Text>
      </TouchableOpacity>

      {isVideo && !isWidget ? (
        <View style={t.playChip}>
          <Text style={t.playChipText}>▶</Text>
        </View>
      ) : null}

      {/* Minimal bottom caption */}
      <View
        style={[t.footer, masonry && { position: 'absolute' as const }]}
        pointerEvents="box-none"
      >
        <Text style={[t.title, unicodeContentStyle]} numberOfLines={2}>
          {isWidget && item.widget?.label ? item.widget.label : shortTitle(item.title)}
        </Text>
        <Text style={t.metaRight}>{formatTimeAgo(item.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

type MosaicProps = {
  items: CityNews[];
  gap?: number;
  contentWidth: number;
  onPress: (item: CityNews) => void;
  onLike: (item: CityNews) => void;
  onShare: (item: CityNews) => void;
  onSave: (item: CityNews) => void;
};

/**
 * Authentic Pinterest masonry:
 * Mobile-first 2-column stagger; 3 columns on wide screens.
 */
export function DailyMosaic({
  items,
  gap = 8,
  contentWidth,
  onPress,
  onLike,
  onShare,
  onSave,
}: MosaicProps) {
  const tileProps = { onPress, onLike, onShare, onSave };
  const cols = contentWidth >= 900 ? 3 : 2;
  const colWidth = Math.floor((contentWidth - gap * (cols - 1)) / cols);
  const layoutMode = Platform.OS === 'web' ? 'web-css-columns' : 'native-height-pack';

  // #region agent log
  useEffect(() => {
    const sampleHeights = items.slice(0, 6).map(item => ({
      id: item.id.slice(0, 24),
      h: tileHeightFor(item, colWidth),
      ratio: Number((tileHeightFor(item, colWidth) / Math.max(1, colWidth)).toFixed(2)),
      kind: item.widget?.kind || item.category,
      hasImage: !!item.image_url,
    }));
    const uniqueRatios = Array.from(new Set(sampleHeights.map(s => s.ratio)));
    fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9be6ad' },
      body: JSON.stringify({
        sessionId: '9be6ad',
        runId: 'pre-fix',
        hypothesisId: 'A',
        location: 'DailyMosaic.tsx:DailyMosaic',
        message: 'masonry layout decision',
        data: {
          platform: Platform.OS,
          layoutMode,
          contentWidth,
          cols,
          colWidth,
          gap,
          itemCount: items.length,
          uniqueRatios,
          sampleHeights,
          webUsesColumnCount: layoutMode === 'web-css-columns',
          // RN Web Views default to flex — columns CSS often ignored unless display:block
          suspectedFlexConflict: Platform.OS === 'web',
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }, [items, contentWidth, cols, colWidth, gap, layoutMode]);
  // #endregion

  if (Platform.OS === 'web') {
    return (
      <View
        // #region agent log
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '9be6ad' },
            body: JSON.stringify({
              sessionId: '9be6ad',
              runId: 'pre-fix',
              hypothesisId: 'B',
              location: 'DailyMosaic.tsx:webContainer.onLayout',
              message: 'web masonry container measured',
              data: {
                measuredW: w,
                measuredH: h,
                expectedCols: cols,
                // If height ≈ sum of all tile heights, columns likely collapsed to 1 stack
                approxSingleColH: items.slice(0, 8).reduce((a, it) => a + tileHeightFor(it, colWidth) + gap, 0),
                itemCount: items.length,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
        }}
        // #endregion
        style={{
          width: contentWidth,
          ...({ columnCount: cols, columnGap: gap } as object),
        }}
      >
        {items.map(item => (
          <DailyTile
            key={item.id}
            item={item}
            masonry
            width={colWidth}
            {...tileProps}
          />
        ))}
      </View>
    );
  }

  const columns: CityNews[][] = Array.from({ length: cols }, () => []);
  const heights = Array.from({ length: cols }, () => 0);
  for (const item of items) {
    let shortest = 0;
    for (let i = 1; i < cols; i += 1) {
      if (heights[i] < heights[shortest]) shortest = i;
    }
    columns[shortest].push(item);
    heights[shortest] += tileHeightFor(item, colWidth) + gap;
  }

  return (
    <View style={{ width: contentWidth, flexDirection: 'row', alignItems: 'flex-start', gap }}>
      {columns.map((col, ci) => (
        <View key={`col-${ci}`} style={{ width: colWidth, gap }}>
          {col.map(item => (
            <DailyTile
              key={item.id}
              item={item}
              width={colWidth}
              height={tileHeightFor(item, colWidth)}
              {...tileProps}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const t = StyleSheet.create({
  tile: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    position: 'relative',
    marginBottom: 8,
  },
  masonryItem: {
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({ breakInside: 'avoid', display: 'inline-block' } as object)
      : {}),
  },
  media: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 88,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.72) 100%)',
          backgroundColor: 'transparent',
        } as object)
      : { backgroundColor: 'rgba(0,0,0,0.45)' }),
    zIndex: 1,
  },
  widgetBg: {
    ...StyleSheet.absoluteFillObject,
    padding: 12,
    justifyContent: 'flex-end',
    backgroundColor: '#000000AA',
  },
  weatherBg: { backgroundColor: '#0B1F33CC' },
  ratesBg: { backgroundColor: '#14101FCC' },
  goldBg: { backgroundColor: 'rgba(245, 158, 11, 0.14)' },
  silverBg: { backgroundColor: 'rgba(148, 163, 184, 0.14)' },
  fuelBg: { backgroundColor: '#0F1A14CC' },
  goldBorder: {
    borderWidth: 1.5,
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
  silverBorder: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  dotsBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  dotsText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: -4,
  },
  playChip: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 3,
  },
  playChipText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  footer: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  title: {
    flex: 1,
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 3,
  },
  metaRight: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '600',
  },
});

const w = StyleSheet.create({
  face: { flex: 1, justifyContent: 'flex-end', gap: 4, paddingBottom: 40 },
  faceCompact: { paddingBottom: 36 },
  faceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  livePill: {
    alignSelf: 'flex-start',
    color: Colors.orange,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  faceTitle: { color: Colors.text, fontSize: 13, fontWeight: '800', fontFamily: Fonts.bodySemiBold },
  faceLabel: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  faceSub: { color: Colors.sub, fontSize: 11 },
  bigValue: {
    color: Colors.white,
    fontSize: 28,
    fontFamily: Fonts.displayXBold,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  bigValueSm: { fontSize: 22 },
  badge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeUp: { backgroundColor: '#00C85333' },
  badgeDown: { backgroundColor: '#FF174433' },
  badgeNeutral: { backgroundColor: '#448AFF33' },
  badgeText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  mandiRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  mandiName: { color: Colors.sub, fontSize: 11, flex: 1, fontWeight: '600' },
  mandiPrice: { color: Colors.white, fontSize: 11, fontWeight: '800' },
});
