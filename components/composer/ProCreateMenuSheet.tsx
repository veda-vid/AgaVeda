import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';

type ProCreateMenuSheetProps = {
  onStory: () => void;
  onSpark: () => void;
  onTextUpdate: () => void;
  onListService: () => void;
};

export function ProCreateMenuSheet({
  onStory, onSpark, onTextUpdate, onListService,
}: ProCreateMenuSheetProps) {
  return (
    <>
      <Text style={s.menuTitle}>Share from your profile</Text>
      <TouchableOpacity style={s.createRow} onPress={onListService}>
        <Text style={s.createIcon}>🛠️</Text>
        <View style={s.createTextWrap}>
          <Text style={s.createTitle}>List service / skill</Text>
          <Text style={s.createSub}>Update category, rates, experience, and portfolio.</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={s.createRow} onPress={onStory}>
        <Text style={s.createIcon}>✨</Text>
        <View style={s.createTextWrap}>
          <Text style={s.createTitle}>Story bubble</Text>
          <Text style={s.createSub}>A 24-hour highlight with photo or text.</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={s.createRow} onPress={onSpark}>
        <Text style={s.createIcon}>🎬</Text>
        <View style={s.createTextWrap}>
          <Text style={s.createTitle}>Moment</Text>
          <Text style={s.createSub}>Short vertical video for the Moments tab.</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={s.createRow} onPress={onTextUpdate}>
        <Text style={s.createIcon}>✏️</Text>
        <View style={s.createTextWrap}>
          <Text style={s.createTitle}>Text update</Text>
          <Text style={s.createSub}>Share news, availability, or job updates.</Text>
        </View>
      </TouchableOpacity>
    </>
  );
}

const s = createDynamicStyles((Colors) => ({
  menuTitle: {
    fontSize: 16,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 8,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  createIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  createTextWrap: { flex: 1 },
  createTitle: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
  },
  createSub: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.sub,
    lineHeight: 16,
  },
}));
