// app/(tabs)/services.tsx — Pros: verified local service discovery
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, ActivityIndicator,
  Linking, ScrollView, StyleSheet, Animated, Pressable, Modal, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAuthStore } from '../../stores/authStore';
import {
  getServicesNearby, getReviews, addReview, getServiceProviderById,
  getOrCreateProConversation, getProMessages, sendProMessage, touchServiceProviderActivity,
} from '../../lib/api';
import { supabase } from '../../lib/supabase';
import {
  canChatWithPro, getPresenceDisplay, getProCategoryLabel, otherFilterLabel, parseProsFilter,
} from '../../lib/prosUtils';
import { useScreenRefresh } from '../../hooks/useScreenRefresh';
import { Colors, Fonts, SERVICE_CATEGORIES, OTHER_SERVICE_SUBCATEGORIES, Shadow } from '../../constants/theme';
import type { ProMessage, ServiceProvider } from '../../types';

const MAIN_FILTERS = [
  { id: 'all', label: 'All' },
  ...SERVICE_CATEGORIES.filter(c => c.id !== 'other'),
];

const CAT_TINT: Record<string, string> = {
  all: Colors.orange,
  plumber: Colors.orange,
  electrician: Colors.amber,
  ac_technician: Colors.blue,
  painter: Colors.purple,
  cleaning: Colors.green,
  gardening: Colors.green,
  security: Colors.blue,
  carpenter: Colors.amber,
  pest_control: Colors.purple,
  other: Colors.orange,
};

function hexAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

function CategoryIcon({ id, size = 16, color }: { id: string; size?: number; color: string }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24' as const };
  switch (id) {
    case 'plumber':
      return (
        <Svg {...props}>
          <Path d="M14.7 6.3a5 5 0 0 0-7.1 7.1l-2.6 2.6 1.4 1.4 2.6-2.6a5 5 0 0 0 7.1-7.1Zm-6.2 6.2a3 3 0 1 1 4.2-4.2 3 3 0 0 1-4.2 4.2Z" fill={color} />
        </Svg>
      );
    case 'electrician':
      return (
        <Svg {...props}>
          <Path d="M13 2 4 14h7l-1 8 10-14h-7l0-6Z" fill={color} />
        </Svg>
      );
    case 'ac_technician':
      return (
        <Svg {...props}>
          <Path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Circle cx="12" cy="12" r="3" fill={color} />
        </Svg>
      );
    case 'painter':
      return (
        <Svg {...props}>
          <Path d="M5 20c0-3 3-4 5-6 2 0 4 1 6-1 2-2 1-5-1-7s-5-3-7-1c-2 2-1 5 1 7-2 2-5 3-5 6H5Z" fill={color} />
        </Svg>
      );
    case 'cleaning':
      return (
        <Svg {...props}>
          <Path d="M12 2 9.8 7.4 4 8.3l4.4 3.8L7.2 18 12 15.2 16.8 18l-1.2-5.9L20 8.3l-5.8-.9L12 2Z" fill={color} />
        </Svg>
      );
    case 'gardening':
      return (
        <Svg {...props}>
          <Path d="M12 21V11c0-5 7-7 7-7s-1 8-7 8c0-6-7-8-7-8s7 2 7 7v10Z" fill={color} />
        </Svg>
      );
    case 'security':
      return (
        <Svg {...props}>
          <Path d="M12 2 4 6v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-4Z" fill={color} />
        </Svg>
      );
    case 'carpenter':
      return (
        <Svg {...props}>
          <Path d="M8 3 5 6l3 3-4 4 2 2 4-4 3 3 3-3-7-8Zm8.5 9.5-2 2 6 6 2-2-6-6Z" fill={color} />
        </Svg>
      );
    case 'pest_control':
      return (
        <Svg {...props}>
          <Path d="M12 7a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0v-6a4 4 0 0 1 4-4Zm-7 5h3M16 12h3M7 8l2 2M17 8l-2 2M7 18l2-2M17 18l-2-2M12 4V2" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
        </Svg>
      );
    case 'all':
      return (
        <Svg {...props}>
          <Path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" fill={color} />
        </Svg>
      );
    default:
      return (
        <Svg {...props}>
          <Path d="M4 8h16l-1.5 11H5.5L4 8Zm4-4h8l1 4H7l1-4Z" fill={color} />
        </Svg>
      );
  }
}

