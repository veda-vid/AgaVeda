import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';

const CAPTION_LIMIT = 120;

type CaptionBlockProps = {
  username: string;
  caption?: string | null;
  isTextCard?: boolean;
};

export function CaptionBlock({ username, caption, isTextCard }: CaptionBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const body = isTextCard ? 'shared an update' : (caption || '').trim();
  const isLong = body.length > CAPTION_LIMIT;
  const display = expanded || !isLong ? body : `${body.slice(0, CAPTION_LIMIT).trim()}…`;

  if (!body && !username) return null;

  return (
    <Text style={s.caption}>
      <Text style={s.username}>{username} </Text>
      {display}
      {isLong && !expanded ? (
        <Text style={s.more} onPress={() => setExpanded(true)}> more</Text>
      ) : null}
    </Text>
  );
}

const s = createDynamicStyles((Colors) => ({
  caption: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: Colors.text,
    lineHeight: 20,
  },
  username: {
    fontWeight: '700',
    fontFamily: Fonts.bodySemiBold,
  },
  more: {
    color: Colors.dim,
    fontWeight: '600',
  },
}));
