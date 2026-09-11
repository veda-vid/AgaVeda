// components/services/ServiceDetail.tsx

import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet, Linking, Image, TouchableOpacity, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getReviews, addReview, getServiceProviderById, refreshTargetRating, computeRatingFromReviews } from '../../lib/api';
import {
  CAT_TINT, buildWhatsAppUrl, canChatWithPro, getPresenceDisplay, getProCategoryLabel,
  hexAlpha, unicodeProsStyle,
} from '../../lib/prosUtils';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import type { Review, ServiceProvider } from '../../types';
import {
  CategoryIcon, IconPhone, IconPin, IconStar, PresenceBadge, ScalePressable, StarRow, VerifiedMark,
} from './ServiceIcons';
import { ImageZoomModal } from './ImageZoomModal';

type ServiceDetailProps = {
  svc: ServiceProvider;
  userId: string;
  onClose: () => void;
  onProviderUpdate: (svc: ServiceProvider) => void;
  onChat: (svc: ServiceProvider) => void;
  onRequest: (svc: ServiceProvider) => void;
};

function openProLocation(svc: ServiceProvider) {
  if (svc.lat != null && svc.lng != null) {
    void Linking.openURL(`https://maps.google.com/?q=${svc.lat},${svc.lng}`);
    return;
  }
  const query = svc.area_served?.trim() || svc.city?.trim();
  if (query) {
    void Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(query)}`);
    return;
  }
  Alert.alert('Location unavailable', 'This professional has not shared a service location yet.');
}

export function ServiceDetail({
  svc: initialSvc, userId, onClose, onProviderUpdate, onChat, onRequest,
}: ServiceDetailProps) {
  const router = useRouter();
  const [svc, setSvc] = useState(initialSvc);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [zoomUri, setZoomUri] = useState<string | null>(null);
  const tint = CAT_TINT[svc.category] ?? Colors.orange;
  const chatEnabled = canChatWithPro(svc);
  const waUrl = buildWhatsAppUrl(svc.whatsapp, `Hi ${svc.business_name}, I found you on CityConnect and need help with a job.`);
  const portfolio = svc.portfolio_photos ?? [];
  const isOwnListing = svc.profile_id === userId;

  useEffect(() => { setSvc(initialSvc); }, [initialSvc]);
  useEffect(() => {
    getReviews(svc.id, 'service_provider')
      .then(rows => {
        setReviews(rows);
        const mine = rows.find(r => r.reviewer_id === userId);
        if (mine) {
          setMyRating(mine.rating);
          setSubmitted(true);
        } else {
          setSubmitted(false);
        }
      })
      .catch(() => setReviews([]));
  }, [svc.id, userId]);

  const submitReview = async () => {
    if (!myComment.trim()) {
      Alert.alert('Add a short review', 'Write a brief comment with your star rating.');
      return;
    }
    setPosting(true);
    try {
      const r = await addReview({
        reviewer_id: userId,
        target_id: svc.id,
        target_type: 'service_provider',
        rating: myRating,
        comment: myComment.trim(),
      });

      // Merge: replace previous review from this user if they re-rated
      setReviews(prev => {
        const withoutMine = prev.filter(item => item.reviewer_id !== userId && item.id !== r.id);
        return [r, ...withoutMine];
      });

      // Optimistic local average from the reviews list we just updated
      const nextList = (() => {
        const withoutMine = reviews.filter(item => item.reviewer_id !== userId && item.id !== r.id);
        return [r, ...withoutMine];
      })();
      const local = computeRatingFromReviews(nextList);
      setSvc(prev => ({
        ...prev,
        avg_rating: local.avg_rating,
        total_reviews: local.total_reviews,
      }));
      onProviderUpdate({
        ...svc,
        avg_rating: local.avg_rating,
        total_reviews: local.total_reviews,
      });

      setMyComment('');
      setSubmitted(true);

      // Authoritative refresh from DB aggregates
      const stats = await refreshTargetRating(svc.id, 'service_provider');
      const updated = await getServiceProviderById(svc.id);
      const merged = {
        ...updated,
        avg_rating: Number(updated.avg_rating) || stats.avg_rating,
        total_reviews: Number(updated.total_reviews) || stats.total_reviews,
      };
      setSvc(merged);
      onProviderUpdate(merged);
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'Could not save your rating. Please try again.';
      Alert.alert('Rating failed', message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <ScrollView style={d.root} showsVerticalScrollIndicator={false}>
      <View style={d.handle} />
      <Pressable onPress={onClose} style={d.closeBtn} hitSlop={10}>
        <Text style={d.closeText}>✕</Text>
      </Pressable>

      <View style={d.header}>
        <View style={[d.bigAvatar, { backgroundColor: hexAlpha(tint, '22') }]}>
          <CategoryIcon id={svc.category} size={36} color={tint} />
          <View style={[d.onlineDot, { backgroundColor: getPresenceDisplay(svc).dotColor }]} />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={d.nameCluster}>
            <Text style={[d.name, unicodeProsStyle]}>{svc.business_name}</Text>
            {svc.is_verified ? <VerifiedMark size={18} /> : null}
          </View>
          <Text style={[d.catLabel, { color: tint }, unicodeProsStyle]}>{getProCategoryLabel(svc)}</Text>
          <PresenceBadge svc={svc} />
          <StarRow rating={Number(svc.avg_rating)} size={14} />
        </View>
      </View>

      <View style={d.statsRow}>
        {([
          [Number(svc.avg_rating).toFixed(1), 'Rating'],
          [String(svc.total_reviews), 'Reviews'],
          [String(svc.total_jobs), 'Jobs'],
          [`${svc.experience_years} yr`, 'Experience'],
        ] as const).map(([v, l]) => (
          <View key={l} style={d.stat}>
            <Text style={d.statVal}>{v}</Text>
            <Text style={d.statLabel}>{l}</Text>
          </View>
        ))}
      </View>

      {svc.base_rate_label ? (
        <View style={d.rateSection}>
          <Text style={d.sectionTitle}>Base Rate</Text>
          <View style={d.rateBadge}>
            <Text style={[d.rateBadgeText, unicodeProsStyle]}>🏷️ {svc.base_rate_label}</Text>
          </View>
        </View>
      ) : null}

      <View style={d.bioSection}>
        <Text style={d.sectionTitle}>About This Pro</Text>
        {svc.description?.trim() ? (
          <Text style={[d.desc, unicodeProsStyle]}>{svc.description}</Text>
        ) : (
          <Text style={d.descEmpty}>No description provided yet.</Text>
        )}
        <Text style={[d.experienceLine, unicodeProsStyle]}>
          {svc.experience_years} year{svc.experience_years === 1 ? '' : 's'} of professional experience
        </Text>
      </View>

      {portfolio.length > 0 ? (
        <View style={d.portfolioSection}>
          <Text style={d.sectionTitle}>Work Portfolio ({portfolio.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={d.portfolioRail}>
            {portfolio.map(uri => (
              <TouchableOpacity key={uri} onPress={() => setZoomUri(uri)} activeOpacity={0.9}>
                <Image source={{ uri }} style={d.portfolioThumb} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={d.portfolioHint}>Tap a photo to view full screen</Text>
        </View>
      ) : null}

      <View style={d.areaRow}>
        <IconPin color={Colors.sub} />
        <Text style={[d.area, unicodeProsStyle]}>
          Serves {svc.area_served}
          {svc.coverage_radius_km ? ` · within ${svc.coverage_radius_km} km` : ''}
        </Text>
      </View>

      <View style={d.ctaStack}>
        {isOwnListing ? (
          <ScalePressable
            style={d.manageBtn}
            onPress={() => {
              onClose();
              router.push('/pro/settings' as any);
            }}
          >
            <Text style={d.manageBtnText}>🛠️ Manage My Listing</Text>
          </ScalePressable>
        ) : (
          <>
            <ScalePressable style={d.callBtn} onPress={() => Linking.openURL(`tel:${svc.phone}`)}>
              <IconPhone size={16} color={Colors.white} />
              <Text style={d.callBtnText}>📞 Call Pro</Text>
            </ScalePressable>
            <ScalePressable style={d.requestBtn} onPress={() => onRequest(svc)}>
              <Text style={d.requestBtnText}>💬 Send Quote Request</Text>
            </ScalePressable>
          </>
        )}
        <ScalePressable style={d.locationBtn} onPress={() => openProLocation(svc)}>
          <IconPin color={Colors.text} size={16} />
          <Text style={d.locationBtnText}>📍 Location</Text>
        </ScalePressable>
      </View>

      {!isOwnListing && chatEnabled ? (
        <ScalePressable
          style={d.chatBtn}
          onPress={() => onChat(svc)}
        >
          <Text style={d.chatBtnText}>Open In-App Chat</Text>
        </ScalePressable>
      ) : null}

      {!isOwnListing && waUrl ? (
        <ScalePressable style={d.waBtn} onPress={() => Linking.openURL(waUrl)}>
          <Text style={d.waBtnText}>💬 WhatsApp</Text>
        </ScalePressable>
      ) : null}

      {!isOwnListing && !submitted && (
        <View style={d.reviewForm}>
          <Text style={d.sectionTitle}>Write a Review</Text>
          <View style={d.starsRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <Pressable key={n} onPress={() => setMyRating(n)} hitSlop={6}>
                <IconStar size={28} color={n <= myRating ? Colors.amber : Colors.border2} />
              </Pressable>
            ))}
          </View>
          <TextInput
            value={myComment}
            onChangeText={setMyComment}
            placeholder="Share your experience…"
            placeholderTextColor={Colors.dim}
            multiline
            numberOfLines={3}
            style={[d.reviewInput, unicodeProsStyle]}
          />
          <ScalePressable style={d.submitBtn} onPress={() => void submitReview()} disabled={posting}>
            <Text style={d.submitBtnText}>{posting ? 'Posting…' : 'Submit Review'}</Text>
          </ScalePressable>
        </View>
      )}
      {!isOwnListing && submitted ? (
        <View style={d.successBox}>
          <Text style={d.successText}>Thanks — your rating is live on this pro’s profile.</Text>
          <ScalePressable
            style={d.updateRatingBtn}
            onPress={() => {
              setSubmitted(false);
              const mine = reviews.find(r => r.reviewer_id === userId);
              if (mine) {
                setMyRating(mine.rating);
                setMyComment(mine.comment || '');
              }
            }}
          >
            <Text style={d.updateRatingText}>Update my rating</Text>
          </ScalePressable>
        </View>
      ) : null}
      {isOwnListing ? (
        <Text style={d.ownHint}>This is your listing. Use Manage My Listing to update skills and rates.</Text>
      ) : null}

      <Text style={d.sectionTitle}>Reviews ({svc.total_reviews})</Text>
      {reviews.length === 0 ? (
        <Text style={d.noReviews}>No reviews yet. Be the first!</Text>
      ) : (
        reviews.map(r => (
          <View key={r.id} style={d.reviewCard}>
            <View style={d.reviewHeader}>
              <Text style={[d.reviewUser, unicodeProsStyle]}>{r.reviewer?.name ?? 'User'}</Text>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {Array.from({ length: r.rating }).map((_, i) => (
                  <IconStar key={i} size={11} color={Colors.amber} />
                ))}
              </View>
            </View>
            <Text style={[d.reviewText, unicodeProsStyle]}>{r.comment}</Text>
          </View>
        ))
      )}
      <View style={{ height: 40 }} />
      <ImageZoomModal visible={!!zoomUri} uri={zoomUri} onClose={() => setZoomUri(null)} />
    </ScrollView>
  );
}

const d = createDynamicStyles((Colors) => ({
  root: {},
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', alignSelf: 'center', marginBottom: 16, opacity: 0.65 },
  closeBtn: { position: 'absolute', right: 0, top: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  closeText: { color: Colors.sub, fontSize: 14, fontWeight: '700' },
  header: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 16, marginTop: 8 },
  bigAvatar: { width: 70, height: 70, borderRadius: 20, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  onlineDot: { position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: Colors.surface },
  nameCluster: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  name: { fontSize: 20, fontFamily: Fonts.displayXBold, fontWeight: '800', color: Colors.text, flexShrink: 1 },
  catLabel: { fontSize: 13, fontFamily: Fonts.bodySemiBold, fontWeight: '600' },
  rateSection: { marginBottom: 14 },
  rateBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.orange + '20',
    borderWidth: 1.5,
    borderColor: Colors.orange + '55',
  },
  rateBadgeText: { fontSize: 14, fontWeight: '800', color: Colors.orange },
  bioSection: { marginBottom: 14 },
  desc: { fontSize: 14, fontFamily: Fonts.body, color: Colors.sub, lineHeight: 21 },
  descEmpty: { fontSize: 13, fontFamily: Fonts.body, color: Colors.dim, fontStyle: 'italic' },
  experienceLine: { marginTop: 8, fontSize: 13, fontFamily: Fonts.bodySemiBold, color: Colors.text, fontWeight: '600' },
  portfolioSection: { marginBottom: 14 },
  portfolioRail: { gap: 10, paddingRight: 8 },
  portfolioThumb: {
    width: 112,
    height: 112,
    borderRadius: Radius.md,
    backgroundColor: Colors.border,
  },
  portfolioHint: { marginTop: 8, fontSize: 11, color: Colors.dim },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  stat: { flex: 1, backgroundColor: Colors.bg, borderRadius: 16, padding: 12, alignItems: 'center' },
  statVal: { fontSize: 20, fontFamily: Fonts.displayXBold, fontWeight: '800', color: Colors.orange },
  statLabel: { fontSize: 10, fontFamily: Fonts.body, color: Colors.sub, marginTop: 2 },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  area: { flex: 1, fontSize: 13, fontFamily: Fonts.body, color: Colors.sub },
  ctaStack: { gap: 10, marginBottom: 10 },
  callBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.green, borderRadius: 14, paddingVertical: 14 },
  callBtnText: { color: Colors.white, fontFamily: Fonts.bodySemiBold, fontWeight: '800', fontSize: 15 },
  requestBtn: { backgroundColor: Colors.orange, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  requestBtnText: { color: Colors.white, fontFamily: Fonts.bodySemiBold, fontWeight: '800', fontSize: 15 },
  manageBtn: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.orange,
  },
  manageBtnText: { color: Colors.orange, fontFamily: Fonts.bodySemiBold, fontWeight: '800', fontSize: 15 },
  ownHint: {
    textAlign: 'center',
    color: Colors.dim,
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 17,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 14,
    paddingVertical: 13,
  },
  locationBtnText: { color: Colors.text, fontFamily: Fonts.bodySemiBold, fontWeight: '700', fontSize: 14 },
  chatBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: hexAlpha(Colors.blue, '18'), borderWidth: 1, borderColor: hexAlpha(Colors.blue, '44'), borderRadius: 14, paddingVertical: 13, marginBottom: 10 },
  chatBtnText: { color: Colors.blue, fontFamily: Fonts.bodySemiBold, fontWeight: '700', fontSize: 14 },
  waBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: hexAlpha(Colors.green, '18'), borderWidth: 1, borderColor: hexAlpha(Colors.green, '44'), borderRadius: 14, paddingVertical: 13, marginBottom: 20 },
  waBtnText: { color: Colors.green, fontFamily: Fonts.bodySemiBold, fontWeight: '700', fontSize: 14 },
  sectionTitle: { fontSize: 16, fontFamily: Fonts.bodySemiBold, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  reviewForm: { backgroundColor: Colors.bg, borderRadius: 16, padding: 16, marginBottom: 16 },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  reviewInput: { backgroundColor: Colors.card, borderRadius: 12, padding: 12, color: Colors.text, fontSize: 14, fontFamily: Fonts.body, minHeight: 80, marginBottom: 12, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: Colors.orange, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  submitBtnText: { color: Colors.white, fontFamily: Fonts.bodySemiBold, fontWeight: '700', fontSize: 14 },
  successBox: { backgroundColor: hexAlpha(Colors.green, '22'), borderRadius: 12, padding: 14, marginBottom: 16 },
  updateRatingBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  updateRatingText: { color: Colors.orange, fontWeight: '800', fontSize: 13 },
  successText: { color: Colors.green, fontFamily: Fonts.bodySemiBold, fontWeight: '600', textAlign: 'center' },
  noReviews: { color: Colors.dim, textAlign: 'center', paddingVertical: 20, fontFamily: Fonts.body },
  reviewCard: { backgroundColor: Colors.bg, borderRadius: 14, padding: 12, marginBottom: 10 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reviewUser: { fontFamily: Fonts.bodySemiBold, fontWeight: '700', color: Colors.text, fontSize: 13 },
  reviewText: { fontSize: 13, fontFamily: Fonts.body, color: Colors.sub, lineHeight: 18 },
}));