function IconSearch({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="6.5" stroke={color} strokeWidth={2} />
      <Path d="M16 16l5 5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function IconPhone({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M7.1 3.6c.4-.5 1.1-.6 1.6-.3l2.5 1.1c.5.2.8.8.7 1.3l-.5 2.4c-.1.4-.3.7-.7.9l-1.5.8a12.2 12.2 0 0 0 5.4 5.4l.8-1.5c.2-.4.5-.6.9-.7l2.4-.5c.6-.1 1.1.2 1.3.7l1.1 2.5c.3.6.2 1.2-.3 1.6l-1.3 1.2c-.5.4-1.1.6-1.8.6C11.6 19.1 4.9 12.4 4.9 4.9c0-.7.2-1.3.6-1.8l1.6-1.3Z"
        fill={color}
      />
    </Svg>
  );
}

function IconStar({ color, size = 16, filled = true }: { color: string; size?: number; filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3.2 14.6 9l6.2.6-4.7 4.1 1.4 6.1L12 16.8 6.5 19.8l1.4-6.1L3.2 9.6 9.4 9 12 3.2Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={filled ? 0 : 1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function IconPin({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12Zm0-9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" fill={color} />
    </Svg>
  );
}

function IconBriefcase({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M9 6V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1h5a2 2 0 0 1 2 2v3H2V8a2 2 0 0 1 2-2h5Zm-7 7h20v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5Z" fill={color} />
    </Svg>
  );
}

function IconClock({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 10.4 3.2 1.9-.8 1.4L11 13V7h2v5.4Z" fill={color} />
    </Svg>
  );
}

function VerifiedMark({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Circle cx="8" cy="8" r="8" fill={Colors.orange} />
      <Path d="M4.4 8.2 6.7 10.4 11.6 5.6" stroke={Colors.white} strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconChat({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H6a2 2 0 0 1-2-2V5Z"
        fill={color}
      />
    </Svg>
  );
}

function PresenceBadge({ svc }: { svc: ServiceProvider }) {
  const presence = getPresenceDisplay(svc);
  return (
    <View style={[s.availBadge, { backgroundColor: hexAlpha(presence.color, '22') }]}>
      <View style={[s.availDot, { backgroundColor: presence.dotColor }]} />
      <Text style={[s.availText, { color: presence.color }]} numberOfLines={1}>
        {presence.label}
      </Text>
    </View>
  );
}

function ScalePressable({
  children,
  onPress,
  style,
  containerStyle,
  pressedScale = 0.97,
  hoverScale = 1.02,
  disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: object;
  containerStyle?: object;
  pressedScale?: number;
  hoverScale?: number;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      friction: 8,
      tension: 160,
    }).start();
  };

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => animate(pressedScale)}
      onPressOut={() => animate(1)}
      onHoverIn={() => animate(hoverScale)}
      onHoverOut={() => animate(1)}
      style={[containerStyle, Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null]}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

function StarRow({ rating, size = 13 }: { rating: number; size?: number }) {
  const filled = Math.round(rating);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <IconStar key={n} size={size} color={n <= filled ? Colors.amber : Colors.border2} />
      ))}
      <Text style={s.starValue}>{rating.toFixed(1)}</Text>
    </View>
  );
}

