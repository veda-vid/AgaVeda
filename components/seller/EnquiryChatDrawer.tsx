// components/seller/EnquiryChatDrawer.tsx — Seller-side buyer chat from an enquiry
import { useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, FlatList, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { getSupabase } from '../../lib/supabase';
import {
  getOrCreateShopConversation, getShopMessages, sendShopMessage,
} from '../../lib/api';
import { Colors, Fonts } from '../../constants/theme';
import type { Shop, ShopMessage } from '../../types';

type Props = {
  visible: boolean;
  shop: Shop;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  onClose: () => void;
  onSent?: () => void;
};

export function EnquiryChatDrawer({
  visible, shop, buyerId, buyerName, sellerId, onClose, onSent,
}: Props) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ShopMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    getOrCreateShopConversation(buyerId, shop)
      .then(async conv => {
        if (cancelled) return;
        setConversationId(conv.id);
        setMessages(await getShopMessages(conv.id));
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, shop.id, buyerId]);

  useEffect(() => {
    if (!conversationId || !visible) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`enquiry-chat-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'shop_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, payload => {
        const msg = payload.new as ShopMessage;
        setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, visible]);

  const handleSend = async () => {
    if (!conversationId || !text.trim() || sending) return;
    setSending(true);
    try {
      const msg = await sendShopMessage(conversationId, sellerId, text);
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      setText('');
      onSent?.();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{buyerName}</Text>
              <Text style={s.sub}>Enquiry chat · {shop.name}</Text>
            </View>
            <Pressable onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </Pressable>
          </View>
          {loading ? (
            <ActivityIndicator color={Colors.orange} style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={messages}
              keyExtractor={m => m.id}
              style={s.messageList}
              contentContainerStyle={s.messageContent}
              renderItem={({ item }) => {
                const mine = item.sender_id === sellerId;
                return (
                  <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
                    <Text style={[s.bubbleText, mine && s.bubbleTextMine]}>{item.body}</Text>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={s.emptyChat}>Start the conversation with this buyer.</Text>
              }
            />
          )}
          <View style={s.composer}>
            <TextInput
              style={s.composerInput}
              value={text}
              onChangeText={setText}
              placeholder="Reply to buyer…"
              placeholderTextColor={Colors.dim}
              multiline
            />
            <Pressable
              style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
              disabled={!text.trim() || sending}
              onPress={() => void handleSend()}
            >
              {sending
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={s.sendBtnText}>Send</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
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
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border2,
    alignSelf: 'center', marginTop: 10, marginBottom: 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 18, fontFamily: Fonts.bodySemiBold, fontWeight: '700', color: Colors.text },
  sub: { fontSize: 12, fontFamily: Fonts.body, color: Colors.sub, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: Colors.sub, fontSize: 14, fontWeight: '700' },
  messageList: { flex: 1, maxHeight: 360 },
  messageContent: { paddingVertical: 8, gap: 8 },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: Colors.orange, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    alignSelf: 'flex-start', backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border2, borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, fontFamily: Fonts.body, color: Colors.text, lineHeight: 19 },
  bubbleTextMine: { color: Colors.white },
  emptyChat: { textAlign: 'center', color: Colors.dim, fontSize: 13, fontFamily: Fonts.body, paddingVertical: 24 },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  composerInput: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.border2, paddingHorizontal: 12, paddingVertical: 10,
    color: Colors.text, fontSize: 14, fontFamily: Fonts.body, maxHeight: 96,
  },
  sendBtn: { backgroundColor: Colors.orange, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: Colors.white, fontFamily: Fonts.bodySemiBold, fontWeight: '700', fontSize: 13 },
});
