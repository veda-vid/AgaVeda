// components/daily/DailyTile.tsx — Masonry tile with utility widgets & gradient fallbacks

import { View, Text, Pressable, StyleSheet, Platform, Animated, Alert } from 'react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import { heroImageFor, isHeroImageUsable, isRateWidgetVisual } from '../../lib/dailyPublicFeed';
import { DynamicNewsVisual } from './DynamicNewsVisual';
import { RateVisualCard } from './RateVisualCard';
import { categoryMeta, formatTimeAgo, liveStatusBadge, unicodeContentStyle } from './dailyShared';
import type { CityNews, DailyWidgetMeta } from '../../types';

export type DailyTileProps = {
  item: CityNews;
  width: number;
  height: number;
  saved?: boolean;
  onPress: (item: CityNews) => void;
  onLike: (item: CityNews) => void;
  onShare: (item: CityNews) => void;
  onSave: (item: CityNews) => void;
  onTogglePin?: (item: CityNews) => void;
};

type WeatherVisual = 'sunny' | 'cloudy' | 'rainy' | 'stormy';

export function tileHeightFor(item: CityNews, width: number) {
  if (item.widget?.kind === 'gold' || item.widget?.kind === 'silver' || item.widget?.kind === 'mandi') {
    return Math.round(width * 1.52);
  }
  if (item.media_type === 'video' || item.featured) return Math.round(width * 1.48);
  if (item.widget) return Math.round(width * 1.28);
  const hash = item.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const ratios = [0.95, 1.12, 1.28, 1.42, 1.58];
  return Math.round(width * ratios[hash % ratios.length]);
}

function isUsableUri(url?: string | null) {
  return isHeroImageUsable(url);
}

function shortTitle(title: string) {
  const clean = title.replace(/^[A-Za-z0-9\s]+?:\s*/, '').trim();
  return clean.length > 72 ? `${clean.slice(0, 69)}…` : clean;
}

function weatherVisualKind(widget?: DailyWidgetMeta | null): WeatherVisual {
  const code = widget?.weatherCode;
  if (code != null) {
    if (code >= 95) return 'stormy';
    if (code >= 80 || (code >= 51 && code <= 67)) return 'rainy';
    if (code === 0) return 'sunny';
    if (code <= 3) return 'cloudy';
    return 'cloudy';
  }
  const label = (widget?.condition || '').toLowerCase();
  if (/thunder|storm|severe/.test(label)) return 'stormy';
  if (/rain|shower|snow|drizzle/.test(label)) return 'rainy';
  if (/clear|sunny|fair/.test(label)) return 'sunny';
  return 'cloudy';
}

function movementTag(changePct: number) {
  const sign = changePct >= 0 ? '+' : '';
  const emoji = changePct >= 0 ? '🟢' : '🔴';
  return `${emoji} ${sign}${changePct.toFixed(1)}%`;
}

function LivePulseDot({ color = Colors.green }: { color?: string }) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={[ld.dot, { backgroundColor: color, opacity: pulse }]} />
  );
}

function LiveSpotBadge({ label }: { label: string }) {
  return (
    <View style={ld.wrap}>
      <LivePulseDot />
      <Text style={ld.text}>{label}</Text>
    </View>
  );
}

function ChangeBadge({ changePct }: { changePct?: number | null }) {
  if (changePct == null || Number.isNaN(changePct)) {
    return <LiveSpotBadge label="LIVE SPOT" />;
  }
  const up = changePct >= 0;
  return (
    <View style={[w.badge, up ? w.badgeUp : w.badgeDown]}>
      <Text style={[w.badgeText, up ? w.badgeTextUp : w.badgeTextDown]}>
        {movementTag(changePct)}
      </Text>
    </View>
  );
}

function WeatherGraphic({ kind }: { kind: WeatherVisual }) {
  const icons: Record<WeatherVisual, string> = {
    sunny: '☀️',
    cloudy: '☁️',
    rainy: '🌧️',
    stormy: '⛈️',
  };
  const tints: Record<WeatherVisual, string> = {
    sunny: 'rgba(251, 191, 36, 0.35)',
    cloudy: 'rgba(148, 163, 184, 0.28)',
    rainy: 'rgba(56, 189, 248, 0.28)',
    stormy: 'rgba(239, 68, 68, 0.25)',
  };
  return (
    <View style={wg.wrap} pointerEvents="none">
      <View style={[wg.glow, { backgroundColor: tints[kind] }]} />
      <Text style={wg.icon}>{icons[kind]}</Text>
      {kind === 'sunny' ? (
        <>
          <View style={[wg.ray, wg.ray1]} />
          <View style={[wg.ray, wg.ray2]} />
          <View style={[wg.ray, wg.ray3]} />
        </>
      ) : null}
      {kind === 'rainy' || kind === 'stormy' ? (
        <>
          <View style={[wg.drop, { left: '22%', top: '38%' }]} />
          <View style={[wg.drop, { left: '48%', top: '44%' }]} />
          <View style={[wg.drop, { left: '68%', top: '36%' }]} />
        </>
      ) : null}
    </View>
  );
}

