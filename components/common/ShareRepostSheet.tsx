// components/common/ShareRepostSheet.tsx — Unified share / repost bottom sheet

import { useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, TextInput, TouchableOpacity,
  ActivityIndicator, ScrollView, Image, Share, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import { getBuyerRecentShopChats } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { hapticLight } from '../../lib/haptics';
import { resolveFeedMediaUrl } from '../feed/feedUtils';
import { DEFAULT_AVATAR } from '../../lib/feedSafe';

const QUOTE_MAX = 280;

export type ShareRepostSheetProps = {
  visible: boolean;
  onClose: () => void;
  contentKind: 'post' | 'spark';
  contentId: string;
  shopId: string;
  shopName?: string | null;
  shareTitle?: string;
  shareMessage?: string;
  shareUrl?: string;
  isReposted: boolean;
  busy?: boolean;
  onQuickRepost: () => Promise<void> | void;
  onUndoRepost: () => Promise<void> | void;
  onQuoteRepost: (quote: string) => Promise<void> | void;
};

type ChatRow = {
  id: string;
  shop_id: string;
  shop?: { id: string; name?: string; logo_url?: string | null } | null;
};

/**
 * Modern social share suite: Quick Repost, Quote, Direct Chat, External Share.
 * Uses a solid sheet (no BlurView) so Android Modals always paint correctly.
 */
export function ShareRepostSheet({
  visible,
  onClose,
  contentKind,
  contentId,
  shopId,
  shopName,
  shareTitle,
  shareMessage,
  shareUrl,
  isReposted,
  busy = false,
  onQuickRepost,
  onUndoRepost,
  onQuoteRepost,
}: ShareRepostSheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore(s => s.profile);
  const [quoteMode, setQuoteMode] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [working, setWorking] = useState(false);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [showChats, setShowChats] = useState(false);
  // Prevent the opening tap from immediately dismissing the transparent Modal.
  const [allowDismiss, setAllowDismiss] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuoteMode(false);
      setQuoteText('');
      setShowChats(false);
      setWorking(false);
      setAllowDismiss(false);
      return;
    }
    const t = setTimeout(() => setAllowDismiss(true), 320);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (!visible || !showChats || !profile?.id) return;
    let cancelled = false;
    setChatsLoading(true);
    getBuyerRecentShopChats(profile.id, 10)
      .then(rows => { if (!cancelled) setChats(rows); })
      .catch(() => { if (!cancelled) setChats([]); })
      .finally(() => { if (!cancelled) setChatsLoading(false); });
    return () => { cancelled = true; };
  }, [visible, showChats, profile?.id]);

  const run = async (fn: () => Promise<void> | void) => {
    if (working || busy) return;
    setWorking(true);
    try {
      await fn();
      onClose();
    } catch {
      // Parent surfaces errors via Alert / Toast
    } finally {
      setWorking(false);
    }
  };

  const handleExternalShare = async () => {
    void hapticLight();
    try {
      await Share.share({
        message: shareMessage
          ?? `Check this out on Vedastya${shopName ? ` from ${shopName}` : ''}\n${shareUrl ?? ''}`.trim(),
        title: shareTitle ?? `${shopName ?? 'Vedastya'} share`,
        url: shareUrl,
      });
    } catch { /* noop */ }
    onClose();
  };

  const openChat = (targetShopId: string, name?: string) => {
    if (!targetShopId) return;
    void hapticLight();
    onClose();
    router.push({
      pathname: '/chat/[shopId]',
      params: {
        shopId: targetShopId,
        shopName: name ?? shopName ?? 'Shop',
        productTitle: contentKind === 'spark' ? 'Moment' : 'Post',
        productId: contentId,
      },
    } as any);
  };

  const remaining = QUOTE_MAX - quoteText.length;
  const blocked = working || busy;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.root}>
        <Pressable
          style={s.backdropTap}
          onPress={allowDismiss ? onClose : undefined}
          accessibilityLabel="Close share sheet"
        />

        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={s.handle} />
          <Text style={s.title}>
            {contentKind === 'spark' ? 'Share Moment' : 'Share Post'}
          </Text>
          <Text style={s.sub}>
            {shopName ? `From ${shopName}` : 'Repost or send to friends'}
          </Text>

          {quoteMode ? (
            <View style={s.quoteBlock}>
              <TextInput
                value={quoteText}
                onChangeText={t => setQuoteText(t.slice(0, QUOTE_MAX))}
                placeholder="Add a comment above the original…"
                placeholderTextColor={Colors.dim}
                style={s.quoteInput}
                multiline
                maxLength={QUOTE_MAX}
                autoFocus
              />
              <Text style={[s.counter, remaining < 20 && s.counterWarn]}>{remaining}</Text>
              <TouchableOpacity
                style={[s.primaryBtn, (!quoteText.trim() || blocked) && s.btnDisabled]}
                disabled={!quoteText.trim() || blocked}
                activeOpacity={0.85}
                onPress={() => {
                  void hapticLight();
                  void run(() => onQuoteRepost(quoteText.trim()));
                }}
              >
                {blocked
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={s.primaryBtnText}>Repost with Quote</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setQuoteMode(false)} style={s.cancelRow} activeOpacity={0.7}>
                <Text style={s.cancelText}>Back</Text>
              </TouchableOpacity>
            </View>
          ) : showChats ? (
            <View style={s.chatsBlock}>
              <Text style={s.chatsTitle}>Send via Direct Chat</Text>
              {chatsLoading ? (
                <ActivityIndicator color={Colors.orange} style={{ marginVertical: 16 }} />
              ) : (
                <ScrollView style={s.chatsList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {!!shopId && (
                    <TouchableOpacity
                      style={s.chatRow}
                      onPress={() => openChat(shopId, shopName ?? undefined)}
                      activeOpacity={0.85}
                    >
                      <View style={[s.chatAvatar, s.chatAvatarFallback]}>
                        <Text style={s.chatEmoji}>🏪</Text>
                      </View>
                      <View style={s.chatCopy}>
                        <Text style={s.chatName}>{shopName ?? 'This shop'}</Text>
                        <Text style={s.chatMeta}>Start or continue chat</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  {chats
                    .filter(c => c.shop_id !== shopId)
                    .map(c => {
                      const logo = resolveFeedMediaUrl(c.shop?.logo_url) || DEFAULT_AVATAR;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={s.chatRow}
                          onPress={() => openChat(c.shop_id, c.shop?.name)}
                          activeOpacity={0.85}
                        >
                          <Image source={{ uri: logo }} style={s.chatAvatar} />
                          <View style={s.chatCopy}>
                            <Text style={s.chatName}>{c.shop?.name ?? 'Shop'}</Text>
                            <Text style={s.chatMeta}>Recent conversation</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  {!chats.length ? (
                    <Text style={s.emptyChats}>No recent chats yet. Message this shop to start.</Text>
                  ) : null}
                </ScrollView>
              )}
              <TouchableOpacity onPress={() => setShowChats(false)} style={s.cancelRow} activeOpacity={0.7}>
                <Text style={s.cancelText}>Back</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.actions}>
              <TouchableOpacity
                style={s.pill}
                disabled={blocked}
                activeOpacity={0.85}
                onPress={() => {
                  void hapticLight();
                  void run(() => (isReposted ? onUndoRepost() : onQuickRepost()));
                }}
              >
                <Text style={s.pillEmoji}>🔁</Text>
                <View style={s.pillCopy}>
                  <Text style={[s.pillTitle, isReposted && { color: Colors.red }]}>
                    {isReposted ? 'Undo Repost' : 'Quick Repost'}
                  </Text>
                  <Text style={s.pillSub}>
                    {isReposted ? 'Remove from your profile feed' : 'One-tap share to your profile'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.pill}
                disabled={blocked}
                activeOpacity={0.85}
                onPress={() => {
                  void hapticLight();
                  setQuoteMode(true);
                }}
              >
                <Text style={s.pillEmoji}>💬</Text>
                <View style={s.pillCopy}>
                  <Text style={s.pillTitle}>Repost with Quote</Text>
                  <Text style={s.pillSub}>Add a comment (up to {QUOTE_MAX} characters)</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.pill}
                activeOpacity={0.85}
                onPress={() => {
                  void hapticLight();
                  setShowChats(true);
                }}
              >
                <Text style={s.pillEmoji}>✉️</Text>
                <View style={s.pillCopy}>
                  <Text style={s.pillTitle}>Send via Direct Chat</Text>
                  <Text style={s.pillSub}>Pick a recent shop conversation</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.pill}
                activeOpacity={0.85}
                onPress={() => void handleExternalShare()}
              >
                <Text style={s.pillEmoji}>📲</Text>
                <View style={s.pillCopy}>
                  <Text style={s.pillTitle}>Share to External Apps</Text>
                  <Text style={s.pillSub}>WhatsApp, Messages, and more</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} style={s.cancelRow} activeOpacity={0.7}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.border2,
    maxHeight: '88%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
      },
      android: { elevation: 24 },
      default: {},
    }),
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  sub: {
    fontSize: 13,
    color: Colors.sub,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  actions: { gap: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  pillEmoji: { fontSize: 22, width: 28, textAlign: 'center' },
  pillCopy: { flex: 1, minWidth: 0 },
  pillTitle: {
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.text,
  },
  pillSub: {
    fontSize: 12,
    color: Colors.dim,
    marginTop: 2,
  },
  quoteBlock: { gap: 10 },
  quoteInput: {
    minHeight: 96,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.card,
    color: Colors.text,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
    fontSize: 12,
    color: Colors.dim,
    fontWeight: '700',
  },
  counterWarn: { color: Colors.orange },
  primaryBtn: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.45 },
  cancelRow: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: Colors.dim, fontWeight: '700', fontSize: 15 },
  chatsBlock: { maxHeight: 360 },
  chatsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  chatsList: { maxHeight: 280 },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  chatAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface },
  chatAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  chatEmoji: { fontSize: 18 },
  chatCopy: { flex: 1, minWidth: 0 },
  chatName: { color: Colors.text, fontWeight: '800', fontSize: 14 },
  chatMeta: { color: Colors.dim, fontSize: 12, marginTop: 2 },
  emptyChats: { color: Colors.sub, fontSize: 13, paddingVertical: 12, textAlign: 'center' },
}));
