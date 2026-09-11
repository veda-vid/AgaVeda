// components/profile/LegalWebModal.tsx — In-app policy / support bottom sheet

import { Modal, View, Text, Pressable, ScrollView, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import { unicodeProsStyle } from '../../lib/profileUtils';

export type LegalDocId = 'terms' | 'privacy' | 'help';

const DOCS: Record<LegalDocId, { title: string; body: string }> = {
  terms: {
    title: 'Terms of Service',
    body: `CityConnect Terms of Service

Last updated: August 2026

1. Acceptance
By using CityConnect you agree to these terms. If you do not agree, please discontinue use of the app.

2. Accounts & roles
You are responsible for accurate profile information. Buyers, sellers, and service providers must comply with local laws when listing products or offering services.

3. Marketplace transactions
Orders placed through CityConnect are agreements between buyers and independent shops. CityConnect facilitates discovery and communication but is not the seller of record.

4. Content
You retain ownership of content you post. You grant CityConnect a license to display content within the platform for operational purposes.

5. Prohibited conduct
Harassment, fraud, counterfeit goods, hate speech, and illegal activity are prohibited. We may suspend accounts that violate these rules.

6. Limitation of liability
CityConnect is provided "as is." We are not liable for indirect damages arising from use of the platform.

7. Contact
For questions about these terms, use Help & Support in Settings.`,
  },
  privacy: {
    title: 'Privacy Policy',
    body: `CityConnect Privacy Policy

Last updated: August 2026

1. Information we collect
• Account details (name, phone, email, city, role)
• Location data you provide for nearby discovery
• Order, cart, and messaging activity within the app
• Push notification tokens when you opt in

2. How we use information
We use your data to operate marketplace features, personalize feeds, deliver notifications you enable, and improve reliability.

3. Sharing
Shop and service providers receive information needed to fulfil orders or respond to requests you initiate. We do not sell personal data.

4. Storage & security
Data is stored on Supabase infrastructure with row-level security. You may request account deletion through support.

5. Your choices
You can disable push notifications in Settings. Location can be updated from Profile.

6. Children's privacy
CityConnect is not directed at children under 13.

7. Updates
We may update this policy and will reflect changes in the app.`,
  },
  help: {
    title: 'Help & Support',
    body: `CityConnect Help & Support

Getting started
• Set your city and location in Profile for nearby shops and pros.
• Buyers can follow shops, save Daily stories, and place orders from the cart.
• Sellers can manage shop details, products, and enquiries from Profile settings.

Orders & cart
After checkout, order summaries are shared in shop chat. Track status by messaging the shop directly.

Service requests
Use Request Job / Quote on the Pros tab to send urgency and job notes to local professionals.

Notifications
Enable push notifications in Settings to receive order updates and seller alerts.

Unicode & language
CityConnect supports English and Hindi text in names, bios, and messages.

Contact
Email: support@cityconnect.app
We aim to respond within 2 business days.`,
  },
};

type LegalWebModalProps = {
  visible: boolean;
  docId: LegalDocId | null;
  onClose: () => void;
};

export function LegalWebModal({ visible, docId, onClose }: LegalWebModalProps) {
  const doc = docId ? DOCS[docId] : null;
  if (!doc) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.title}>{doc.title}</Text>
          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={[s.body, unicodeProsStyle]}>{doc.body}</Text>
          </ScrollView>
          <Pressable style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>Close</Text>
          </Pressable>
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
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border2, alignSelf: 'center', marginBottom: 14 },
  title: { color: Colors.text, fontSize: 20, fontWeight: '800', fontFamily: Fonts.bodySemiBold, marginBottom: 12 },
  scroll: { maxHeight: 420 },
  body: { color: Colors.sub, fontSize: 14, lineHeight: 22 },
  closeBtn: { marginTop: 14, backgroundColor: Colors.orange, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
}));
