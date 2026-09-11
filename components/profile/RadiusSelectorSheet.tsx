// components/profile/RadiusSelectorSheet.tsx — Discovery radius picker

import { useEffect, useState } from 'react';
import {
  View, Text, Modal, Pressable, Platform,
} from 'react-native';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { PROFILE_RADIUS_OPTIONS, type ProfileRadiusKm } from '../../lib/profileUtils';
import { SpringPressable } from '../ui/modernSurfaces';

type Props = {
  visible: boolean;
  current: number;
  locked?: boolean;
  onSave: (km: number) => void;
  onClose: () => void;
};

export function RadiusSelectorSheet({
  visible, current, locked, onSave, onClose,
}: Props) {
  const [radius, setRadius] = useState(current);

  useEffect(() => {
    if (visible) setRadius(current);
  }, [visible, current]);

  const apply = () => {
    if (locked) {
      onClose();
      return;
    }
    onSave(radius);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          <Text style={s.title}>Discovery Radius</Text>
          <Text style={s.sub}>
            {locked
              ? 'Shop discovery area is locked after setup. Contact support to change coverage.'
              : 'Preview how far you want to discover shops and services.'}
          </Text>

          <View style={s.preview}>
            <Text style={s.previewEmoji}>📡</Text>
            <Text style={s.previewValue}>{radius} km</Text>
            <Text style={s.previewHint}>Live coverage preview</Text>
          </View>

          <View style={s.chipRow}>
            {PROFILE_RADIUS_OPTIONS.map(km => {
              const active = radius === km;
              return (
                <SpringPressable
                  key={km}
                  pressedScale={0.96}
                  disabled={locked}
                  style={[s.chip, active && s.chipActive, locked && s.chipLocked]}
                  onPress={() => setRadius(km as ProfileRadiusKm)}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{km} km</Text>
                </SpringPressable>
              );
            })}
          </View>

          <SpringPressable
            style={[s.btn, locked && s.btnMuted]}
            pressedScale={0.97}
            onPress={apply}
          >
            <Text style={[s.btnText, locked && s.btnTextMuted]}>{locked ? 'Close' : 'Apply Coverage'}</Text>
          </SpringPressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = createDynamicStyles((Colors) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border2,
    marginBottom: 12,
  },
  title: {
    textAlign: 'center',
    fontSize: 18,
    fontFamily: Fonts.display,
    fontWeight: '800',
    color: Colors.text,
  },
  sub: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.sub,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 17,
  },
  preview: {
    alignItems: 'center',
    paddingVertical: 18,
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
    marginBottom: 16,
    gap: 4,
  },
  previewEmoji: { fontSize: 28 },
  previewValue: {
    fontSize: 32,
    fontFamily: Fonts.displayXBold,
    fontWeight: '900',
    color: Colors.orange,
  },
  previewHint: { fontSize: 12, color: Colors.dim, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  chipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  chipLocked: { opacity: 0.55 },
  chipText: { color: Colors.sub, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: Colors.white },
  btn: {
    backgroundColor: Colors.orange,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnMuted: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2 },
  btnText: { color: Colors.white, fontWeight: '800', fontSize: 15 },
  btnTextMuted: { color: Colors.text },
}));