function FrostedGlass({ children, style }: { children: ReactNode; style?: object }) {
  if (Platform.OS === 'web') {
    return (
      <View style={[fg.glass, style]}>
        {children}
      </View>
    );
  }
  return (
    <BlurView intensity={48} tint="dark" style={[fg.glass, style]}>
      {children}
    </BlurView>
  );
}

function WidgetFace({ widget, compact }: { widget: DailyWidgetMeta; compact?: boolean }) {
  const cadenceLabel = widget.cadence === 'weekly' ? 'WEEKLY' : 'LIVE SPOT';
  const updatedHint = widget.updatedAt
    ? new Date(widget.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  if (widget.kind === 'weather') {
    const visual = weatherVisualKind(widget);
    return (
      <FrostedGlass style={w.faceGlass}>
        <View style={[w.face, compact && w.faceCompact]}>
          <WeatherGraphic kind={visual} />
          <LiveSpotBadge label="LIVE SPOT" />
          <Text style={[w.bigValue, compact && w.bigValueSm]}>{widget.temp ?? '—'}°</Text>
          <Text style={w.faceLabel} numberOfLines={1}>{widget.condition || 'Weather'}</Text>
          {widget.label ? <Text style={w.faceSub} numberOfLines={1}>{widget.label}</Text> : null}
          {updatedHint ? <Text style={w.updatedHint}>{updatedHint}</Text> : null}
        </View>
      </FrostedGlass>
    );
  }

  if ((widget.kind === 'mandi' || widget.kind === 'gold' || widget.kind === 'silver' || widget.kind === 'fuel') && widget.items?.length) {
    return (
      <FrostedGlass style={w.faceGlass}>
        <View style={[w.face, compact && w.faceCompact]}>
          <View style={w.faceTop}>
            <LiveSpotBadge label={cadenceLabel} />
            {widget.changePct != null ? <ChangeBadge changePct={widget.changePct} /> : null}
          </View>
          <Text style={w.faceTitle} numberOfLines={1}>{widget.label || 'Rates'}</Text>
          {updatedHint ? <Text style={w.updatedHint}>{updatedHint}</Text> : null}
          {widget.items.slice(0, compact ? 5 : 10).map(row => (
            <View key={row.name} style={w.mandiRow}>
              <Text style={[w.mandiName, unicodeContentStyle]} numberOfLines={1}>{row.name}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={w.mandiPrice}>{row.price}</Text>
                {row.changePct != null && row.name !== 'Day change' ? (
                  <Text style={{ color: row.changePct >= 0 ? Colors.green : Colors.red, fontSize: 9, fontWeight: '800' }}>
                    {movementTag(row.changePct)}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </FrostedGlass>
    );
  }

  return (
    <FrostedGlass style={w.faceGlass}>
      <View style={[w.face, compact && w.faceCompact]}>
        <View style={w.faceTop}>
          <LiveSpotBadge label={widget.live === false ? 'SPOT' : 'LIVE SPOT'} />
          <ChangeBadge changePct={widget.changePct} />
        </View>
        <Text style={w.faceTitle} numberOfLines={1}>{widget.label || 'Rate'}</Text>
        <Text style={[w.bigValue, compact && w.bigValueSm]} numberOfLines={1}>
          {widget.value || '—'}
        </Text>
        {widget.unit ? <Text style={w.faceSub}>{widget.unit}</Text> : null}
        {updatedHint ? <Text style={w.updatedHint}>{updatedHint}</Text> : null}
      </View>
    </FrostedGlass>
  );
}

function MetallicBorder({
  kind,
  children,
  width,
  height,
}: {
  kind: 'gold' | 'silver';
  children: ReactNode;
  width: number;
  height: number;
}) {
  const colors = kind === 'gold'
    ? ['#FDE68A', '#F59E0B', '#B45309', '#FDE68A'] as const
    : ['#F8FAFC', '#CBD5E1', '#64748B', '#F8FAFC'] as const;
  return (
    <LinearGradient colors={[...colors]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[t.metalBorder, { width, height }]}>
      <View style={[t.metalInner, { width: width - 3, height: height - 3 }]}>
        {children}
      </View>
    </LinearGradient>
  );
}

export function DailyTile({
  item,
  width: wpx,
  height: hpx,
  saved = false,
  onPress,
  onLike,
  onShare,
  onSave,
  onTogglePin,
}: DailyTileProps) {
  const isVideo = item.media_type === 'video';
  const isRateVisual = isRateWidgetVisual(item);
  const isWidget = !!item.widget && (item.category === 'rates' || item.category === 'weather');
  const catBadge = liveStatusBadge(item);
  const topicSeed = item.widget?.condition
    ? `${item.title} ${item.widget.condition}`
    : item.title;
  const [attempt, setAttempt] = useState(0);
  const [imageFailed, setImageFailed] = useState(!isRateVisual && !isUsableUri(item.image_url));
  const [uri, setUri] = useState(heroImageFor(item, 0));
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const gradientOpacity = useRef(new Animated.Value(imageFailed ? 1 : 0)).current;
  const meta = categoryMeta(item.category);
  const showGradientFallback = imageFailed && !isWidget && !isRateVisual;

  useEffect(() => {
    setAttempt(0);
    const failed = !isRateVisual && !isUsableUri(item.image_url);
    setImageFailed(failed);
    setUri(heroImageFor(item, 0));
    imageOpacity.setValue(0);
    gradientOpacity.setValue(failed ? 1 : 0);
  }, [item.id, item.image_url, topicSeed]);

  const crossFadeToGradient = () => {
    Animated.parallel([
      Animated.timing(imageOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(gradientOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  };

  const onLoad = () => {
    Animated.parallel([
      Animated.timing(imageOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(gradientOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  };

  const onError = () => {
    const next = attempt + 1;
    if (next >= 2) {
      setImageFailed(true);
      crossFadeToGradient();
      return;
    }
    setAttempt(next);
    setUri(heroImageFor(item, next));
    imageOpacity.setValue(0);
  };

  const openMenu = () => {
    const pinLabel = saved ? 'Remove pin' : 'Save pin';
    const actions = [
      { text: pinLabel, onPress: () => (onTogglePin ? onTogglePin(item) : onSave(item)) },
      { text: 'Save to board…', onPress: () => onSave(item) },
      { text: 'Share', onPress: () => onShare(item) },
      { text: item.is_liked ? 'Unlike' : 'Like', onPress: () => onLike(item) },
      { text: 'Cancel', style: 'cancel' as const },
    ];
    Alert.alert(shortTitle(item.title), undefined, actions);
  };

  const goldBorder = item.widget?.kind === 'gold';
  const silverBorder = item.widget?.kind === 'silver';
  const scale = useSharedValue(1);
  const springStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const tileBody = (
    <Pressable
      onPress={() => onPress(item)}
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 14, stiffness: 320 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 280 }); }}
      style={[t.tile, { width: wpx, height: hpx }]}
    >
      <Reanimated.View style={[{ flex: 1 }, springStyle]}>
      <Animated.View style={[t.glassFallback, { opacity: gradientOpacity }]} pointerEvents="none">
        <View style={t.glassTop} />
        <View style={t.glassBottom} />
        <DynamicNewsVisual
          category={item.category}
          title={shortTitle(item.title)}
          badgeLabel={meta.label}
          isVideo={isVideo}
        />
      </Animated.View>

      {!showGradientFallback && !isRateVisual ? (
        <Animated.Image
          source={{ uri }}
          style={[t.media, { opacity: isWidget && !isRateVisual ? 0.42 : imageOpacity }]}
          resizeMode="cover"
          onLoad={onLoad}
          onError={onError}
        />
      ) : null}

      {!isWidget && !isRateVisual ? (
        <View pointerEvents="none" style={t.mediaVignette} />
      ) : null}

      {isRateVisual && item.widget ? (
        <RateVisualCard widget={item.widget} compact={hpx < wpx * 1.35} />
      ) : null}

      {isWidget && !isRateVisual ? (
        <View style={[
          t.widgetBg,
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

      {!isWidget && !isRateVisual ? <View pointerEvents="none" style={t.bottomScrim} /> : null}

      <View style={[t.catBadge, { borderColor: catBadge.accent }]} pointerEvents="none">
        {catBadge.pulse ? <LivePulseDot color={catBadge.accent} /> : null}
        <Text style={t.catBadgeText}>{catBadge.text}</Text>
      </View>

      {saved ? (
        <View style={[t.savedChip, t.savedChipBelowBadge]} pointerEvents="none">
          <Text style={t.savedChipText}>📌 Saved</Text>
        </View>
      ) : null}

      <Pressable
        style={t.dotsBtn}
        onPress={openMenu}
        hitSlop={10}
        accessibilityLabel="More options"
      >
        <Text style={t.dotsText}>···</Text>
      </Pressable>

      {isVideo && !isWidget ? (
        <View style={t.playChip}>
          <Text style={t.playChipText}>▶</Text>
        </View>
      ) : null}

      <View style={t.footer} pointerEvents="box-none">
        <View style={t.titleGlass}>
          <Text style={[t.title, unicodeContentStyle]} numberOfLines={2}>
            {isWidget && item.widget?.label ? item.widget.label : shortTitle(item.title)}
          </Text>
        </View>
        <Text style={t.metaRight}>{formatTimeAgo(item.created_at)}</Text>
      </View>
      </Reanimated.View>
    </Pressable>
  );

  if (goldBorder || silverBorder) {
    return (
      <MetallicBorder kind={goldBorder ? 'gold' : 'silver'} width={wpx} height={hpx}>
        {tileBody}
      </MetallicBorder>
    );
  }

  return tileBody;
}

const fg = StyleSheet.create({
  glass: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as object)
      : {}),
  },
});

const ld = createDynamicStyles((Colors) => ({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { color: Colors.orange, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
}));

const t = createDynamicStyles((Colors) => ({
  tile: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    position: 'relative',
  },
  metalBorder: {
    borderRadius: 17,
    padding: 1.5,
    overflow: 'hidden',
  },
  metalInner: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  media: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  glassFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
  },
  glassTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(120, 53, 15, 0.4)',
    ...(Platform.OS === 'web'
      ? ({ backgroundImage: 'linear-gradient(145deg, rgba(120,53,15,0.45) 0%, rgba(15,23,42,0.15) 55%)' } as object)
      : {}),
  },
  glassBottom: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    ...(Platform.OS === 'web'
      ? ({ backgroundImage: 'linear-gradient(180deg, transparent 0%, rgba(15,23,42,0.95) 72%)' } as object)
      : {}),
  },
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
    padding: 10,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  weatherBg: { backgroundColor: 'transparent' },
  ratesBg: { backgroundColor: 'transparent' },
  goldBg: { backgroundColor: 'transparent' },
  silverBg: { backgroundColor: 'transparent' },
  fuelBg: { backgroundColor: 'transparent' },
  savedChip: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 4,
  },
  savedChipBelowBadge: { top: 36 },
  savedChipText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  catBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as object)
      : {}),
  },
  catBadgeText: { color: Colors.white, fontSize: 9, fontWeight: '900' },
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
  titleGlass: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as object)
      : {}),
  },
  mediaVignette: {
    ...StyleSheet.absoluteFillObject,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 28%, transparent 55%, rgba(0,0,0,0.55) 100%)',
          backgroundColor: 'transparent',
        } as object)
      : { backgroundColor: 'rgba(0,0,0,0.12)' }),
    zIndex: 1,
  },
  title: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  metaRight: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '600',
  },
}));