function ServiceCard({
  svc,
  onSelect,
  onChat,
}: {
  svc: ServiceProvider;
  onSelect: (s: ServiceProvider) => void;
  onChat: (s: ServiceProvider) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      friction: 7,
      tension: 150,
    }).start();
  };

  const tint = CAT_TINT[svc.category] ?? Colors.orange;
  const catLabel = getProCategoryLabel(svc);
  const chatEnabled = canChatWithPro(svc);
  const presence = getPresenceDisplay(svc);

  return (
    <Animated.View style={[s.cardLift, { transform: [{ scale }] }]}>
      <View style={s.card}>
        <View style={[s.cardAccent, { backgroundColor: tint }]} />

        <Pressable
          onPress={() => onSelect(svc)}
          onPressIn={() => animate(0.985)}
          onPressOut={() => animate(1)}
          onHoverIn={() => animate(1.012)}
          onHoverOut={() => animate(1)}
          style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : undefined}
        >
          <View style={s.cardBody}>
            <View style={s.cardTop}>
              <View style={[s.avatarWrap, { backgroundColor: hexAlpha(tint, '22') }]}>
                <CategoryIcon id={svc.category} size={28} color={tint} />
                <View style={[s.onlineDot, { backgroundColor: presence.dotColor }]} />
              </View>

              <View style={s.cardMeta}>
                <View style={s.nameRow}>
                  <View style={s.nameCluster}>
                    <Text style={s.name} numberOfLines={1}>{svc.business_name}</Text>
                    {svc.is_verified ? <VerifiedMark /> : null}
                  </View>
                  <PresenceBadge svc={svc} />
                </View>

                <Text style={[s.catText, { color: tint }]}>{catLabel}</Text>
              </View>
            </View>

            <View style={s.statsRow}>
              <View style={s.statCell}>
                <IconClock color={Colors.sub} />
                <Text style={s.statValue}>{svc.experience_years} yrs</Text>
                <Text style={s.statLabel}>Experience</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statCell}>
                <IconBriefcase color={Colors.sub} />
                <Text style={s.statValue}>{svc.total_jobs}</Text>
                <Text style={s.statLabel}>Jobs</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statCell}>
                <IconStar size={14} color={Colors.amber} />
                <Text style={s.statValue}>{Number(svc.avg_rating).toFixed(1)}</Text>
                <Text style={s.statLabel}>{svc.total_reviews} reviews</Text>
              </View>
            </View>

            <View style={s.areaRow}>
              <IconPin color={Colors.sub} />
              <Text style={s.area} numberOfLines={1}>
                {svc.area_served}
                {typeof svc.distance_km === 'number' ? `  ·  ${svc.distance_km.toFixed(1)} km` : ''}
              </Text>
            </View>
          </View>
        </Pressable>

        <View style={s.actions}>
          <ScalePressable
            containerStyle={s.actionFlex}
            style={s.callBtn}
            pressedScale={0.96}
            onPress={() => Linking.openURL(`tel:${svc.phone}`)}
          >
            <IconPhone size={14} color={Colors.white} />
            <Text style={s.actionBtnTextLight}>Call</Text>
          </ScalePressable>
          <ScalePressable
            containerStyle={s.actionFlex}
            style={[s.chatBtn, !chatEnabled && s.chatBtnDisabled]}
            pressedScale={chatEnabled ? 0.96 : 1}
            disabled={!chatEnabled}
            onPress={() => chatEnabled && onChat(svc)}
          >
            <IconChat size={14} color={chatEnabled ? Colors.blue : Colors.dim} />
            <Text style={[s.actionBtnTextChat, !chatEnabled && s.actionBtnTextDisabled]}>Chat</Text>
          </ScalePressable>
          <ScalePressable
            containerStyle={s.actionFlex}
            style={s.reviewBtn}
            pressedScale={0.96}
            onPress={() => onSelect(svc)}
          >
            <IconStar size={14} color={Colors.amber} />
            <Text style={s.actionBtnTextReview}>Reviews</Text>
          </ScalePressable>
        </View>
      </View>
    </Animated.View>
  );
}

