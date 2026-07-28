// app/(tabs)/index.tsx — Instagram-style feed (buyer following + seller create)
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Image, ActivityIndicator, RefreshControl, StyleSheet, Dimensions, Modal, Pressable, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import {
  getFeed, getFollowingFeed, likePost, unlikePost, savePost, unsavePost,
  getComments, addComment, getStories, createStory, getReels, createReel,
  globalSearch, getShopByOwner, uploadImage,
} from '../../lib/api';
import { Colors } from '../../constants/theme';
import type { Story, Reel, SearchResult } from '../../types';

const W = Dimensions.get('window').width;

function PostCard({
  post, userId, isBuyer, onAddToCart,
}: {
  post: any;
  userId: string;
  isBuyer: boolean;
  onAddToCart?: (productId: string, shopId: string) => void;
}) {
  const [liked, setLiked] = useState(post.is_liked ?? false);
  const [saved, setSaved] = useState(post.is_saved ?? false);
  const [likes, setLikes] = useState(post.total_likes ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const handleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikes((l: number) => l + (next ? 1 : -1));
    try {
      if (next) await likePost(userId, post.id);
      else await unlikePost(userId, post.id);
    } catch {}
  };

  const handleSave = async () => {
    const next = !saved;
    setSaved(next);
    try {
      if (next) await savePost(userId, post.id);
      else await unsavePost(userId, post.id);
    } catch {}
  };

  const openComments = async () => {
    setShowComments(true);
    if (comments.length) return;
    setLoadingComments(true);
    try { setComments(await getComments(post.id)); }
    catch {} finally { setLoadingComments(false); }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    try {
      const c = await addComment(userId, post.id, commentText.trim());
      setComments(prev => [...prev, c]);
      setCommentText('');
    } catch {}
  };

  const productId = post.product_id || post.product?.id;

  return (
    <View style={pf.card}>
      <View style={pf.header}>
        <View style={pf.shopIcon}><Text style={pf.shopEmoji}>{post.shop_logo ?? '🏪'}</Text></View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={pf.shopName}>{post.shop_name}</Text>
            {post.is_ad && <View style={pf.adBadge}><Text style={pf.adText}>Sponsored</Text></View>}
          </View>
          <Text style={pf.shopMeta}>
            {post.shop_category} · {post.distance_km ? `${Number(post.distance_km).toFixed(1)} km · ` : ''}{timeAgo(post.created_at)}
            {post.shop_avg_rating ? ` · ⭐ ${post.shop_avg_rating}` : ''}
          </Text>
        </View>
      </View>

      <View style={pf.media}>
        {post.media_urls?.length > 0
          ? <Image source={{ uri: post.media_urls[0] }} style={pf.image} resizeMode="cover" />
          : <View style={pf.imagePlaceholder}><Text style={{ fontSize: 60 }}>🏪</Text></View>}
        {post.media_type === 'video' && (
          <View style={pf.videoBadge}><Text style={pf.videoBadgeText}>▶</Text></View>
        )}
      </View>

      {!post.is_ad && (
        <View style={pf.actions}>
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
            <TouchableOpacity onPress={handleLike}><Text style={[pf.actionIcon, liked && { color: Colors.red }]}>{liked ? '❤️' : '🤍'}</Text></TouchableOpacity>
            <TouchableOpacity onPress={openComments}><Text style={pf.actionIcon}>💬</Text></TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {isBuyer && productId && onAddToCart && (
              <TouchableOpacity
                style={pf.cartChip}
                onPress={() => onAddToCart(productId, post.shop_id)}
              >
                <Text style={pf.cartChipText}>🛒 Add</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleSave}>
              <Text style={[pf.actionIcon, saved && { color: Colors.amber }]}>{saved ? '🔖' : '🏷️'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!post.is_ad && (
        <View style={pf.caption}>
          <Text style={pf.likesText}>{likes} likes</Text>
          <Text style={pf.captionText}><Text style={pf.shopNameInline}>{post.shop_name}</Text> {post.caption}</Text>
          {post.total_comments > 0 && !showComments && (
            <TouchableOpacity onPress={openComments}>
              <Text style={pf.viewComments}>View all {post.total_comments} comments</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {showComments && (
        <View style={pf.commentsSection}>
          {loadingComments
            ? <ActivityIndicator color={Colors.orange} style={{ marginVertical: 12 }} />
            : comments.map(c => (
              <View key={c.id} style={pf.commentRow}>
                <View style={pf.commentAvatar}><Text>😊</Text></View>
                <View style={pf.commentBubble}>
                  <Text style={pf.commentUser}>{c.user?.name ?? 'User'}</Text>
                  <Text style={pf.commentText}>{c.text}</Text>
                </View>
              </View>
            ))}
          <View style={pf.commentInput}>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment…"
              placeholderTextColor={Colors.dim}
              style={pf.commentField}
            />
            <TouchableOpacity onPress={submitComment}><Text style={pf.commentPost}>Post</Text></TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const profile = useAuthStore(s => s.profile);
  const followedShopIds = useAuthStore(s => s.followedShopIds);
  const notifications = useAuthStore(s => s.notifications);
  const addNotification = useAuthStore(s => s.addNotification);
  const clearNotifications = useAuthStore(s => s.clearNotifications);
  const loadNotifications = useAuthStore(s => s.loadNotifications);
  const addItem = useCartStore(s => s.addItem);
  const loadCart = useCartStore(s => s.loadCart);

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [feedMode, setFeedMode] = useState<'nearby' | 'following'>('nearby');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showStoryComposer, setShowStoryComposer] = useState(false);
  const [showReelComposer, setShowReelComposer] = useState(false);
  const [storyDraft, setStoryDraft] = useState('');
  const [reelDraft, setReelDraft] = useState('');
  const [reelTags, setReelTags] = useState('');
  const [storyMedia, setStoryMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [reelMedia, setReelMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [posting, setPosting] = useState(false);
  const [viewStory, setViewStory] = useState<Story | null>(null);

  const pageRef = useRef(0);
  const loadingRef = useRef(false);
  const feedModeRef = useRef(feedMode);
  const followedRef = useRef(followedShopIds);
  const socialLoadedRef = useRef(false);
  const modeInitializedRef = useRef(false);

  const isSeller = profile?.role === 'seller' || profile?.role === 'service_provider';
  const isBuyer = profile?.role === 'buyer';

  feedModeRef.current = feedMode;
  followedRef.current = followedShopIds;

  const load = useCallback(async (reset = false) => {
    if (!profile) return;
    if (loadingRef.current && !reset) return;
    if (!reset && !hasMore) return;

    loadingRef.current = true;
    if (reset) {
      setLoading(true);
      setHasMore(true);
      pageRef.current = 0;
    } else {
      setLoadingMore(true);
    }

    try {
      const p = reset ? 0 : pageRef.current;
      const mode = feedModeRef.current;
      let data: any[] = [];
      if (mode === 'following' && isBuyer) {
        data = await getFollowingFeed(profile.id, p, followedRef.current);
      } else {
        data = await getFeed(profile.lat ?? 19.076, profile.lng ?? 72.8777, profile.radius_km ?? 5, p);
      }
      const rows = Array.isArray(data) ? data : [];
      setPosts(prev => (reset ? rows : [...prev, ...rows]));
      setHasMore(rows.length >= 10);
      pageRef.current = p + 1;
    } catch (e) {
      console.error(e);
      if (reset) setPosts([]);
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [profile, isBuyer, hasMore]);

  // Initial + mode change load — do NOT depend on unstable callbacks
  useEffect(() => {
    if (!profile) return;
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.lat, profile?.lng, profile?.radius_km, feedMode]);

  // Social extras once (non-blocking)
  useEffect(() => {
    if (!profile || socialLoadedRef.current) return;
    socialLoadedRef.current = true;
    let cancelled = false;
    (async () => {
      const [st, rl] = await Promise.all([
        getStories(profile.id),
        getReels(isBuyer && followedShopIds.length ? followedShopIds : undefined),
      ]);
      if (cancelled) return;
      setStories(st);
      setReels(rl);
      loadNotifications(profile.id).catch(() => {});
      if (isBuyer) loadCart(profile.id).catch(() => {});
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Set following mode once after follows load — avoid toggling forever
  useEffect(() => {
    if (!profile || isSeller || modeInitializedRef.current) return;
    if (followedShopIds.length > 0) {
      modeInitializedRef.current = true;
      setFeedMode('following');
    }
  }, [followedShopIds.length, isSeller, profile]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || !profile) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await globalSearch(q, profile.lat ?? 19.076, profile.lng ?? 72.8777, Math.max(profile.radius_km ?? 5, 20));
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery, profile?.id, profile?.lat, profile?.lng, profile?.radius_km]);

  const onRefresh = () => {
    setRefreshing(true);
    socialLoadedRef.current = false;
    load(true);
    if (profile) {
      getStories(profile.id).then(setStories);
      getReels(isBuyer && followedShopIds.length ? followedShopIds : undefined).then(setReels);
      loadNotifications(profile.id).catch(() => {});
    }
  };

  const onEndReached = () => {
    if (loading || loadingMore || !hasMore || loadingRef.current) return;
    load(false);
  };

  const filteredPosts = posts.filter(post => {
    if (!searchQuery.trim() || searchResults.length > 0) return true;
    const q = searchQuery.toLowerCase();
    return [post.caption, post.shop_name, post.product?.title].filter(Boolean).join(' ').toLowerCase().includes(q);
  });

  const pickMedia = async (forStory: boolean) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const media = { uri: asset.uri, type: (asset.type === 'video' ? 'video' : 'image') as 'image' | 'video' };
    if (forStory) setStoryMedia(media);
    else setReelMedia(media);
  };

  const resolveMyShop = async () => {
    if (!profile) return null;
    const shop = await getShopByOwner(profile.id);
    if (!shop) {
      Alert.alert('Create your shop first', 'You need a shop before posting stories or reels.', [
        { text: 'Create Shop', onPress: () => router.push('/seller/shop' as any) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return null;
    }
    return shop;
  };

  const uploadMediaUrl = async (uri: string, type: 'image' | 'video', folder: string) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const ext = type === 'video' ? 'mp4' : 'jpg';
    const path = `${folder}/${profile!.id}/${Date.now()}.${ext}`;
    return uploadImage('cityconnect', path, blob, type === 'video' ? 'video/mp4' : 'image/jpeg');
  };

  const submitStory = async () => {
    if (!storyMedia && !storyDraft.trim()) {
      Alert.alert('Add media or caption');
      return;
    }
    setPosting(true);
    try {
      const shop = await resolveMyShop();
      if (!shop) return;
      let mediaUrl = storyMedia?.uri ?? '';
      let mediaType: 'image' | 'video' = storyMedia?.type ?? 'image';
      if (storyMedia) {
        mediaUrl = await uploadMediaUrl(storyMedia.uri, storyMedia.type, 'stories');
      } else {
        // Text-only story: use a data placeholder color block via empty and caption
        mediaUrl = 'https://placehold.co/600x900/141420/FF5722/png?text=Story';
        mediaType = 'image';
      }
      const created = await createStory({
        shop_id: shop.id,
        author_id: profile!.id,
        media_url: mediaUrl,
        media_type: mediaType,
        caption: storyDraft.trim(),
      });
      setStories(prev => [created, ...prev]);
      setStoryDraft('');
      setStoryMedia(null);
      setShowStoryComposer(false);
      addNotification('Story shared — followers will see it for 24 hours.');
    } catch (e: any) {
      Alert.alert('Could not post story', e.message || 'Try again after running the social migration SQL.');
    } finally {
      setPosting(false);
    }
  };

  const submitReel = async () => {
    if (!reelMedia) { Alert.alert('Pick a short video or image for your reel'); return; }
    setPosting(true);
    try {
      const shop = await resolveMyShop();
      if (!shop) return;
      const mediaUrl = await uploadMediaUrl(reelMedia.uri, reelMedia.type, 'reels');
      const tags = reelTags.trim().split(/[\s,]+/).filter(Boolean).map(t => t.replace(/^#/, ''));
      const created = await createReel({
        shop_id: shop.id,
        author_id: profile!.id,
        media_url: mediaUrl,
        caption: reelDraft.trim(),
        tags,
      });
      setReels(prev => [{ ...created, shop_name: shop.name }, ...prev]);
      setReelDraft('');
      setReelTags('');
      setReelMedia(null);
      setShowReelComposer(false);
      addNotification('Reel published.');
    } catch (e: any) {
      Alert.alert('Could not post reel', e.message || 'Try again after running the social migration SQL.');
    } finally {
      setPosting(false);
    }
  };

  const handleAddToCart = async (productId: string, shopId: string) => {
    if (!profile) return;
    try {
      await addItem(profile.id, productId, shopId, 1);
      addNotification('Added to cart');
      Alert.alert('Added', 'Product added to your cart.');
    } catch (e: any) {
      Alert.alert('Cart', e.message || 'Could not add — ensure cart migration is applied.');
    }
  };

  if (loading) {
    return (
      <View style={ff.loader}>
        <ActivityIndicator color={Colors.orange} size="large" />
      </View>
    );
  }

  return (
    <View style={ff.root}>
      <View style={ff.header}>
        <View>
          <Text style={ff.brand}>CityConnect</Text>
          <Text style={ff.location}>📍 {profile?.city} · {profile?.radius_km} km{isBuyer ? ' · Buyer' : ' · Seller'}</Text>
        </View>
        <View style={ff.headerIcons}>
          <TouchableOpacity onPress={() => setShowNotifications(true)}>
            <Text style={ff.icon}>🔔</Text>
            {notifications.length > 0 && <View style={ff.notifDot} />}
          </TouchableOpacity>
          {isSeller && (
            <>
              <TouchableOpacity onPress={() => router.push('/seller/shop' as any)}><Text style={ff.icon}>🏪</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setShowReelComposer(true)}><Text style={ff.icon}>🎬</Text></TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <View style={ff.searchBar}>
        <Text style={ff.searchIcon}>🔍</Text>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={isBuyer ? 'Search products & shops globally' : 'Search your feed'}
          placeholderTextColor={Colors.dim}
          style={ff.searchInput}
        />
        {searching && <ActivityIndicator color={Colors.orange} size="small" />}
      </View>

      {searchResults.length > 0 && (
        <View style={ff.searchResults}>
          {searchResults.slice(0, 8).map(r => (
            <TouchableOpacity key={`${r.result_type}-${r.id}`} style={ff.searchRow}>
              <Text style={ff.searchType}>{r.result_type === 'shop' ? '🏪' : '📦'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={ff.searchTitle}>{r.title}</Text>
                <Text style={ff.searchSub}>{r.subtitle} · {Number(r.distance_km).toFixed(1)} km</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isBuyer && (
        <View style={ff.feedModeRow}>
          <TouchableOpacity onPress={() => setFeedMode('nearby')} style={[ff.feedModeChip, feedMode === 'nearby' && ff.feedModeChipActive]}>
            <Text style={[ff.feedModeText, feedMode === 'nearby' && ff.feedModeTextActive]}>Nearby</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFeedMode('following')} style={[ff.feedModeChip, feedMode === 'following' && ff.feedModeChipActive]}>
            <Text style={[ff.feedModeText, feedMode === 'following' && ff.feedModeTextActive]}>Following</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filteredPosts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            userId={profile!.id}
            isBuyer={!!isBuyer}
            onAddToCart={handleAddToCart}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        removeClippedSubviews
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.orange} style={{ marginVertical: 16 }} /> : null}
        ListHeaderComponent={
          <View>
            <View style={ff.stories}>
              {isSeller && (
                <TouchableOpacity style={sf.story} onPress={() => setShowStoryComposer(true)}>
                  <View style={[sf.storyRing, { borderStyle: 'dashed' }]}>
                    <View style={sf.storyAvatar}><Text style={sf.storyEmoji}>➕</Text></View>
                  </View>
                  <Text style={sf.storyName}>Your Story</Text>
                </TouchableOpacity>
              )}
              {stories.map(story => (
                <TouchableOpacity key={story.id} style={sf.story} onPress={() => setViewStory(story)}>
                  <View style={sf.storyRing}>
                    <View style={sf.storyAvatar}>
                      {story.media_url
                        ? <Image source={{ uri: story.media_url }} style={sf.storyImg} />
                        : <Text style={sf.storyEmoji}>✨</Text>}
                    </View>
                  </View>
                  <Text style={sf.storyName} numberOfLines={1}>{story.shop_name ?? 'Shop'}</Text>
                </TouchableOpacity>
              ))}
              {!isSeller && stories.length === 0 && (
                <Text style={ff.storyHint}>Follow shops to see their stories here</Text>
              )}
            </View>

            {reels.length > 0 && (
              <View style={ff.reelStrip}>
                {reels.slice(0, 4).map(reel => (
                  <View key={reel.id} style={ff.reelCard}>
                    <Text style={ff.reelBadge}>REEL</Text>
                    <Text style={ff.reelTitle} numberOfLines={1}>{reel.shop_name ?? 'Shop'}</Text>
                    <Text style={ff.reelText} numberOfLines={2}>{reel.caption}</Text>
                  </View>
                ))}
              </View>
            )}

            {notifications.length > 0 && isBuyer && (
              <TouchableOpacity style={ff.noticeBar} onPress={() => setShowNotifications(true)}>
                <Text style={ff.noticeText}>🔔 {notifications[0]}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={ff.emptyState}>
            <Text style={ff.emptyEmoji}>{feedMode === 'following' ? '🫶' : '🛍️'}</Text>
            <Text style={ff.emptyText}>
              {feedMode === 'following'
                ? 'Follow shops to get their posts, stories and updates here — like Instagram.'
                : 'No posts nearby yet. Try a larger radius or follow shops.'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      <Modal transparent visible={showNotifications} animationType="fade" onRequestClose={() => setShowNotifications(false)}>
        <Pressable style={ff.modalBackdrop} onPress={() => setShowNotifications(false)}>
          <View style={ff.modalSheet}>
            <View style={ff.modalHandle} />
            <View style={ff.modalHeaderRow}>
              <Text style={ff.modalTitle}>Updates from followed shops</Text>
              <TouchableOpacity onPress={() => clearNotifications()}><Text style={ff.modalClear}>Clear</Text></TouchableOpacity>
            </View>
            {notifications.length === 0
              ? <Text style={ff.modalEmpty}>No updates yet. Follow shops to get notified.</Text>
              : notifications.map((item, index) => (
                <View key={`${item}-${index}`} style={ff.noticeItem}>
                  <Text style={ff.noticeItemText}>{item}</Text>
                </View>
              ))}
          </View>
        </Pressable>
      </Modal>

      <Modal transparent visible={!!viewStory} animationType="fade" onRequestClose={() => setViewStory(null)}>
        <Pressable style={ff.storyViewer} onPress={() => setViewStory(null)}>
          {viewStory && (
            <View style={ff.storyViewerInner}>
              <Image source={{ uri: viewStory.media_url }} style={ff.storyFull} resizeMode="cover" />
              <Text style={ff.storyCaption}>{viewStory.shop_name}: {viewStory.caption}</Text>
            </View>
          )}
        </Pressable>
      </Modal>

      <Modal transparent visible={showStoryComposer} animationType="slide" onRequestClose={() => setShowStoryComposer(false)}>
        <View style={ff.modalBackdrop}>
          <View style={ff.modalSheet}>
            <View style={ff.modalHandle} />
            <Text style={ff.modalTitle}>Create Story</Text>
            <TouchableOpacity style={ff.mediaPick} onPress={() => pickMedia(true)}>
              <Text style={ff.mediaPickText}>{storyMedia ? '✓ Media selected — tap to change' : '📷 Pick photo or short video'}</Text>
            </TouchableOpacity>
            <TextInput
              value={storyDraft}
              onChangeText={setStoryDraft}
              multiline
              placeholder="Caption (optional)"
              placeholderTextColor={Colors.dim}
              style={ff.modalInput}
            />
            <TouchableOpacity onPress={submitStory} style={ff.primaryBtn} disabled={posting}>
              {posting ? <ActivityIndicator color="#fff" /> : <Text style={ff.primaryBtnText}>Share Story</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showReelComposer} animationType="slide" onRequestClose={() => setShowReelComposer(false)}>
        <View style={ff.modalBackdrop}>
          <View style={ff.modalSheet}>
            <View style={ff.modalHandle} />
            <Text style={ff.modalTitle}>Create Reel</Text>
            <TouchableOpacity style={ff.mediaPick} onPress={() => pickMedia(false)}>
              <Text style={ff.mediaPickText}>{reelMedia ? '✓ Media selected — tap to change' : '🎬 Pick short video or image'}</Text>
            </TouchableOpacity>
            <TextInput
              value={reelDraft}
              onChangeText={setReelDraft}
              multiline
              placeholder="Caption"
              placeholderTextColor={Colors.dim}
              style={ff.modalInput}
            />
            <TextInput
              value={reelTags}
              onChangeText={setReelTags}
              placeholder="Tags: fashion sale local"
              placeholderTextColor={Colors.dim}
              style={[ff.modalInput, { minHeight: 44 }]}
            />
            <TouchableOpacity onPress={submitReel} style={ff.primaryBtn} disabled={posting}>
              {posting ? <ActivityIndicator color="#fff" /> : <Text style={ff.primaryBtnText}>Publish Reel</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function timeAgo(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const ff = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bg },
  brand: { fontSize: 22, fontWeight: '800', color: Colors.orange },
  location: { fontSize: 11, color: Colors.sub, marginTop: 1 },
  headerIcons: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  icon: { fontSize: 22 },
  notifDot: { position: 'absolute', top: 0, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.red },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 24, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 8 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 14 },
  searchResults: { marginHorizontal: 16, marginTop: 8, backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border2, overflow: 'hidden' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchType: { fontSize: 18 },
  searchTitle: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  searchSub: { color: Colors.sub, fontSize: 11, marginTop: 2 },
  feedModeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  feedModeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border2 },
  feedModeChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  feedModeText: { color: Colors.sub, fontSize: 12, fontWeight: '700' },
  feedModeTextActive: { color: Colors.white },
  stories: { flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: 'center' },
  storyHint: { color: Colors.dim, fontSize: 12, flex: 1 },
  reelStrip: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  reelCard: { width: 140, backgroundColor: Colors.card, borderRadius: 14, padding: 12, gap: 4 },
  reelBadge: { color: Colors.orange, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  reelTitle: { color: Colors.text, fontWeight: '700', fontSize: 12 },
  reelText: { color: Colors.sub, fontSize: 11, lineHeight: 16 },
  noticeBar: { marginHorizontal: 16, marginTop: 10, borderRadius: 12, backgroundColor: Colors.orange + '15', paddingHorizontal: 12, paddingVertical: 10 },
  noticeText: { color: Colors.orange, fontWeight: '600', fontSize: 12 },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyText: { color: Colors.sub, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  modalBackdrop: { flex: 1, backgroundColor: '#000A', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border2, alignSelf: 'center', marginBottom: 16 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  modalClear: { color: Colors.orange, fontWeight: '700' },
  modalEmpty: { color: Colors.sub, paddingVertical: 8 },
  noticeItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  noticeItemText: { color: Colors.text, fontSize: 13 },
  modalInput: { backgroundColor: Colors.card, borderRadius: 12, padding: 12, color: Colors.text, minHeight: 80, marginBottom: 12, textAlignVertical: 'top' },
  mediaPick: { backgroundColor: Colors.card, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border2 },
  mediaPickText: { color: Colors.sub, fontWeight: '600' },
  primaryBtn: { backgroundColor: Colors.orange, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: Colors.white, fontWeight: '700' },
  storyViewer: { flex: 1, backgroundColor: '#000E', justifyContent: 'center' },
  storyViewerInner: { flex: 1 },
  storyFull: { flex: 1, width: '100%' },
  storyCaption: { position: 'absolute', bottom: 48, left: 16, right: 16, color: Colors.white, fontSize: 15, fontWeight: '600' },
});

const sf = StyleSheet.create({
  story: { alignItems: 'center', width: 64, gap: 5 },
  storyRing: { width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, borderColor: Colors.orange, padding: 2 },
  storyAvatar: { flex: 1, borderRadius: 28, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  storyImg: { width: '100%', height: '100%' },
  storyEmoji: { fontSize: 26 },
  storyName: { fontSize: 10, color: Colors.sub, textAlign: 'center' },
});

const pf = StyleSheet.create({
  card: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  shopIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.orange },
  shopEmoji: { fontSize: 22 },
  shopName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  shopMeta: { fontSize: 11, color: Colors.sub, marginTop: 1 },
  adBadge: { backgroundColor: Colors.blue + '22', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
  adText: { fontSize: 9, color: Colors.blue, fontWeight: '700' },
  media: { width: W, height: W, backgroundColor: Colors.card, position: 'relative' },
  image: { width: W, height: W },
  imagePlaceholder: { width: W, height: W, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  videoBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#000C', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  videoBadgeText: { color: Colors.white, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  actionIcon: { fontSize: 26 },
  cartChip: { backgroundColor: Colors.orange + '22', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Colors.orange + '55' },
  cartChipText: { color: Colors.orange, fontWeight: '700', fontSize: 12 },
  caption: { paddingHorizontal: 16, paddingBottom: 12, gap: 3 },
  likesText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  captionText: { fontSize: 13, color: Colors.text, lineHeight: 18 },
  shopNameInline: { fontWeight: '700' },
  viewComments: { fontSize: 12, color: Colors.dim, marginTop: 2 },
  commentsSection: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  commentRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  commentBubble: { flex: 1, backgroundColor: Colors.card, borderRadius: 10, padding: 8 },
  commentUser: { fontSize: 12, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  commentText: { fontSize: 13, color: Colors.text },
  commentInput: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  commentField: { flex: 1, backgroundColor: Colors.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, color: Colors.text, fontSize: 14 },
  commentPost: { color: Colors.orange, fontWeight: '700', fontSize: 14 },
});
