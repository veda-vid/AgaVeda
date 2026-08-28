import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { Colors } from '../../constants/theme';
import { isProfileVideoItem } from '../../lib/profileMedia';
import type { Post } from '../../types';
import { parseTextCardCaption } from '../feed/feedUtils';
import { getTextBackground, getTextColor, getTextFontStyle } from '../feed/feedTextCard';

type Props = {
  post: Post;
  style?: object;
  imageStyle?: object;
};

export function ProfileGridThumb({ post, style, imageStyle }: Props) {
  const uri = post.media_urls?.[0];
  const isVideo = isProfileVideoItem(post);
  const textMeta = parseTextCardCaption(post.caption);

  if (!uri) {
    if (!textMeta) {
      return (
        <View style={[st.fallback, style]}>
          <Text style={st.emoji}>{isVideo ? '▶' : '📷'}</Text>
        </View>
      );
    }
    return (
      <View style={[st.textCard, { backgroundColor: getTextBackground(textMeta.background) }, style]}>
        <Text
          style={[
            st.textCardText,
            getTextFontStyle((textMeta as any).fontStyle ?? (textMeta as any).style ?? 'classic'),
            { color: getTextColor((textMeta as any).textColor) },
          ]}
          numberOfLines={3}
        >
          {textMeta.text}
        </Text>
      </View>
    );
  }

  if (isVideo) {
    return (
      <View style={[st.videoShell, style]}>
        {Platform.OS === 'web' ? (
          <video
            src={uri}
            muted
            playsInline
            preload="metadata"
            style={{ width: '100%', height: '100%', objectFit: 'cover' } as object}
          />
        ) : (
          <View style={st.videoPoster} />
        )}
        <View style={st.playBadge}>
          <Text style={st.playBadgeText}>▶</Text>
        </View>
      </View>
    );
  }

  return <Image source={{ uri }} style={[st.image, imageStyle, style]} resizeMode="cover" />;
}

const st = StyleSheet.create({
  image: { width: '100%', height: '100%' },
  fallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  emoji: { fontSize: 28, opacity: 0.45 },
  videoShell: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.black,
    overflow: 'hidden',
    position: 'relative',
  },
  videoPoster: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.surface,
  },
  playBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#000000AA',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  playBadgeText: { color: Colors.white, fontSize: 12, fontWeight: '800' },
  textCard: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  textCardText: { textAlign: 'center', fontWeight: '700', fontSize: 12 },
});
