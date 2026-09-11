// components/services/RequestServiceModal.tsx — Job / quote request sheet

import { useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors, Fonts, OTHER_SERVICE_SUBCATEGORIES, Radius, createDynamicStyles } from '../../constants/theme';
import { createServiceRequest } from '../../lib/api';
import { sendLocalNotification } from '../../lib/pushNotifications';
import { unicodeProsStyle, urgencyLabel } from '../../lib/prosUtils';
import type { ServiceProvider, ServiceRequestUrgency } from '../../types';

type RequestServiceModalProps = {
  visible: boolean;
  pro: ServiceProvider | null;
  buyerId: string;
  buyerName?: string;
  onClose: () => void;
  onSubmitted?: () => void;
};

const URGENCY_OPTIONS: { id: ServiceRequestUrgency; label: string }[] = [
  { id: 'emergency', label: 'Emergency / Immediate' },
  { id: 'today', label: 'Today' },
  { id: 'scheduled', label: 'Scheduled Date' },
];

export function RequestServiceModal({
  visible, pro, buyerId, buyerName, onClose, onSubmitted,
}: RequestServiceModalProps) {
  const [urgency, setUrgency] = useState<ServiceRequestUrgency>('today');
  const [scheduledDate, setScheduledDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible || !pro) return;
    setUrgency('today');
    setScheduledDate(new Date(Date.now() + 86400000));
    setSubcategory(pro.subcategory ?? null);
    setDescription('');
    setSubmitting(false);
  }, [visible, pro?.id]);

  const subOptions = pro?.category === 'other'
    ? OTHER_SERVICE_SUBCATEGORIES
    : OTHER_SERVICE_SUBCATEGORIES;

  const handleSubmit = async () => {
    if (!pro) return;
    setSubmitting(true);
    try {
      await createServiceRequest({
        buyerId,
        serviceProviderId: pro.id,
        urgency,
        scheduledDate: urgency === 'scheduled' ? scheduledDate.toISOString().slice(0, 10) : null,
        subcategory,
        description,
        providerProfileId: pro.profile_id,
        providerName: pro.business_name,
        buyerName,
      });
      await sendLocalNotification({
        title: 'Request sent',
        body: `Your job request was sent to ${pro.business_name}.`,
        data: { type: 'service_request', provider_id: pro.id },
      });
      onSubmitted?.();
      onClose();
      Alert.alert('Request sent', `${pro.business_name} will be notified and can respond shortly.`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not send request. Please try again.';
      Alert.alert('Request failed', message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!pro) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>Request Job / Quote</Text>
          <Text style={s.sub} numberOfLines={1}>{pro.business_name}</Text>

          <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.label}>Urgency</Text>
            <View style={s.urgencyRow}>
              {URGENCY_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[s.urgencyChip, urgency === opt.id && s.urgencyChipActive]}
                  onPress={() => setUrgency(opt.id)}
                >
                  <Text style={[s.urgencyText, urgency === opt.id && s.urgencyTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {urgency === 'scheduled' ? (
              <View style={s.dateBlock}>
                <Text style={s.label}>Preferred date</Text>
                <TouchableOpacity style={s.dateBtn} onPress={() => setShowDatePicker(true)}>
                  <Text style={s.dateBtnText}>{scheduledDate.toLocaleDateString()}</Text>
                </TouchableOpacity>
                {showDatePicker ? (
                  <DateTimePicker
                    value={scheduledDate}
                    mode="date"
                    minimumDate={new Date()}
                    onChange={(_, date) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (date) setScheduledDate(date);
                    }}
                  />
                ) : null}
              </View>
            ) : null}

            <Text style={s.label}>Issue sub-category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.subRail}>
              {subOptions.map(sub => {
                const active = subcategory === sub.id;
                return (
                  <TouchableOpacity
                    key={sub.id}
                    style={[s.subChip, active && s.subChipActive]}
                    onPress={() => setSubcategory(active ? null : sub.id)}
                  >
                    <Text style={[s.subChipText, active && s.subChipTextActive]}>{sub.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={s.label}>Job description</Text>
            <TextInput
              style={[s.input, s.textArea, unicodeProsStyle]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue, location details, and any timing preferences…"
              placeholderTextColor={Colors.dim}
              multiline
              textAlignVertical="top"
            />
            <Text style={s.hint}>Selected urgency: {urgencyLabel(urgency)}</Text>
          </ScrollView>

          <TouchableOpacity
            style={[s.submitBtn, (submitting || description.trim().length < 8) && s.submitBtnDisabled]}
            disabled={submitting || description.trim().length < 8}
            onPress={() => void handleSubmit()}
          >
            {submitting
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={s.submitText}>📅 Submit Request</Text>}
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
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border2, alignSelf: 'center', marginBottom: 14 },
  title: { color: Colors.text, fontSize: 20, fontWeight: '800', fontFamily: Fonts.bodySemiBold },
  sub: { color: Colors.sub, fontSize: 13, marginTop: 4, marginBottom: 16 },
  scroll: { maxHeight: 420 },
  label: { color: Colors.sub, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, marginTop: 4 },
  urgencyRow: { gap: 8, marginBottom: 12 },
  urgencyChip: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.card,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  urgencyChipActive: { borderColor: Colors.orange, backgroundColor: `${Colors.orange}18` },
  urgencyText: { color: Colors.sub, fontSize: 13, fontWeight: '600' },
  urgencyTextActive: { color: Colors.orange, fontWeight: '800' },
  dateBlock: { marginBottom: 12 },
  dateBtn: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    borderRadius: Radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dateBtnText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  subRail: { gap: 8, paddingBottom: 12 },
  subChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border2,
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  subChipActive: { borderColor: Colors.orange, backgroundColor: Colors.orange },
  subChipText: { color: Colors.sub, fontSize: 12, fontWeight: '600' },
  subChipTextActive: { color: Colors.white, fontWeight: '700' },
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
  textArea: { minHeight: 110, marginBottom: 8 },
  hint: { color: Colors.dim, fontSize: 12, marginBottom: 8 },
  submitBtn: {
    marginTop: 8,
    backgroundColor: Colors.orange,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: Colors.white, fontWeight: '800', fontSize: 16 },
}));
