import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Linking, StyleSheet, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import {
  getProConversationsForProvider, getProMessages, sendProMessage, sendProEstimate,
} from '../../lib/api';
import { unicodeProsStyle } from '../../lib/prosUtils';
import { supabase } from '../../lib/supabase';
import { hapticLight } from '../../lib/haptics';
import type { ProConversationWithBuyer } from '../../types';

type ProLeadsDrawerProps = {
  visible: boolean;
  providerProfileId: string;
  filter: 'all' | 'quotes';
  onClose: () => void;
};

type ChatState = {
  conversationId: string;
  buyerName: string;
  buyerId: string;
} | null;

export function ProLeadsDrawer({
  visible, providerProfileId, filter, onClose,
}: ProLeadsDrawerProps) {
  const [leads, setLeads] = useState<ProConversationWithBuyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<ChatState>(null);
  const [messages, setMessages] = useState<Array<{ id: string; body: string; sender_id: string }>>([]);
  const [chatText, setChatText] = useState('');
  const [estimateText, setEstimateText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEstimate, setShowEstimate] = useState(false);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getProConversationsForProvider(providerProfileId, filter);
      setLeads(rows);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [providerProfileId, filter]);

  useEffect(() => {
    if (!visible) return;
    void loadLeads();
  }, [visible, loadLeads]);

  useEffect(() => {
    if (!visible || !providerProfileId) return;
    const channel = supabase
      .channel(`pro-leads-${providerProfileId}-${filter}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pro_conversations',
        filter: `provider_profile_id=eq.${providerProfileId}`,
      }, () => { void loadLeads(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [visible, providerProfileId, filter, loadLeads]);

  const openChat = async (lead: ProConversationWithBuyer) => {
    void hapticLight();
    setChat({
      conversationId: lead.id,
      buyerName: lead.buyer?.name ?? 'Buyer',
      buyerId: lead.buyer_id,
    });
    setShowEstimate(false);
    setChatText('');
    setEstimateText('');
    try {
      const msgs = await getProMessages(lead.id);
      setMessages(msgs);
    } catch {
      setMessages([]);
    }
  };

  const handleCall = (phone?: string | null) => {
    const digits = (phone ?? '').replace(/\D/g, '');
    if (!digits) {
      Alert.alert('No phone number', 'This buyer has not shared a phone number yet.');
      return;
    }
    void Linking.openURL(`tel:${digits}`);
  };

  const handleSendChat = async () => {
    if (!chat || !chatText.trim() || sending) return;
    setSending(true);
    try {
      const msg = await sendProMessage(chat.conversationId, providerProfileId, chatText);
      setMessages(prev => [...prev, msg]);
      setChatText('');
    } catch (e: any) {
      Alert.alert('Message failed', e.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const handleSendEstimate = async () => {
    if (!chat || !estimateText.trim() || sending) return;
    setSending(true);
    try {
      const msg = await sendProEstimate(chat.conversationId, providerProfileId, estimateText);
      setMessages(prev => [...prev, msg]);
      setEstimateText('');
      setShowEstimate(false);
      Alert.alert('Estimate sent', 'Your quote was shared with the buyer.');
    } catch (e: any) {
      Alert.alert('Estimate failed', e.message || 'Could not send estimate.');
    } finally {
      setSending(false);
    }
  };

  const title = filter === 'quotes' ? 'Quote Inquiries' : 'Active Requests';
  const emptyText = filter === 'quotes'
    ? 'No recent quote inquiries. New buyer chats from the last 7 days will appear here.'
    : 'No active requests yet. When buyers message you, conversations will appear here.';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Text style={s.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={s.close}>✕</Text>
            </Pressable>
          </View>

          {chat ? (
            <View style={s.chatPane}>
              <Pressable onPress={() => setChat(null)} style={s.backLink}>
                <Text style={s.backLinkText}>← Back to leads</Text>
              </Pressable>
              <Text style={[s.chatTitle, unicodeProsStyle]}>{chat.buyerName}</Text>

              <FlatList
                data={messages}
                keyExtractor={m => m.id}
                style={s.messageList}
                contentContainerStyle={s.messageContent}
                renderItem={({ item }) => {
                  const mine = item.sender_id === providerProfileId;
                  return (
                    <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleTheirs]}>
                      <Text style={[s.bubbleText, unicodeProsStyle, mine && s.bubbleTextMine]}>
                        {item.body}
                      </Text>
                    </View>
                  );
                }}
                ListEmptyComponent={<Text style={s.emptyChat}>No messages yet.</Text>}
              />

              {showEstimate ? (
                <View style={s.estimateBox}>
                  <TextInput
                    style={[s.estimateInput, unicodeProsStyle]}
                    value={estimateText}
                    onChangeText={setEstimateText}
                    placeholder="e.g. ₹1,200 for pipe repair + parts"
                    placeholderTextColor={Colors.dim}
                    multiline
                  />
                  <TouchableOpacity style={s.estimateSend} onPress={() => void handleSendEstimate()} disabled={sending}>
                    <Text style={s.estimateSendText}>Send Estimate</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.composer}>
                  <TextInput
                    style={[s.composerInput, unicodeProsStyle]}
                    value={chatText}
                    onChangeText={setChatText}
                    placeholder="Type a message…"
                    placeholderTextColor={Colors.dim}
                    multiline
                  />
                  <TouchableOpacity
                    style={[s.sendBtn, (!chatText.trim() || sending) && s.sendBtnDisabled]}
                    onPress={() => void handleSendChat()}
                    disabled={!chatText.trim() || sending}
                  >
                    <Text style={s.sendBtnText}>Send</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : loading ? (
            <ActivityIndicator color={Colors.orange} style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={leads}
              keyExtractor={l => l.id}
              contentContainerStyle={leads.length === 0 ? s.emptyWrap : undefined}
              ListEmptyComponent={<Text style={s.empty}>{emptyText}</Text>}
              renderItem={({ item }) => (
                <View style={s.leadCard}>
                  <View style={s.leadInfo}>
                    <Text style={[s.leadName, unicodeProsStyle]}>{item.buyer?.name ?? 'Buyer'}</Text>
                    <Text style={s.leadMeta}>
                      Updated {new Date(item.updated_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={s.leadActions}>
                    <TouchableOpacity style={s.actionBtn} onPress={() => handleCall(item.buyer?.phone)}>
                      <Text style={s.actionBtnText}>Call Buyer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.actionBtn} onPress={() => void openChat(item)}>
                      <Text style={s.actionBtnText}>Chat</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionBtn, s.actionBtnAccent]}
                      onPress={() => {
                        void openChat(item);
                        setShowEstimate(true);
                      }}
                    >
                      <Text style={[s.actionBtnText, s.actionBtnTextAccent]}>Send Estimate</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = createDynamicStyles((Colors) => ({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    maxHeight: '88%',
    minHeight: '50%',
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text },
  close: { fontSize: 18, color: Colors.sub },
  emptyWrap: { flexGrow: 1, justifyContent: 'center', paddingVertical: 32 },
  empty: { textAlign: 'center', color: Colors.sub, lineHeight: 20, paddingHorizontal: 12 },
  leadCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 10,
    backgroundColor: Colors.bg,
  },
  leadInfo: { marginBottom: 10 },
  leadName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  leadMeta: { marginTop: 2, fontSize: 11, color: Colors.dim },
  leadActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnAccent: { borderColor: Colors.orange, backgroundColor: Colors.orange + '18' },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: Colors.text },
  actionBtnTextAccent: { color: Colors.orange },
  chatPane: { flex: 1, minHeight: 320 },
  backLink: { marginBottom: 6 },
  backLinkText: { color: Colors.orange, fontWeight: '600' },
  chatTitle: { fontSize: 16, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  messageList: { flex: 1, maxHeight: 260 },
  messageContent: { paddingVertical: 8 },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: Colors.border,
  },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: Colors.orange },
  bubbleTheirs: { backgroundColor: Colors.border },
  bubbleText: { color: Colors.text, fontSize: 14 },
  bubbleTextMine: { color: '#fff' },
  emptyChat: { textAlign: 'center', color: Colors.dim, marginVertical: 16 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8 },
  composerInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: Colors.orange,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontWeight: '800' },
  estimateBox: { marginTop: 8, gap: 8 },
  estimateInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  estimateSend: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.orange,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  estimateSendText: { color: '#fff', fontWeight: '800' },
}));
