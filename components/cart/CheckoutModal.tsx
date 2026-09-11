// components/cart/CheckoutModal.tsx — Delivery details slide-up sheet before placing order

import { useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import { formatRupee, unicodeCartStyle } from '../../lib/cartUtils';
import type { Profile } from '../../types';

type CheckoutModalProps = {
  visible: boolean;
  profile: Profile | null;
  grandTotal: number;
  processing: boolean;
  onClose: () => void;
  onConfirm: (payload: { deliveryAddress: string; contactPhone: string; orderNotes: string }) => void;
  onEditAddress?: () => void;
};

export function CheckoutModal({
  visible,
  profile,
  grandTotal,
  processing,
  onClose,
  onConfirm,
  onEditAddress,
}: CheckoutModalProps) {
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  useEffect(() => {
    if (!visible) return;
    const city = profile?.city?.trim() ?? '';
    const saved = profile?.delivery_address?.trim() ?? '';
    setDeliveryAddress(saved || (city ? `${city}` : ''));
    setContactPhone(profile?.phone?.trim() ?? '');
    setOrderNotes('');
  }, [visible, profile?.city, profile?.delivery_address, profile?.phone]);

  const canConfirm = deliveryAddress.trim().length > 0 && contactPhone.trim().length >= 8;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>Confirm delivery</Text>
          <Text style={s.sub}>Review your address and contact details before placing the order.</Text>

          <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.fieldBlock}>
              <View style={s.fieldHeader}>
                <Text style={s.label}>Delivery address</Text>
                {onEditAddress ? (
                  <TouchableOpacity onPress={onEditAddress}>
                    <Text style={s.link}>Edit in Profile</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <TextInput
                style={[s.input, s.textArea, unicodeCartStyle]}
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                placeholder="House / street, area, city"
                placeholderTextColor={Colors.dim}
                multiline
                textAlignVertical="top"
              />
              {profile?.city ? (
                <Text style={s.hint}>City: {profile.city}</Text>
              ) : null}
            </View>

            <View style={s.fieldBlock}>
              <Text style={s.label}>Contact phone</Text>
              <TextInput
                style={[s.input, unicodeCartStyle]}
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="10-digit mobile number"
                placeholderTextColor={Colors.dim}
                keyboardType="phone-pad"
              />
            </View>

            <View style={s.fieldBlock}>
              <Text style={s.label}>Order notes (optional)</Text>
              <TextInput
                style={[s.input, s.textArea, unicodeCartStyle]}
                value={orderNotes}
                onChangeText={setOrderNotes}
                placeholder="e.g. Ring bell twice, leave at gate"
                placeholderTextColor={Colors.dim}
                multiline
                textAlignVertical="top"
              />
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[s.confirmBtn, (!canConfirm || processing) && s.confirmBtnDisabled]}
            disabled={!canConfirm || processing}
            onPress={() => onConfirm({
              deliveryAddress: deliveryAddress.trim(),
              contactPhone: contactPhone.trim(),
              orderNotes: orderNotes.trim(),
            })}
          >
            {processing
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={s.confirmText}>Confirm Order — {formatRupee(grandTotal)}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = createDynamicStyles((Colors) => ({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingTop: 12,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border2,
    alignSelf: 'center', marginBottom: 14,
  },
  title: { color: Colors.text, fontSize: 20, fontWeight: '800', fontFamily: Fonts.bodySemiBold },
  sub: { color: Colors.sub, fontSize: 13, marginTop: 4, marginBottom: 16, lineHeight: 18 },
  scroll: { maxHeight: 360 },
  fieldBlock: { marginBottom: 16 },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: Colors.sub, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  link: { color: Colors.orange, fontSize: 12, fontWeight: '700' },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
  },
  textArea: { minHeight: 88 },
  hint: { color: Colors.dim, fontSize: 12, marginTop: 6 },
  confirmBtn: {
    marginTop: 8,
    backgroundColor: Colors.orange,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmText: { color: Colors.white, fontWeight: '800', fontSize: 16 },
}));