const w = createDynamicStyles((Colors) => ({
  faceGlass: { flex: 1 },
  face: { flex: 1, justifyContent: 'flex-end', gap: 4, padding: 10, paddingBottom: 40 },
  faceCompact: { paddingBottom: 36 },
  faceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faceTitle: { color: Colors.white, fontSize: 13, fontWeight: '800', fontFamily: Fonts.bodySemiBold },
  faceLabel: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  faceSub: { color: 'rgba(226,232,240,0.85)', fontSize: 11 },
  updatedHint: { color: 'rgba(148,163,184,0.9)', fontSize: 9, fontWeight: '600', marginBottom: 2 },
  bigValue: {
    color: Colors.white,
    fontSize: 28,
    fontFamily: Fonts.displayXBold,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  bigValueSm: { fontSize: 22 },
  badge: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeUp: { backgroundColor: 'rgba(0, 200, 83, 0.22)', borderWidth: 1, borderColor: 'rgba(0, 200, 83, 0.45)' },
  badgeDown: { backgroundColor: 'rgba(255, 23, 68, 0.2)', borderWidth: 1, borderColor: 'rgba(255, 23, 68, 0.4)' },
  badgeText: { fontSize: 10, fontWeight: '800' },
  badgeTextUp: { color: Colors.green },
  badgeTextDown: { color: Colors.red },
  mandiRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  mandiName: { color: 'rgba(226,232,240,0.9)', fontSize: 11, flex: 1, fontWeight: '600' },
  mandiPrice: { color: Colors.white, fontSize: 11, fontWeight: '800' },
}));

const wg = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  icon: { fontSize: 34 },
  ray: {
    position: 'absolute',
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: 'rgba(251, 191, 36, 0.55)',
  },
  ray1: { top: 4, transform: [{ rotate: '0deg' }] },
  ray2: { top: 10, right: 8, transform: [{ rotate: '45deg' }] },
  ray3: { top: 10, left: 8, transform: [{ rotate: '-45deg' }] },
  drop: {
    position: 'absolute',
    width: 3,
    height: 8,
    borderRadius: 2,
    backgroundColor: 'rgba(125, 211, 252, 0.75)',
  },
});