function ProChatDrawer({
  pro,
  userId,
  onClose,
}: {
  pro: ServiceProvider;
  userId: string;
  onClose: () => void;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ProMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getOrCreateProConversation(userId, pro)
      .then(async conv => {
        if (cancelled) return;
        setConversationId(conv.id);
        const msgs = await getProMessages(conv.id);
        if (!cancelled) setMessages(msgs);
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pro.id, userId]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`pro-chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pro_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        payload => {
          const msg = payload.new as ProMessage;
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  const handleSend = async () => {
    if (!conversationId || !text.trim() || sending) return;
    setSending(true);
    try {
      const msg = await sendProMessage(conversationId, userId, text);
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      setText('');
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={c.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={c.backdrop} onPress={onClose} />
        <View style={c.sheet}>
          <View style={c.handle} />
          <View style={c.header}>
            <View style={{ flex: 1 }}>
              <Text style={c.title}>{pro.business_name}</Text>
              <Text style={c.sub}>{getProCategoryLabel(pro)}</Text>
            </View>
            <Pressable onPress={onClose} style={c.closeBtn} hitSlop={10}>
              <Text style={c.closeText}>✕</Text>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.orange} style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={messages}
              keyExtractor={m => m.id}
              style={c.messageList}
              contentContainerStyle={c.messageContent}
              renderItem={({ item }) => {
                const mine = item.sender_id === userId;
                return (
                  <View style={[c.bubble, mine ? c.bubbleMine : c.bubbleTheirs]}>
                    <Text style={[c.bubbleText, mine && c.bubbleTextMine]}>{item.body}</Text>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={c.emptyChat}>Say hello — ask about availability or pricing.</Text>
              }
            />
          )}

          <View style={c.composer}>
            <TextInput
              style={c.composerInput}
              value={text}
              onChangeText={setText}
              placeholder="Type a message…"
              placeholderTextColor={Colors.dim}
              multiline
            />
            <Pressable
              onPress={handleSend}
              disabled={!text.trim() || sending}
              style={[c.sendBtn, (!text.trim() || sending) && c.sendBtnDisabled]}
            >
              <Text style={c.sendBtnText}>{sending ? '…' : 'Send'}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ServiceDetail({
  svc: initialSvc,
  userId,
  onClose,
  onProviderUpdate,
}: {
  svc: ServiceProvider;
  userId: string;
  onClose: () => void;
  onProviderUpdate: (svc: ServiceProvider) => void;
}) {
  const [svc, setSvc] = useState(initialSvc);
  const [reviews, setReviews] = useState<any[]>([]);
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const tint = CAT_TINT[svc.category] ?? Colors.orange;

  useEffect(() => {
    setSvc(initialSvc);
  }, [initialSvc]);

  useEffect(() => {
    getReviews(svc.id, 'service_provider').then(setReviews).catch(console.error);
  }, [svc.id]);

  const submitReview = async () => {
    if (!myComment.trim()) return;
    setPosting(true);
    try {
      const r = await addReview({
        reviewer_id: userId,
        target_id: svc.id,
        target_type: 'service_provider',
        rating: myRating,
        comment: myComment.trim(),
      });
      const nextReviews = [r, ...reviews];
      setReviews(nextReviews);
      setMyComment('');
      setSubmitted(true);

      const updated = await getServiceProviderById(svc.id);
      setSvc(updated);
      onProviderUpdate(updated);
    } catch (e: any) {
      console.error(e);
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
          <View style={[s.onlineDot, { backgroundColor: getPresenceDisplay(svc).dotColor }]} />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={s.nameCluster}>
            <Text style={d.name}>{svc.business_name}</Text>
            {svc.is_verified ? <VerifiedMark size={18} /> : null}
          </View>
          <Text style={[d.catLabel, { color: tint }]}>{getProCategoryLabel(svc)}</Text>
          <StarRow rating={Number(svc.avg_rating)} size={14} />
          <PresenceBadge svc={svc} />
        </View>
      </View>

      <View style={d.statsRow}>
        {([
          [Number(svc.avg_rating).toFixed(1), 'Rating'],
          [String(svc.total_reviews), 'Reviews'],
          [String(svc.total_jobs), 'Jobs'],
          [`${svc.experience_years}yr`, 'Experience'],
        ] as const).map(([v, l]) => (
          <View key={l} style={d.stat}>
            <Text style={d.statVal}>{v}</Text>
            <Text style={d.statLabel}>{l}</Text>
          </View>
        ))}
      </View>

      {svc.description ? <Text style={d.desc}>{svc.description}</Text> : null}
      <View style={[s.areaRow, { marginBottom: 4 }]}>
        <IconPin color={Colors.sub} />
        <Text style={d.area}>Serves {svc.area_served}</Text>
      </View>

      <View style={d.ctaRow}>
        <ScalePressable
          containerStyle={s.actionFlex}
          style={d.callBtn}
          onPress={() => Linking.openURL(`tel:${svc.phone}`)}
        >
          <IconPhone size={16} color={Colors.white} />
          <Text style={d.callBtnText}>Call Now</Text>
        </ScalePressable>
        {svc.whatsapp ? (
          <ScalePressable
            containerStyle={s.actionFlex}
            style={d.waBtn}
            onPress={() => Linking.openURL(`https://wa.me/${svc.whatsapp}`)}
          >
            <Text style={d.waBtnText}>WhatsApp</Text>
          </ScalePressable>
        ) : null}
      </View>

      {!submitted && (
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
            style={d.reviewInput}
          />
          <ScalePressable style={d.submitBtn} onPress={submitReview} disabled={posting}>
            <Text style={d.submitBtnText}>{posting ? 'Posting…' : 'Submit Review'}</Text>
          </ScalePressable>
        </View>
      )}
      {submitted && (
        <View style={d.successBox}>
          <Text style={d.successText}>Review submitted. Thank you.</Text>
        </View>
      )}

      <Text style={d.sectionTitle}>Reviews ({svc.total_reviews})</Text>
      {reviews.length === 0 ? (
        <Text style={d.noReviews}>No reviews yet. Be the first!</Text>
      ) : (
        reviews.map(r => (
          <View key={r.id} style={d.reviewCard}>
            <View style={d.reviewHeader}>
              <Text style={d.reviewUser}>{r.reviewer?.name ?? 'User'}</Text>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {Array.from({ length: r.rating }).map((_, i) => (
                  <IconStar key={i} size={11} color={Colors.amber} />
                ))}
              </View>
            </View>
            <Text style={d.reviewText}>{r.comment}</Text>
          </View>
        ))
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

export default function ServicesScreen() {
  const profile = useAuthStore(s => s.profile);
  const [services, setServices] = useState<ServiceProvider[]>([]);
  const [filter, setFilter] = useState('all');
  const [otherDropdownOpen, setOtherDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ServiceProvider | null>(null);
  const [chatPro, setChatPro] = useState<ServiceProvider | null>(null);

  const hasLocation = profile?.lat != null && profile?.lng != null;

  const loadServices = useCallback(async (isRefresh = false) => {
    if (!profile || !hasLocation) {
      setServices([]);
      setLoading(false);
      return;
    }
    if (!isRefresh) setLoading(true);
    const { category, subcategory } = parseProsFilter(filter);
    try {
      const data = await getServicesNearby(
        profile.lat!,
        profile.lng!,
        profile.radius_km ?? 5,
        category,
        subcategory,
      );
      setServices(data ?? []);
    } catch (e) {
      console.error(e);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [profile, hasLocation, filter]);

  const refreshServices = useCallback(async () => {
    await loadServices(true);
  }, [loadServices]);

  const { refreshControl, scrollHandlers } = useScreenRefresh(refreshServices);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  useEffect(() => {
    if (profile?.role === 'service_provider') {
      touchServiceProviderActivity(profile.id).catch(() => {});
    }
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    const channelId = `pros-presence-${profile?.id ?? 'anon'}-${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'service_providers' },
        payload => {
          const row = payload.new as ServiceProvider;
          setServices(prev => prev.map(item => (item.id === row.id ? { ...item, ...row } : item)));
          setSelected(prev => (prev?.id === row.id ? { ...prev, ...row } : prev));
          setChatPro(prev => (prev?.id === row.id ? { ...prev, ...row } : prev));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);


  const handleProviderUpdate = (updated: ServiceProvider) => {
    setServices(prev => prev.map(item => (item.id === updated.id ? { ...item, ...updated } : item)));
    setSelected(prev => (prev?.id === updated.id ? updated : prev));
  };

  const handleFilterSelect = (next: string) => {
    setFilter(next);
    if (!next.startsWith('other')) setOtherDropdownOpen(false);
  };

  const filtered = services.filter(svc => {
    const q = search.toLowerCase();
    return (
      svc.business_name.toLowerCase().includes(q) ||
      svc.category.toLowerCase().includes(q) ||
      (svc.subcategory ?? '').toLowerCase().includes(q) ||
      getProCategoryLabel(svc).toLowerCase().includes(q)
    );
  });

  const locationSub = profile?.city && hasLocation
    ? `Near ${profile.city} · ${profile.radius_km ?? 5} km · `
    : '';

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.bg }}>
        <View style={s.header}>
          <Text style={s.brand}>Pros</Text>
          <Text style={s.sub}>
            {locationSub}Verified professionals • Rated by your neighbours
          </Text>

          <View style={[s.searchWrap, searchFocused && s.searchWrapFocused]}>
            <IconSearch color={searchFocused ? Colors.orange : Colors.dim} size={18} />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search plumber, electrician…"
              placeholderTextColor={Colors.dim}
              returnKeyType="search"
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipRail}
          >
            {MAIN_FILTERS.map(item => {
              const active = filter === item.id;
              const tint = CAT_TINT[item.id] ?? Colors.orange;
              return (
                <ScalePressable
                  key={item.id}
                  pressedScale={0.96}
                  hoverScale={1.04}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => handleFilterSelect(item.id)}
                >
                  <CategoryIcon id={item.id} size={14} color={active ? Colors.white : tint} />
                  <Text style={[s.chipText, active && s.chipTextActive]}>{item.label}</Text>
                </ScalePressable>
              );
            })}
            <ScalePressable
              pressedScale={0.96}
              hoverScale={1.04}
              style={[s.chip, filter.startsWith('other') && s.chipActive]}
              onPress={() => {
                if (filter.startsWith('other')) {
                  setOtherDropdownOpen(v => !v);
                } else {
                  handleFilterSelect('other');
                  setOtherDropdownOpen(true);
                }
              }}
            >
              <CategoryIcon id="other" size={14} color={filter.startsWith('other') ? Colors.white : Colors.orange} />
              <Text style={[s.chipText, filter.startsWith('other') && s.chipTextActive]}>
                {otherFilterLabel(filter, otherDropdownOpen)}
              </Text>
            </ScalePressable>
          </ScrollView>

          {otherDropdownOpen && (
            <View style={s.otherDropdown}>
              <Pressable
                style={[s.otherOption, filter === 'other' && s.otherOptionActive]}
                onPress={() => { handleFilterSelect('other'); setOtherDropdownOpen(false); }}
              >
                <Text style={[s.otherOptionText, filter === 'other' && s.otherOptionTextActive]}>
                  All Other Skills
                </Text>
              </Pressable>
              {OTHER_SERVICE_SUBCATEGORIES.map(sub => {
                const id = `other:${sub.id}`;
                const active = filter === id;
                return (
                  <Pressable
                    key={sub.id}
                    style={[s.otherOption, active && s.otherOptionActive]}
                    onPress={() => { handleFilterSelect(id); setOtherDropdownOpen(false); }}
                  >
                    <Text style={[s.otherOptionText, active && s.otherOptionTextActive]}>
                      {sub.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </SafeAreaView>

      {!hasLocation ? (
        <View style={s.empty}>
          <View style={s.emptyIcon}>
            <IconPin color={Colors.orange} size={32} />
          </View>
          <Text style={s.emptyTitle}>Location required</Text>
          <Text style={s.emptyText}>
            Set your city and location in Profile to discover pros near you.
          </Text>
        </View>
      ) : loading ? (
        <ActivityIndicator color={Colors.orange} style={{ marginTop: 40 }} size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          {...scrollHandlers}
          renderItem={({ item }) => (
            <ServiceCard
              svc={item}
              onSelect={setSelected}
              onChat={setChatPro}
            />
          )}
          refreshControl={refreshControl}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={6}
          windowSize={7}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <CategoryIcon id="plumber" size={32} color={Colors.orange} />
              </View>
              <Text style={s.emptyTitle}>No pros nearby</Text>
              <Text style={s.emptyText}>Try another category or increase your radius in Profile</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <Pressable style={s.overlay} onPress={() => setSelected(null)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            {selected ? (
              <ServiceDetail
                svc={selected}
                userId={profile!.id}
                onClose={() => setSelected(null)}
                onProviderUpdate={handleProviderUpdate}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {chatPro && profile ? (
        <ProChatDrawer pro={chatPro} userId={profile.id} onClose={() => setChatPro(null)} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  brand: {
    fontSize: 28,
    fontFamily: Fonts.displayXBold,
    fontWeight: '900',
    color: Colors.orange,
    letterSpacing: -0.5,
    textAlign: 'center',
    textShadowColor: '#00000022',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  sub: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.sub,
    marginTop: 4,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.border2,
    paddingHorizontal: 14,
    marginTop: 16,
    marginBottom: 14,
    ...Shadow.sm,
  },
  searchWrapFocused: {
    borderColor: Colors.orange,
    shadowColor: Colors.orange,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontFamily: Fonts.body,
    paddingVertical: 12,
  },
  chipRail: {
    paddingRight: 8,
    paddingBottom: 6,
    paddingTop: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
    shadowColor: Colors.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 6,
  },
  chipText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.sub,
  },
  chipTextActive: {
    color: Colors.white,
  },
  otherDropdown: {
    marginTop: 4,
    marginBottom: 4,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 16,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  otherOption: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  otherOptionActive: {
    backgroundColor: hexAlpha(Colors.orange, '18'),
  },
  otherOptionText: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.sub,
  },
  otherOptionTextActive: {
    color: Colors.orange,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 88,
    gap: 14,
  },
  cardLift: {
    borderRadius: 20,
    ...Shadow.md,
  },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardAccent: {
    height: 3,
    width: '100%',
  },
  cardBody: {
    padding: 16,
    paddingBottom: 12,
    gap: 14,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: Colors.card,
  },
  cardMeta: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nameCluster: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  name: {
    flexShrink: 1,
    fontSize: 16,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  availBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  availDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  availText: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  catText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '600',
  },
  starValue: {
    color: Colors.sub,
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    marginLeft: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border2,
  },
  statValue: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: Fonts.body,
    color: Colors.dim,
    letterSpacing: 0.2,
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  area: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.body,
    color: Colors.sub,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  actionFlex: {
    flex: 1,
  },
  callBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: Colors.green,
    borderRadius: 12,
    paddingVertical: 10,
    shadowColor: Colors.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  chatBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: hexAlpha(Colors.blue, '14'),
    borderWidth: 1,
    borderColor: hexAlpha(Colors.blue, '44'),
    borderRadius: 12,
    paddingVertical: 10,
  },
  chatBtnDisabled: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border2,
    opacity: 0.7,
  },
  reviewBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: hexAlpha(Colors.amber, '14'),
    borderWidth: 1,
    borderColor: hexAlpha(Colors.amber, '44'),
    borderRadius: 12,
    paddingVertical: 10,
  },
  actionBtnTextLight: {
    color: Colors.white,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.2,
  },
  actionBtnTextChat: {
    color: Colors.blue,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.2,
  },
  actionBtnTextReview: {
    color: Colors.amber,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.2,
  },
  actionBtnTextDisabled: {
    color: Colors.dim,
  },
  overlay: {
    flex: 1,
    backgroundColor: '#000000BB',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    padding: 20,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 72,
    gap: 10,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: hexAlpha(Colors.orange, '18'),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 17,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
  },
  emptyText: {
    color: Colors.dim,
    fontSize: 13,
    fontFamily: Fonts.body,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});

const d = StyleSheet.create({
  root: {},
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  closeText: {
    color: Colors.sub,
    fontSize: 14,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    marginBottom: 16,
    marginTop: 8,
  },
  bigAvatar: {
    width: 70,
    height: 70,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 20,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  catLabel: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  stat: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 20,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: Colors.orange,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: Fonts.body,
    color: Colors.sub,
    marginTop: 2,
  },
  desc: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: Colors.sub,
    lineHeight: 20,
    marginBottom: 10,
  },
  area: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.body,
    color: Colors.sub,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    marginTop: 12,
  },
  callBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.green,
    borderRadius: 14,
    paddingVertical: 13,
  },
  callBtnText: {
    color: Colors.white,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    fontSize: 14,
  },
  waBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: hexAlpha(Colors.blue, '18'),
    borderWidth: 1,
    borderColor: hexAlpha(Colors.blue, '44'),
    borderRadius: 14,
    paddingVertical: 13,
  },
  waBtnText: {
    color: Colors.blue,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  reviewForm: {
    backgroundColor: Colors.bg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  reviewInput: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    color: Colors.text,
    fontSize: 14,
    fontFamily: Fonts.body,
    minHeight: 80,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: Colors.white,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    fontSize: 14,
  },
  successBox: {
    backgroundColor: hexAlpha(Colors.green, '22'),
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  successText: {
    color: Colors.green,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '600',
    textAlign: 'center',
  },
  noReviews: {
    color: Colors.dim,
    textAlign: 'center',
    paddingVertical: 20,
    fontFamily: Fonts.body,
  },
  reviewCard: {
    backgroundColor: Colors.bg,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewUser: {
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
    fontSize: 13,
  },
  reviewText: {
    fontSize: 13,
    fontFamily: Fonts.body,
    color: Colors.sub,
    lineHeight: 18,
  },
});

const c = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000088' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '55%',
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
  },
  sub: {
    fontSize: 12,
    fontFamily: Fonts.body,
    color: Colors.sub,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: Colors.sub, fontSize: 14, fontWeight: '700' },
  messageList: { flex: 1, maxHeight: 360 },
  messageContent: { paddingVertical: 8, gap: 8 },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.orange,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, fontFamily: Fonts.body, color: Colors.text, lineHeight: 19 },
  bubbleTextMine: { color: Colors.white },
  emptyChat: {
    textAlign: 'center',
    color: Colors.dim,
    fontSize: 13,
    fontFamily: Fonts.body,
    paddingVertical: 24,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  composerInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
    fontFamily: Fonts.body,
    maxHeight: 96,
  },
  sendBtn: {
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: {
    color: Colors.white,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    fontSize: 13,
  },
});
