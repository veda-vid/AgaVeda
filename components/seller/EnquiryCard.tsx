// components/seller/EnquiryCard.tsx — Lead card with outreach actions
import { useState } from 'react';
import {
  View, Text, Image, Pressable, StyleSheet, Modal, Linking, Alert, Platform,
} from 'react-native';
import { Colors, Fonts } from '../../constants/theme';
import { hapticLight } from '../../lib/haptics';
import {
  ENQUIRY_STATUS_COLORS, ENQUIRY_STATUS_LABELS, ENQUIRY_TYPE_LABELS,
  buildEnquiryWhatsAppMessage, buildWhatsAppUrl, formatEnquiryTime,
  formatProximityLine, productDisplayPrice,
} from '../../lib/enquiryUtils';
import type { Shop, ShopEnquiry, ShopEnquiryStatus } from '../../types';

const STATUS_OPTIONS: ShopEnquiryStatus[] = ['new', 'contacted', 'converted', 'closed'];

type Props = {
  enquiry: ShopEnquiry;
  shop: Shop;
  onStatusChange: (id: string, status: ShopEnquiryStatus) => void;
  onChat: (enquiry: ShopEnquiry) => void;
};

export function EnquiryCard({ enquiry, shop, onStatusChange, onChat }: Props) {
  const [statusOpen, setStatusOpen] = useState(false);
  const buyerName = enquiry.buyer?.name?.trim() || 'Buyer';
  const subject = enquiry.product?.title || shop.name;
  const productPrice = productDisplayPrice(enquiry.product);
  const thumb = enquiry.product?.images?.[0];

  const handleCall = () => {
    hapticLight();
    const phone = enquiry.buyer?.phone || shop.phone;
    if (!phone) {
      Alert.alert('No phone number', 'This buyer has not shared a phone number yet.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Could not open dialer', 'Please try again from your phone app.');
    });
  };

  const handleWhatsApp = () => {
    hapticLight();
    const phone = enquiry.buyer?.phone || shop.whatsapp || shop.phone;
    if (!phone) {
      Alert.alert('No WhatsApp number', 'Add a WhatsApp number in shop settings to message buyers.');
      return;
    }
    const message = buildEnquiryWhatsAppMessage(buyerName, subject);
    Linking.openURL(buildWhatsAppUrl(phone, message)).catch(() => {
      Alert.alert('Could not open WhatsApp', 'Make sure WhatsApp is installed on your device.');
    });
  };

  const handleChat = () => {
    hapticLight();
    onChat(enquiry);
  };

  const pickStatus = (status: ShopEnquiryStatus) => {
    hapticLight();
    setStatusOpen(false);
    if (status !== enquiry.status) onStatusChange(enquiry.id, status);
  };

  return (
    <View style={s.card}>
      <View style={s.topRow}>
        <View style={s.avatarWrap}>
          {enquiry.buyer?.avatar_url ? (
            <Image source={{ uri: enquiry.buyer.avatar_url }} style={s.avatar} />
          ) : (
            <Text style={s.avatarEmoji}>👤</Text>
          )}
        </View>
        <View style={s.metaCol}>
          <Text style={s.buyerLine}>{formatProximityLine(enquiry)}</Text>
          <View style={s.badgeRow}>
            <View style={[s.statusBadge, { backgroundColor: ENQUIRY_STATUS_COLORS[enquiry.status] + '22' }]}>
              <Text style={[s.statusText, { color: ENQUIRY_STATUS_COLORS[enquiry.status] }]}>
                {ENQUIRY_STATUS_LABELS[enquiry.status]}
              </Text>
            </View>
            <Text style={s.typePill}>{ENQUIRY_TYPE_LABELS[enquiry.type]}</Text>
            <Text style={s.timeText}>{formatEnquiryTime(enquiry.created_at)}</Text>
          </View>
        </View>
        <Pressable onPress={() => setStatusOpen(true)} style={s.statusBtn} hitSlop={8}>
          <Text style={s.statusBtnText}>▾</Text>
        </Pressable>
      </View>

      {enquiry.product || enquiry.message ? (
        <View style={s.bodyRow}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={s.thumb} />
          ) : (
            <View style={s.thumbPlaceholder}>
              <Text style={s.thumbEmoji}>{enquiry.type === 'callback' ? '📞' : '💬'}</Text>
            </View>
          )}
          <View style={s.bodyCopy}>
            {enquiry.product?.title ? (
              <Text style={s.productTitle} numberOfLines={1}>{enquiry.product.title}</Text>
            ) : null}
            {productPrice ? <Text style={s.productPrice}>{productPrice}</Text> : null}
            {enquiry.message ? (
              <Text style={s.message} numberOfLines={3}>{enquiry.message}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={s.actionBar}>
        <Pressable style={[s.actionBtn, s.chatBtn]} onPress={handleChat}>
          <Text style={s.chatBtnText}>💬 Chat</Text>
        </Pressable>
        <Pressable style={s.actionBtn} onPress={handleCall}>
          <Text style={s.actionBtnText}>📞 Call</Text>
        </Pressable>
        <Pressable style={[s.actionBtn, s.waBtn]} onPress={handleWhatsApp}>
          <Text style={s.waBtnText}>💚 WhatsApp</Text>
        </Pressable>
      </View>

      <Modal transparent visible={statusOpen} animationType="fade" onRequestClose={() => setStatusOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setStatusOpen(false)}>
          <Pressable style={s.modalCard} onPress={() => {}}>
            <Text style={s.modalTitle}>Update status</Text>
            {STATUS_OPTIONS.map(status => (
              <Pressable
                key={status}
                onPress={() => pickStatus(status)}
                style={[s.modalOption, enquiry.status === status && s.modalOptionActive]}
              >
                <View style={[s.statusDot, { backgroundColor: ENQUIRY_STATUS_COLORS[status] }]} />
                <Text style={s.modalOptionText}>{ENQUIRY_STATUS_LABELS[status]}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border2,
    padding: 14,
    gap: 12,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  avatarWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 20 },
  metaCol: { flex: 1, gap: 4 },
  buyerLine: { color: Colors.text, fontSize: 14, fontFamily: Fonts.bodySemiBold, fontWeight: '700' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontFamily: Fonts.bodySemiBold, fontWeight: '800' },
  typePill: { color: Colors.sub, fontSize: 11, fontFamily: Fonts.body },
  timeText: { color: Colors.dim, fontSize: 11, fontFamily: Fonts.body },
  statusBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border2, alignItems: 'center', justifyContent: 'center',
  },
  statusBtnText: { color: Colors.sub, fontSize: 12, fontWeight: '700' },
  bodyRow: {
    flexDirection: 'row', gap: 10, backgroundColor: Colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, padding: 10,
  },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: Colors.card },
  thumbPlaceholder: {
    width: 56, height: 56, borderRadius: 10, backgroundColor: Colors.card,
    alignItems: 'center', justifyContent: 'center',
  },
  thumbEmoji: { fontSize: 22 },
  bodyCopy: { flex: 1, gap: 2 },
  productTitle: { color: Colors.text, fontSize: 13, fontFamily: Fonts.bodySemiBold, fontWeight: '700' },
  productPrice: { color: Colors.orange, fontSize: 13, fontFamily: Fonts.bodySemiBold, fontWeight: '800' },
  message: { color: Colors.sub, fontSize: 13, fontFamily: Fonts.body, lineHeight: 18, marginTop: 2 },
  actionBar: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border2,
  },
  actionBtnText: { color: Colors.text, fontSize: 12, fontFamily: Fonts.bodySemiBold, fontWeight: '700' },
  chatBtn: { backgroundColor: Colors.blue + '18', borderColor: Colors.blue + '44' },
  chatBtnText: { color: Colors.blue, fontSize: 12, fontFamily: Fonts.bodySemiBold, fontWeight: '700' },
  waBtn: { backgroundColor: Colors.green + '18', borderColor: Colors.green + '44' },
  waBtnText: { color: Colors.green, fontSize: 12, fontFamily: Fonts.bodySemiBold, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', padding: 24 },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1,
    borderColor: Colors.border2, padding: 16,
  },
  modalTitle: { color: Colors.text, fontSize: 16, fontFamily: Fonts.bodySemiBold, fontWeight: '800', marginBottom: 10 },
  modalOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 10,
    borderRadius: 10, marginBottom: 4,
  },
  modalOptionActive: { backgroundColor: Colors.orange + '18' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  modalOptionText: { color: Colors.text, fontSize: 14, fontFamily: Fonts.bodySemiBold, fontWeight: '600' },
});
