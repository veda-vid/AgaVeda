// components/profile/PostViewerModal.tsx — Full-screen profile media viewer

import {
  View, Text, Image, Modal, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { formatPostDate, type ProfilePostItem } from '../../lib/profileUtils';
import { isProfileVideoItem } from '../../lib/profileMedia';
import { parseTextCardCaption, timeAgo } from '../feed/feedUtils';
import { getTextBackground, getTextColor, getTextFontStyle } from '../feed/feedTextCard';
import { FeedVideo } from '../feed/FeedVideo';
import { getRoleEmoji } from '../../stores/roleUtils';
import type { UserRole } from '../../types';

type Props = {
  visible: boolean;
  posts: ProfilePostItem[];
  startIndex: number;
  profileName: string;
  avatarUrl?: string | null;
  role?: UserRole | null;
  showRepostContext?: boolean;
  onClose: () => void;
};

export function PostViewerModal({
  visible,
  posts,
  startIndex,
  profileName,
  avatarUrl,
  role,
  showRepostContext,
  onClose,
}: Props) {
  const visiblePosts = posts.slice(Math.max(0, startIndex));
  const roleEmoji = getRoleEmoji(role);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.85}>
            <Text style={s.closeText}>‹</Text>
          </TouchableOpacity>
          <View style={s.headerCopy}>
            <Text style={s.title}>Posts</Text>
            <Text style={s.subtitle}>
              {posts.length
                ? `${startIndex + 1} of ${posts.length} · newest to oldest`
                : 'No posts yet'}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={visiblePosts}
          keyExtractor={(item, index) => item.feed_item_id ?? item.id ?? `viewer-${index}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.list}
          renderItem={({ item }) => {
            const textMeta = parseTextCardCaption(item.caption);
            const displayCaption = textMeta ? textMeta.text : item.caption;
            const showRepostBadge = showRepostContext
              || !!(item as any).is_repost_entry
              || !!(item as any).reposted_by_name;
            const repostLabel = (item as any).reposted_by_name || profileName || 'You';
            const uri = item.media_urls?.[0];

            return (
              <View style={s.card}>
                {showRepostBadge ? (
                  <View style={s.repostBanner}>
                    <Text style={s.repostText}>🔁 {repostLabel} reposted</Text>
                  </View>
                ) : null}
                {(item as any).quote_caption ? (
                  <Text style={s.quote}>{(item as any).quote_caption}</Text>
                ) : null}

                <View style={s.cardHeader}>
                  <View style={s.avatar}>
                    {!item.shop_name && avatarUrl
                      ? <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
                      : <Text style={s.avatarEmoji}>{item.shop_name ? '🏪' : roleEmoji}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{item.shop_name ?? profileName}</Text>
                    <Text style={s.meta}>
                      {timeAgo(item.created_at)} · {formatPostDate(item.created_at)}
                    </Text>
                  </View>
                </View>

                {uri ? (
                  isProfileVideoItem(item) ? (
                    <View style={s.mediaBox}>
                      <FeedVideo uri={uri} style={s.media} />
                    </View>
                  ) : (
                    <Image source={{ uri }} style={s.media} resizeMode="cover" />
                  )
                ) : textMeta ? (
                  <View style={[s.textCard, { backgroundColor: getTextBackground(textMeta.background) }]}>
                    <Text
                      style={[
                        s.textCardText,
                        getTextFontStyle((textMeta as any).fontStyle ?? (textMeta as any).style ?? 'classic'),
                        { color: getTextColor((textMeta as any).textColor) },
                      ]}
                    >
                      {textMeta.text}
                    </Text>
                  </View>
                ) : null}

                {displayCaption && !textMeta ? (
                  <Text style={s.caption}>{displayCaption}</Text>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No posts yet</Text>
              <Text style={s.emptyText}>
                When this account shares posts, they will appear here in posting order.
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 32, color: Colors.text, marginTop: -4 },
  headerCopy: { flex: 1, alignItems: 'center' },
  title: { fontSize: 16, fontFamily: Fonts.bodySemiBold, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 11, color: Colors.dim, marginTop: 2 },
  list: { padding: 16, paddingBottom: 40, gap: 16 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border2,
    overflow: 'hidden',
    marginBottom: 14,
  },
  repostBanner: {
    backgroundColor: Colors.orange + '18',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  repostText: { color: Colors.orange, fontWeight: '700', fontSize: 12 },
  quote: {
    paddingHorizontal: 14,
    paddingTop: 10,
    color: Colors.sub,
    fontStyle: 'italic',
    fontSize: 13,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 18 },
  name: { color: Colors.text, fontWeight: '800', fontSize: 14 },
  meta: { color: Colors.dim, fontSize: 11, marginTop: 2 },
  mediaBox: { width: '100%', aspectRatio: 1, backgroundColor: Colors.black },
  media: { width: '100%', aspectRatio: 1, backgroundColor: Colors.surface },
  textCard: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  textCardText: { textAlign: 'center', fontWeight: '700', fontSize: 18 },
  caption: {
    padding: 14,
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  emptyText: { color: Colors.dim, fontSize: 13, textAlign: 'center', lineHeight: 18 },
}));
