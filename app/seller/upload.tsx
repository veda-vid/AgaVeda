// app/seller/upload.tsx — Seller product upload
import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Image, Alert, ActivityIndicator, StyleSheet, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../stores/authStore';
import { createProduct, createPost, uploadImage, getShopByOwner, updateShop, updateProfile as updateUserProfile } from '../../lib/api';
import { Colors, SHOP_CATEGORIES } from '../../constants/theme';

type MediaItem = { uri: string; type: 'image' | 'video' };

export default function UploadScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const updateLocalProfile = useAuthStore(s => s.updateProfile);

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [tags, setTags] = useState('');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('0');
  const [category, setCategory] = useState('grocery');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDesc('');
    setTags('');
    setPrice('');
    setDiscount('0');
    setCategory('grocery');
    setMediaItems([]);
  };

  const showMessage = (title: string, body: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${body}`);
      return;
    }
    Alert.alert(title, body);
  };

  const slugifyTag = (t: string) => t.trim().toLowerCase().replace(/^#/, '');

  const deriveCategoryFromTags = (rawTags: string): string | null => {
    const tokens = rawTags.split(/\s+/).map(slugifyTag).filter(Boolean);
    // Example: "#electronics" => "electronics"
    for (const slug of tokens) {
      const direct = (SHOP_CATEGORIES as readonly any[]).find(c =>
        c.id === slug || c.label.toLowerCase() === slug,
      );
      if (direct?.id) return direct.id;
    }
    return null;
  };

  const getTagQuery = (rawTags: string): string | null => {
    // Only consider the last "word" as the active hashtag token.
    const parts = rawTags.trimEnd().split(/\s+/).filter(Boolean);
    const last = parts[parts.length - 1] ?? '';
    if (!last.startsWith('#')) return null;
    return slugifyTag(last);
  };

  const tagQuery = getTagQuery(tags);
  const tagSuggestions = tagQuery
    ? SHOP_CATEGORIES.filter(c => c.id.includes(tagQuery) || c.label.toLowerCase().includes(tagQuery))
    : [];

  const setTagsWithAutoCategory = (next: string) => {
    setTags(next);
    const derived = deriveCategoryFromTags(next);
    if (derived) setCategory(derived);
  };

  const applyHashtagSuggestion = (catId: string) => {
    const parts = tags.trimEnd().split(/\s+/).filter(Boolean);
    if (parts.length && parts[parts.length - 1].startsWith('#')) parts.pop();
    const updated = [...parts, `#${catId}`].join(' ');
    setTagsWithAutoCategory(updated);
  };

  const pickMedia = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { showMessage('Permission needed', 'Allow photo access in Settings'); return; }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    });
    if (!result.canceled) {
      setMediaItems(prev => [...prev, ...result.assets.map(asset => ({
        uri: asset.uri,
        type: (asset.type === 'video' ? 'video' : 'image') as 'image' | 'video',
      }))].slice(0, 5));
    }
  };

  const removeMedia = (idx: number) => setMediaItems(prev => prev.filter((_, i) => i !== idx));

  const handlePost = async () => {
    if (!title.trim()) { showMessage('Required', 'Enter a product name'); return; }
    if (!price.trim()) { showMessage('Required', 'Enter a price'); return; }
    if (!profile) { showMessage('Error', 'Not logged in'); return; }

    setUploading(true);
    try {
      // #region agent log
      fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'094a50'},body:JSON.stringify({sessionId:'094a50',runId:'upload-debug',hypothesisId:'H2',location:'app/seller/upload.tsx:handlePost:start',message:'seller upload started',data:{role:profile.role,lat:profile.lat ?? null,lng:profile.lng ?? null,radius_km:profile.radius_km ?? null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      // RLS requires profiles.role to be 'seller' (or super_admin) for shops INSERT.
      if (profile.role !== 'seller' && profile.role !== 'super_admin') {
        try {
          await updateUserProfile(profile.id, { role: 'seller' });
          updateLocalProfile({ role: 'seller' });
        } catch (e: any) {
          showMessage('Role update failed', e?.message || 'Could not switch to seller mode.');
          setUploading(false);
          return;
        }
      }

      const myShop = await getShopByOwner(profile.id);
      if (!myShop) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const ok = window.confirm('No shop found.\n\nCreate your shop first before posting products.');
          if (ok) router.push('/seller/shop' as any);
        } else {
          Alert.alert('No shop found', 'Create your shop first before posting products.', [
            { text: 'Create Shop', onPress: () => router.push('/seller/shop' as any) },
            { text: 'Cancel', style: 'cancel' },
          ]);
        }
        setUploading(false); return;
      }

      const derivedShopCategory = deriveCategoryFromTags(tags);

      const uploadedUrls: string[] = [];
      for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        const response = await fetch(item.uri);
        const blob = await response.blob();
        const extension = item.type === 'video' ? 'mp4' : 'jpg';
        const path = `products/${profile.id}/${Date.now()}_${i}.${extension}`;
        const contentType = item.type === 'video' ? 'video/mp4' : 'image/jpeg';
        const url = await uploadImage('cityconnect', path, blob, contentType);
        uploadedUrls.push(url);
      }

      const product = await createProduct({
        shop_id: myShop.id,
        title: title.trim(),
        description: desc.trim(),
        price: parseFloat(price),
        discount_pct: parseInt(discount) || 0,
        images: uploadedUrls,
        category: category as any,
        is_available: true,
        is_featured: false,
      });

      const captionText = [desc.trim() || title.trim(), tags.trim() ? tags.trim().split(/\s+/).map(t => t.startsWith('#') ? t : `#${t}`).join(' ') : ''].filter(Boolean).join('\n');

      // If the user tagged a category (e.g. #electronics), align both:
      // - product.category (used by your DB schema)
      // - shop.category (used by the "Electronics" shops section)
      if (derivedShopCategory && myShop.category !== derivedShopCategory) {
        await updateShop(myShop.id, { category: derivedShopCategory } as any);
      }

      const createdPost = await createPost({
        shop_id: myShop.id,
        product_id: product.id,
        caption: captionText,
        media_urls: uploadedUrls,
        media_type: mediaItems[0]?.type ?? 'image',
      });
      // #region agent log
      fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'094a50'},body:JSON.stringify({sessionId:'094a50',runId:'upload-debug',hypothesisId:'H3',location:'app/seller/upload.tsx:handlePost:afterCreatePost',message:'post created (seller upload)',data:{shopId:myShop.id,productId:product.id,postId:createdPost?.id ?? null,createdAt:createdPost?.created_at ?? null,captionLen:captionText.length,mediaCount:uploadedUrls.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      // After a successful upload, always take the seller back to the home feed.
      resetForm();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('🎉 Posted! Your product is now live on the home feed.');
      } else {
        Alert.alert('🎉 Posted!', 'Your product is now live on the home feed.');
      }
      // #region agent log
      fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'094a50'},body:JSON.stringify({sessionId:'094a50',runId:'upload-debug',hypothesisId:'H1',location:'app/seller/upload.tsx:handlePost:navigateTabs',message:'navigating to home feed after post',data:{wasSellerRole:profile.role,hasShop:true},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      router.replace({ pathname: '/(tabs)', params: { refresh_feed: '1' } } as any);
    } catch (e: any) {
      // #region agent log
      fetch('http://127.0.0.1:7596/ingest/b546de14-4b7f-47d5-b143-061715fc5430',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'094a50'},body:JSON.stringify({sessionId:'094a50',runId:'upload-debug',hypothesisId:'H3',location:'app/seller/upload.tsx:handlePost:catch',message:'seller upload failed',data:{errorMessage:e?.message ?? String(e),role:profile?.role ?? null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      showMessage('Error', e?.message || 'Failed to post product');
    } finally { setUploading(false); }
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>✕</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>New Product</Text>
        <TouchableOpacity onPress={handlePost} disabled={uploading} style={s.postBtn}>
          {uploading ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={s.postBtnText}>Post</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>MEDIA (photos or short videos)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', gap: 10, paddingRight: 16 }}>
            {mediaItems.map((item, i) => (
              <View key={`${item.uri}-${i}`} style={s.imgThumb}>
                {item.type === 'video' ? <View style={s.thumbVideo}><Text style={{ fontSize: 28 }}>▶</Text></View> : <Image source={{ uri: item.uri }} style={s.thumbImg} />}
                <TouchableOpacity onPress={() => removeMedia(i)} style={s.removeImg}>
                  <Text style={{ color: Colors.white, fontSize: 12, fontWeight: '800' }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {mediaItems.length < 5 && (
              <TouchableOpacity onPress={pickMedia} style={s.addImgBtn}>
                <Text style={{ fontSize: 32 }}>📷</Text>
                <Text style={s.addImgText}>Add Media</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        <Text style={s.label}>CATEGORY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
            {SHOP_CATEGORIES.map(c => (
              <TouchableOpacity key={c.id} onPress={() => setCategory(c.id)} style={[s.catChip, category === c.id && s.catChipActive]}>
                <Text style={s.catChipText}>{c.emoji} {c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text style={s.label}>PRODUCT NAME *</Text>
        <View style={s.inputWrap}>
          <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="e.g. Fresh Organic Tomatoes" placeholderTextColor={Colors.dim} />
        </View>

        <Text style={s.label}>DESCRIPTION</Text>
        <View style={[s.inputWrap, { height: 90 }]}> 
          <TextInput style={[s.input, { paddingTop: 12, textAlignVertical: 'top' }]}
            value={desc} onChangeText={setDesc} placeholder="Describe your product…" placeholderTextColor={Colors.dim} multiline />
        </View>

        <Text style={s.label}>TAGS</Text>
        <View style={s.inputWrap}>
          <TextInput
            style={s.input}
            value={tags}
            onChangeText={setTagsWithAutoCategory}
            placeholder="fresh organic deals (try: #electronics)"
            placeholderTextColor={Colors.dim}
          />
        </View>

        {tagSuggestions.length > 0 && (
          <View style={{ marginTop: -10, marginBottom: 14 }}>
            <Text style={{ color: Colors.sub, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
              Tag suggestions
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {tagSuggestions.slice(0, 6).map(c => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => applyHashtagSuggestion(c.id)}
                  style={[s.tagChip, { backgroundColor: category === c.id ? Colors.orange + '22' : Colors.card }]}
                >
                  <Text style={[s.tagChipText, category === c.id ? { color: Colors.orange } : null]}>
                    #{c.id}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>PRICE (₹) *</Text>
            <View style={s.inputWrap}>
              <TextInput style={s.input} value={price} onChangeText={setPrice} placeholder="299" placeholderTextColor={Colors.dim} keyboardType="numeric" />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>DISCOUNT %</Text>
            <View style={s.inputWrap}>
              <TextInput style={s.input} value={discount} onChangeText={setDiscount} placeholder="0" placeholderTextColor={Colors.dim} keyboardType="numeric" />
            </View>
          </View>
        </View>

        {(title || price) ? (
          <View style={s.preview}>
            <Text style={s.previewTitle}>Live Preview</Text>
            <View style={s.previewCard}>
              <View style={s.previewMedia}>
                {mediaItems[0]?.type === 'video'
                  ? <Text style={{ fontSize: 48 }}>🎬</Text>
                  : mediaItems[0]?.uri
                    ? <Image source={{ uri: mediaItems[0].uri }} style={s.previewImg} />
                    : <Text style={{ fontSize: 48 }}>📦</Text>
                }
                {price && (
                  <View style={s.previewPrice}>
                    <Text style={s.previewPriceText}>
                      {discount && parseInt(discount) > 0 ? `₹${(parseFloat(price) * (1 - parseInt(discount)/100)).toFixed(0)}` : `₹${price}`}
                    </Text>
                  </View>
                )}
              </View>
              <View style={s.previewInfo}>
                <Text style={s.previewName}>{title || 'Product name'}</Text>
                <Text style={s.previewDesc} numberOfLines={2}>{desc || 'Product description'}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 52, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  backText: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  postBtn: { backgroundColor: Colors.orange, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8, minWidth: 64, alignItems: 'center' },
  postBtnText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
  scroll: { flex: 1 },
  content: { padding: 20 },
  label: { fontSize: 11, fontWeight: '700', color: Colors.sub, letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' },
  imgThumb: { width: 100, height: 100, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  thumbImg: { width: 100, height: 100 },
  thumbVideo: { width: 100, height: 100, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  removeImg: { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: '#000A', alignItems: 'center', justifyContent: 'center' },
  addImgBtn: { width: 100, height: 100, borderRadius: 12, borderWidth: 2, borderColor: Colors.border2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addImgText: { fontSize: 10, color: Colors.sub },
  catChip: { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  catChipActive: { backgroundColor: Colors.orange, borderColor: Colors.orange },
  catChipText: { fontSize: 13, color: Colors.text, fontWeight: '600' },
  inputWrap: { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border2, borderRadius: 12, paddingHorizontal: 14, marginBottom: 20 },
  input: { color: Colors.text, fontSize: 15, paddingVertical: 12 },
  preview: { marginTop: 4 },
  previewTitle: { fontSize: 12, fontWeight: '700', color: Colors.sub, letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },
  previewCard: { backgroundColor: Colors.card, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border2 },
  previewMedia: { height: 180, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  previewImg: { width: '100%', height: 180, resizeMode: 'cover' },
  previewPrice: { position: 'absolute', bottom: 10, right: 10, backgroundColor: '#000C', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  previewPriceText: { color: Colors.amber, fontWeight: '700', fontSize: 14 },
  previewInfo: { padding: 14 },
  previewName: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  previewDesc: { fontSize: 13, color: Colors.sub },
  tagChip: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border2, alignItems: 'center' },
  tagChipText: { color: Colors.text, fontWeight: '700', fontSize: 12 },
});
