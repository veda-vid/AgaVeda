import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import {
  getShopById, getOrCreateShopConversation, getShopMessages, sendShopMessage,
} from '../../lib/api';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import type { ShopMessage } from '../../types';

export default function ShopChatScreen() {
  const router = useRouter();
  const profile = useAuthStore(s => s.profile);
  const params = useLocalSearchParams<{
    shopId: string;
    productId?: string;
    productTitle?: string;
    shopName?: string;
  }>();

  const shopId = Array.isArray(params.shopId) ? params.shopId[0] : params.shopId;
  const productTitle = Array.isArray(params.productTitle) ? params.productTitle[0] : params.productTitle;
  const shopNameParam = Array.isArray(params.shopName) ? params.shopName[0] : params.shopName;

  const [shopName, setShopName] = useState(shopNameParam ?? 'Shop');
  const [messages, setMessages] = useState<ShopMessage[]>([]);
  const [draft, setDraft] = useState(
    productTitle
      ? `Hi, I am interested in ${productTitle}. Is it available?`
      : 'Hi, I saw your post and would like to know more.',
  );
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const loadChat = useCallback(async () => {
    if (!profile || !shopId) return;
    setLoading(true);
    try {
      const shop = await getShopById(shopId);
      setShopName(shop.name);
      const conversation = await getOrCreateShopConversation(profile.id, shop);
      setConversationId(conversation.id);
      const rows = await getShopMessages(conversation.id);
      setMessages(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [profile, shopId]);

  useEffect(() => {
    void loadChat();
  }, [loadChat]);

  const handleSend = async () => {
    if (!profile || !conversationId || !draft.trim() || sending) return;
    const body = draft.trim();
    setDraft('');
    setSending(true);
    try {
      const message = await sendShopMessage(conversationId, profile.id, body);
      setMessages(prev => [...prev, message]);
    } catch {
      setDraft(body);
    } finally {
      setSending(false);
    }
  };

  if (!profile) {
    return (
      <View style={s.center}>
        <Text style={s.sub}>Please sign in to chat with shops.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={s.headerCopy}>
          <Text style={s.title} numberOfLines={1}>{shopName}</Text>
          <Text style={s.sub}>Shop chat</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.orange} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={12}
        >
          <FlatList
            data={messages}
            keyExtractor={item => item.id}
            contentContainerStyle={s.messageList}
            renderItem={({ item }) => {
              const mine = item.sender_id === profile.id;
              return (
                <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
                  <Text style={[s.bubbleText, mine && s.bubbleTextMine]}>{item.body}</Text>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={s.empty}>Send a message to start the conversation.</Text>
            }
          />

          <View style={s.composer}>
            <TextInput
              style={s.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Type your message…"
              placeholderTextColor={Colors.dim}
              multiline
            />
            <TouchableOpacity
              style={[s.sendBtn, (!draft.trim() || sending) && s.sendBtnDisabled]}
              onPress={() => void handleSend()}
              disabled={!draft.trim() || sending}
            >
              <Text style={s.sendText}>{sending ? '…' : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backText: { color: Colors.orange, fontWeight: '700', fontSize: 14 },
  headerCopy: { flex: 1 },
  title: { color: Colors.text, fontSize: 17, fontFamily: Fonts.displayXBold, fontWeight: '800' },
  sub: { color: Colors.sub, fontSize: 12, marginTop: 2 },
  messageList: { padding: 16, gap: 10, flexGrow: 1 },
  bubble: {
    maxWidth: '82%',
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.orange,
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: { color: Colors.text, fontSize: 14, lineHeight: 20 },
  bubbleTextMine: { color: Colors.white },
  empty: { color: Colors.dim, textAlign: 'center', marginTop: 24, fontSize: 13 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.card,
    color: Colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: Colors.white, fontWeight: '800', fontSize: 13 },
}));
