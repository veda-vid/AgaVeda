// app/(tabs)/profile.tsx — Adaptive location-aware profile dashboard

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Alert, Platform, Share, Modal, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { useDailyBoardsStore } from '../../stores/dailyBoardsStore';
import { useProfileMediaStore } from '../../stores/profileMediaStore';
import { useScreenRefresh } from '../../hooks/useScreenRefresh';
import {
  updateProfile, uploadImage, getShopByOwner, getPostsByShop, getPostsByAuthor,
  updateShop, getSavedPosts, getUserReposts, getUserSparks,
  getMySellerCompetitiveProfile, getMySellerEnquiryStats, getBuyerOrders,
  ensureServiceProviderRecord, getServiceProProfileStats, setServiceProviderAvailability,
  getServiceProDashboardStats, type ServiceProProfileStats,
} from '../../lib/api';
import {
  Colors, THEME_OPTIONS, type AppThemeId, createDynamicStyles,
} from '../../constants/theme';
import { hapticLight, hapticSuccess } from '../../lib/haptics';
import {
  countDailyBoardPins, hasCaptionTags, type ProfilePostItem,
} from '../../lib/profileUtils';
import {
  getDefaultProfileTab,
  isLocationLocked,
  isMerchantSeller as checkMerchantSeller,
  isServiceProvider as checkServiceProvider,
  isSellerLike,
  type ProfileTabId,
} from '../../stores/roleUtils';
import { ProfileHeader } from '../../components/profile/ProfileHeader';
import { ProfileTabs } from '../../components/profile/ProfileTabs';
import { PostViewerModal } from '../../components/profile/PostViewerModal';
import {
  SettingsDrawer, EditProfileSheet, ThemePickerSheet, PlansPickerSheet,
} from '../../components/profile/SettingsDrawer';
import { RadiusSelectorSheet } from '../../components/profile/RadiusSelectorSheet';
import { LegalWebModal, type LegalDocId } from '../../components/profile/LegalWebModal';
import { PinterestArticleView } from '../../components/daily/PinterestArticleView';
import { AddServiceSkillModal } from '../../components/seller/AddServiceSkillModal';
import { ProLeadsDrawer } from '../../components/seller/ProLeadsDrawer';
import type {
  CityNews, Order, SellerCompetitiveProfile, SellerEnquiryStats, ServiceProvider, Shop,
} from '../../types';

export default function ProfileScreen() {
  const router = useRouter();
  const {
    profile, updateProfile: updateLocal, signOut, followedShopIds, setPushNotificationsEnabled,
  } = useAuthStore();
  const themeId = useThemeStore(s => s.themeId) || 'midnight';
  const setTheme = useThemeStore(s => s.setTheme);
  const dailyBoards = useDailyBoardsStore(s => s.boards);
  const dailyItems = useDailyBoardsStore(s => s.items);
  const repostsRevision = useProfileMediaStore(s => s.repostsRevision);
  const sparksRevision = useProfileMediaStore(s => s.sparksRevision);
  const refreshProfileFromServer = useAuthStore(s => s.refreshProfile);

  const [viewMode, setViewMode] = useState<'profile' | 'settings'>('profile');
  const [profileTab, setProfileTab] = useState<ProfileTabId>('saved');
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);

  const [editOpen, setEditOpen] = useState(false);
  const [radiusOpen, setRadiusOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [selectedShopPlan, setSelectedShopPlan] = useState<'free' | 'pro' | 'premium'>('free');
  const [settingsQuery, setSettingsQuery] = useState('');
  const [legalDoc, setLegalDoc] = useState<LegalDocId | null>(null);
  const [articleItem, setArticleItem] = useState<CityNews | null>(null);

  const [notifs, setNotifs] = useState(true);
  const [pushToggling, setPushToggling] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const [sellerShop, setSellerShop] = useState<Shop | null>(null);
  const [profilePosts, setProfilePosts] = useState<ProfilePostItem[]>([]);
  const [savedPosts, setSavedPosts] = useState<ProfilePostItem[]>([]);
  const [repostedPosts, setRepostedPosts] = useState<ProfilePostItem[]>([]);
  const [sparkVideos, setSparkVideos] = useState<ProfilePostItem[]>([]);
  const [buyerOrders, setBuyerOrders] = useState<Order[]>([]);
  const [competitiveProfile, setCompetitiveProfile] = useState<SellerCompetitiveProfile | null>(null);
  const [enquiryStats, setEnquiryStats] = useState<SellerEnquiryStats | null>(null);

  const [postsLoading, setPostsLoading] = useState(false);
  const [savedLoading, setSavedLoading] = useState(false);
  const [repostedLoading, setRepostedLoading] = useState(false);
  const [videosLoading, setVideosLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [competitiveLoading, setCompetitiveLoading] = useState(false);
  const [enquiryStatsLoading, setEnquiryStatsLoading] = useState(false);

  const [postOpen, setPostOpen] = useState(false);
  const [postViewerPosts, setPostViewerPosts] = useState<ProfilePostItem[]>([]);
  const [activePostIndex, setActivePostIndex] = useState(0);

  const [serviceProRecord, setServiceProRecord] = useState<ServiceProvider | null>(null);
  const [serviceProStats, setServiceProStats] = useState<ServiceProProfileStats | null>(null);
  const [serviceProStatsLoading, setServiceProStatsLoading] = useState(false);
  const [proAvailable, setProAvailable] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showProLeadsDrawer, setShowProLeadsDrawer] = useState(false);
  const [proLeadsFilter, setProLeadsFilter] = useState<'all' | 'quotes'>('all');
  const [proLeadCount, setProLeadCount] = useState(0);

  const isMerchantSeller = checkMerchantSeller(profile?.role);
  const isServiceProvider = checkServiceProvider(profile?.role);
  const isSeller = isSellerLike(profile?.role);
  const isBuyer = profile?.role === 'buyer';

  const refreshProfileScreen = useCallback(async () => {
    await refreshProfileFromServer();
    setProfileRefreshKey(k => k + 1);
  }, [refreshProfileFromServer]);

  const { refreshing, onRefresh } = useScreenRefresh(refreshProfileScreen);

  useEffect(() => {
    setProfileTab(getDefaultProfileTab(profile?.role));
    setViewMode('profile');
  }, [profile?.role, profile?.id]);

  useEffect(() => {
    if (profile?.push_enabled != null) setNotifs(!!profile.push_enabled);
  }, [profile?.push_enabled]);

  useEffect(() => {
    if (!profile?.id) return;
    useDailyBoardsStore.getState().hydrate(profile.id).catch(() => {});
  }, [profile?.id, profileRefreshKey]);

  useEffect(() => {
    if (!profile || !isServiceProvider) return;
    let cancelled = false;
    (async () => {
      try {
        const record = await ensureServiceProviderRecord(profile.id, {
          name: profile.name,
          city: profile.city,
          lat: profile.lat,
          lng: profile.lng,
          phone: profile.phone,
        });
        if (!cancelled) {
          setServiceProRecord(record);
          setProAvailable(record.is_available);
        }
      } catch {
        if (!cancelled) setServiceProRecord(null);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, isServiceProvider, profileRefreshKey]);

  useEffect(() => {
    if (!profile || !isServiceProvider) return;
    let cancelled = false;
    (async () => {
      setServiceProStatsLoading(true);
      try {
        const [stats, dash] = await Promise.all([
          getServiceProProfileStats(profile.id),
          getServiceProDashboardStats(profile.id),
        ]);
        if (!cancelled) {
          setServiceProStats(stats);
          setProLeadCount(dash.active_requests);
          setProAvailable(dash.is_available);
        }
      } catch {
        if (!cancelled) setServiceProStats(null);
      } finally {
        if (!cancelled) setServiceProStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, isServiceProvider, profileRefreshKey]);

  useEffect(() => {
    if (!profile || !isSeller) return;
    let cancelled = false;
    (async () => {
      try {
        const shop = await getShopByOwner(profile.id);
        if (!cancelled) setSellerShop(shop);
      } catch {
        if (!cancelled) setSellerShop(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isSeller, profile?.id, profileRefreshKey]);

  useEffect(() => {
    if (!profile || !isBuyer) return;
    let cancelled = false;
    getSavedPosts(profile.id)
      .then(posts => { if (!cancelled) setSavedPosts(Array.isArray(posts) ? posts : []); })
      .catch(() => { if (!cancelled) setSavedPosts([]); });
    return () => { cancelled = true; };
  }, [profile?.id, isBuyer, profileRefreshKey]);

  useEffect(() => {
    if (viewMode !== 'profile' || !profile || !isBuyer || profileTab !== 'orders') return;
    let cancelled = false;
    (async () => {
      setOrdersLoading(true);
      try {
        const orders = await getBuyerOrders(profile.id);
        if (!cancelled) setBuyerOrders(orders);
      } catch {
        if (!cancelled) setBuyerOrders([]);
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, isBuyer, profileTab, viewMode, profileRefreshKey]);

  useEffect(() => {
    if (viewMode !== 'profile' || !profile || !isSeller) return;
    if (profileTab !== 'posts' && profileTab !== 'tagged') return;
    let cancelled = false;
    (async () => {
      setPostsLoading(true);
      try {
        const shop = isMerchantSeller ? await getShopByOwner(profile.id) : sellerShop;
        let posts: ProfilePostItem[] = [];
        if (isServiceProvider && !shop) {
          posts = await getPostsByAuthor(profile.id, profile.id);
        } else if (shop) {
          posts = await getPostsByShop(shop.id, profile.id);
        }
        const ordered = Array.isArray(posts)
          ? [...posts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          : [];
        if (!cancelled) setProfilePosts(ordered);
      } catch {
        if (!cancelled) setProfilePosts([]);
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, isSeller, isServiceProvider, isMerchantSeller, sellerShop?.id, profileTab, viewMode, profileRefreshKey]);

  useEffect(() => {
    if (viewMode !== 'profile' || !profile || profileTab !== 'saved' || isBuyer) return;
    let cancelled = false;
    (async () => {
      setSavedLoading(true);
      try {
        const posts = await getSavedPosts(profile.id);
        if (!cancelled) setSavedPosts(Array.isArray(posts) ? posts : []);
      } catch {
        if (!cancelled) setSavedPosts([]);
      } finally {
        if (!cancelled) setSavedLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profileTab, viewMode, profileRefreshKey, isBuyer]);

  useEffect(() => {
    if (viewMode !== 'profile' || !profile || profileTab !== 'reposts') return;
    let cancelled = false;
    (async () => {
      setRepostedLoading(true);
      try {
        const posts = await getUserReposts(profile.id);
        if (!cancelled) setRepostedPosts(Array.isArray(posts) ? posts : []);
      } catch {
        if (!cancelled) setRepostedPosts([]);
      } finally {
        if (!cancelled) setRepostedLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, profileTab, viewMode, profileRefreshKey, repostsRevision]);

  useEffect(() => {
    if (viewMode !== 'profile' || !profile || !isSeller) return;
    let cancelled = false;
    (async () => {
      setVideosLoading(true);
      try {
        const videos = await getUserSparks(profile.id);
        if (!cancelled) setSparkVideos(Array.isArray(videos) ? videos : []);
      } catch {
        if (!cancelled) setSparkVideos([]);
      } finally {
        if (!cancelled) setVideosLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, isSeller, viewMode, profileRefreshKey, sparksRevision]);

  useEffect(() => {
    if (viewMode !== 'profile' || !profile || !isMerchantSeller) {
      setCompetitiveProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setCompetitiveLoading(true);
      try {
        const next = await getMySellerCompetitiveProfile();
        if (!cancelled) setCompetitiveProfile(next);
      } catch {
        if (!cancelled) setCompetitiveProfile(null);
      } finally {
        if (!cancelled) setCompetitiveLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, isMerchantSeller, viewMode, profileRefreshKey]);

  useEffect(() => {
    if (viewMode !== 'profile' || !profile || !isMerchantSeller) {
      setEnquiryStats(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setEnquiryStatsLoading(true);
      try {
        const next = await getMySellerEnquiryStats();
        if (!cancelled) setEnquiryStats(next);
      } catch {
        if (!cancelled) setEnquiryStats(null);
      } finally {
        if (!cancelled) setEnquiryStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, isMerchantSeller, viewMode, profileRefreshKey]);

  const taggedPosts = useMemo(
    () => profilePosts.filter(post => hasCaptionTags(post.caption)),
    [profilePosts],
  );

  const activeGridPosts = useMemo(() => {
    if (profileTab === 'videos') return sparkVideos;
    if (profileTab === 'reposts') return repostedPosts;
    if (profileTab === 'tagged') return taggedPosts;
    if (profileTab === 'saved') return isBuyer ? [] : savedPosts;
    return profilePosts;
  }, [profileTab, sparkVideos, repostedPosts, taggedPosts, isBuyer, savedPosts, profilePosts]);

  const isGridLoading = profileTab === 'saved' && !isBuyer
    ? savedLoading
    : profileTab === 'reposts'
      ? repostedLoading
      : profileTab === 'videos'
        ? videosLoading
        : profileTab === 'orders'
          ? ordersLoading
          : postsLoading;

  const savedItemsCount = savedPosts.length + countDailyBoardPins(dailyItems, dailyBoards);
  const activeOrdersCount = useMemo(() => {
    const active = buyerOrders.filter(o => !['cancelled', 'delivered', 'completed'].includes(String(o.status)));
    return active.length || buyerOrders.length;
  }, [buyerOrders]);

  if (!profile) return null;

  const newEnquiryCount = enquiryStats?.new_leads ?? 0;
  const showShopManagement = isMerchantSeller || (isServiceProvider && !!sellerShop);
  const activeTheme = THEME_OPTIONS.find(o => o.id === themeId) ?? THEME_OPTIONS[0];

  const handleSaveProfile = async (updates: Partial<typeof profile>) => {
    await updateProfile(profile.id, updates);
    if (isMerchantSeller && typeof updates.bio === 'string') {
      const shop = await getShopByOwner(profile.id);
      if (shop) await updateShop(shop.id, { description: updates.bio });
    }
    updateLocal(updates);
    void hapticSuccess();
  };

  const handleSaveRadius = async (radius_km: number) => {
    if (isLocationLocked(profile.role)) return;
    await updateProfile(profile.id, { radius_km });
    updateLocal({ radius_km });
    setProfileRefreshKey(k => k + 1);
    void hapticSuccess();
    Toast.show({
      type: 'success',
      text1: 'Coverage updated',
      text2: `Discovering within ${radius_km} km of ${profile.city}.`,
      visibilityTime: 1600,
    });
  };

  const handlePushToggle = async (enabled: boolean) => {
    setNotifs(enabled);
    setPushToggling(true);
    try {
      await setPushNotificationsEnabled(enabled);
      void hapticLight();
    } catch (e: any) {
      setNotifs(!enabled);
      Alert.alert('Notifications', e?.message || 'Could not update push preference.');
    } finally {
      setPushToggling(false);
    }
  };

  const handleToggleProAvailability = async (next: boolean) => {
    setProAvailable(next);
    try {
      await setServiceProviderAvailability(profile.id, next);
      if (serviceProRecord) setServiceProRecord({ ...serviceProRecord, is_available: next });
    } catch {
      setProAvailable(!next);
      Alert.alert('Availability', 'Could not update your status. Please try again.');
    }
  };

  const openProLeads = (filter: 'all' | 'quotes' = 'all') => {
    void hapticLight();
    setProLeadsFilter(filter);
    setShowProLeadsDrawer(true);
  };

  const changeAvatar = async () => {
    if (avatarUploading) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled || !result.assets[0]) return;
      setAvatarUploading(true);
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const url = await uploadImage('cityconnect', `avatars/${profile.id}/${Date.now()}.jpg`, blob, 'image/jpeg');
      await handleSaveProfile({ avatar_url: url });
    } catch (e: any) {
      Alert.alert('Photo upload failed', e?.message || 'Try again with a different photo.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const changeCover = async () => {
    if (!isMerchantSeller || coverUploading) return;
    try {
      const shop = await getShopByOwner(profile.id);
      if (!shop) {
        Alert.alert('Create shop first', 'Set up your shop before changing the cover.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 1],
      });
      if (result.canceled || !result.assets[0]) return;
      setCoverUploading(true);
      const response = await fetch(result.assets[0].uri);
      const blob = await response.blob();
      const url = await uploadImage('cityconnect', `covers/${profile.id}/${Date.now()}.jpg`, blob, 'image/jpeg');
      await updateShop(shop.id, { cover_url: url } as any);
      setSellerShop(prev => (prev ? { ...prev, cover_url: url } : prev));
    } catch (e: any) {
      Alert.alert('Cover upload failed', e?.message || 'Try again with a different image.');
    } finally {
      setCoverUploading(false);
    }
  };

  const shareProfile = async () => {
    const name = isServiceProvider
      ? (serviceProRecord?.business_name || profile.name)
      : (sellerShop?.name || profile.name);
    const message = [name, profile.city].filter(Boolean).join('\n');
    try {
      await Share.share({ message, title: name });
    } catch {
      Alert.alert(name, profile.city);
    }
  };

  const handleRoleSwitch = () => {
    const newRole = profile.role === 'buyer' ? 'seller' : 'buyer';
    Alert.alert(
      'Switch Role',
      `Switch to ${newRole === 'seller' ? 'Seller' : 'Buyer'} mode?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            await updateProfile(profile.id, { role: newRole });
            updateLocal({ role: newRole });
            void hapticSuccess();
          },
        },
      ],
    );
  };

  const handleSignOut = () => {
    const doLogout = async () => {
      setSigningOut(true);
      try {
        await signOut();
        router.replace('/(auth)/role' as any);
      } finally {
        setSigningOut(false);
      }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (!window.confirm('Are you sure you want to log out?')) return;
      void doLogout();
      return;
    }
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => void doLogout() },
    ]);
  };

  const handleThemeSelect = (nextThemeId: AppThemeId) => {
    void (async () => {
      try {
        await setTheme?.(nextThemeId);
        setThemeOpen(false);
        Toast.show({
          type: 'success',
          text1: 'Theme updated',
          text2: `${THEME_OPTIONS.find(o => o.id === nextThemeId)?.label ?? 'Theme'} is now active.`,
          visibilityTime: 1600,
        });
      } catch {
        setThemeOpen(false);
        Alert.alert('Theme', 'Could not apply theme. Please try again.');
      }
    })();
  };

  return (
    <View style={s.root}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.bg }} />

      {viewMode === 'settings' ? (
        <SettingsDrawer
          profile={profile}
          themeId={themeId}
          themeLabel={activeTheme.label}
          notifs={notifs}
          pushToggling={pushToggling}
          signingOut={signingOut}
          shopPlan={selectedShopPlan}
          showShopManagement={showShopManagement}
          newEnquiryCount={newEnquiryCount}
          proLeadCount={proLeadCount}
          searchQuery={settingsQuery}
          onChangeSearch={setSettingsQuery}
          onBack={() => setViewMode('profile')}
          onOpenRadius={() => setRadiusOpen(true)}
          onOpenTheme={() => setThemeOpen(true)}
          onOpenPlans={() => setPlansOpen(true)}
          onOpenEnquiries={() => router.push('/seller/enquiries' as any)}
          onOpenProLeads={() => openProLeads('all')}
          onOpenShop={() => router.push('/seller/shop' as any)}
          onChangeCover={() => { void changeCover(); }}
          onOpenCart={() => router.push('/(tabs)/cart' as any)}
          onSwitchRole={handleRoleSwitch}
          onTogglePush={v => { void handlePushToggle(v); }}
          onOpenLegal={setLegalDoc}
          onSignOut={handleSignOut}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.orange} />
          }
        >
          <ProfileHeader
            profile={profile}
            sellerShop={sellerShop}
            serviceProRecord={serviceProRecord}
            serviceProStats={serviceProStats}
            serviceProStatsLoading={serviceProStatsLoading}
            competitiveProfile={competitiveProfile}
            competitiveLoading={competitiveLoading}
            enquiryStats={enquiryStats}
            enquiryStatsLoading={enquiryStatsLoading}
            postsCount={profilePosts.length}
            followingCount={followedShopIds.length}
            savedItemsCount={savedItemsCount}
            activeOrdersCount={activeOrdersCount}
            proLeadCount={proLeadCount}
            newEnquiryCount={newEnquiryCount}
            proAvailable={proAvailable}
            onOpenRadius={() => setRadiusOpen(true)}
            onOpenSettings={() => setViewMode('settings')}
            onChangeAvatar={() => { void changeAvatar(); }}
            onEditProfile={() => setEditOpen(true)}
            onShareProfile={() => { void shareProfile(); }}
            onUpload={() => {
              if (isServiceProvider) router.push('/(tabs)/?create_menu=1' as any);
              else router.push('/seller/upload' as any);
            }}
            onOpenEnquiries={() => router.push('/seller/enquiries' as any)}
            onOpenProLeads={() => openProLeads('all')}
            onOpenOrders={() => setProfileTab('orders')}
            onOpenSaved={() => setProfileTab('saved')}
            onSwitchToSeller={handleRoleSwitch}
            onManageShop={() => router.push('/seller/shop' as any)}
            onEditSkills={() => setShowAddServiceModal(true)}
            onToggleAvailability={v => { void handleToggleProAvailability(v); }}
          />

          <ProfileTabs
            role={profile.role}
            activeTab={profileTab}
            onChangeTab={setProfileTab}
            posts={activeGridPosts}
            loading={isGridLoading}
            userId={profile.id}
            orders={buyerOrders}
            ordersLoading={ordersLoading}
            leadCount={proLeadCount}
            dense={isSeller}
            onOpenPost={(posts, index) => {
              setPostViewerPosts(posts);
              setActivePostIndex(index);
              setPostOpen(true);
            }}
            onOpenDailyPin={item => {
              void hapticLight();
              setArticleItem(item);
            }}
            onOpenOrder={order => {
              if (order.shop_id) {
                router.push({ pathname: '/chat/[shopId]', params: { shopId: order.shop_id } } as never);
              }
            }}
            onOpenLeads={() => openProLeads('all')}
          />

          <Text style={s.version}>Vedastya v1.0.0</Text>
        </ScrollView>
      )}

      <RadiusSelectorSheet
        visible={radiusOpen}
        current={profile.radius_km}
        locked={isLocationLocked(profile.role)}
        onSave={km => { void handleSaveRadius(km); }}
        onClose={() => setRadiusOpen(false)}
      />

      <EditProfileSheet
        visible={editOpen}
        profile={profile}
        canEditCity={!isLocationLocked(profile.role)}
        onSave={handleSaveProfile}
        onClose={() => setEditOpen(false)}
      />

      <ThemePickerSheet
        visible={themeOpen}
        current={themeId}
        onSelect={handleThemeSelect}
        onClose={() => setThemeOpen(false)}
      />

      <PlansPickerSheet
        visible={plansOpen}
        selected={selectedShopPlan}
        onSelect={p => { setSelectedShopPlan(p); setPlansOpen(false); }}
        onClose={() => setPlansOpen(false)}
      />

      <PostViewerModal
        visible={postOpen}
        posts={postViewerPosts}
        startIndex={activePostIndex}
        profileName={profile.name}
        avatarUrl={profile.avatar_url}
        role={profile.role}
        showRepostContext={profileTab === 'reposts'}
        onClose={() => setPostOpen(false)}
      />

      <Modal visible={!!articleItem} animationType="fade" transparent onRequestClose={() => setArticleItem(null)}>
        {articleItem ? (
          <PinterestArticleView
            item={articleItem}
            saved
            onLikeToggle={() => {}}
            onShare={() => {}}
            onRepost={() => {}}
            onComment={() => router.push('/(tabs)/daily' as never)}
            onSave={() => {}}
            onTogglePin={() => {}}
            onClose={() => setArticleItem(null)}
          />
        ) : null}
      </Modal>

      <LegalWebModal visible={!!legalDoc} docId={legalDoc} onClose={() => setLegalDoc(null)} />

      <AddServiceSkillModal
        visible={showAddServiceModal}
        provider={serviceProRecord}
        onClose={() => setShowAddServiceModal(false)}
        onSaved={provider => {
          setServiceProRecord(provider);
          setProAvailable(provider.is_available);
          void getServiceProProfileStats(profile.id).then(setServiceProStats).catch(() => {});
        }}
      />

      {isServiceProvider && profile.id ? (
        <ProLeadsDrawer
          visible={showProLeadsDrawer}
          providerProfileId={profile.id}
          filter={proLeadsFilter}
          onClose={() => setShowProLeadsDrawer(false)}
        />
      ) : null}
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { paddingBottom: 100 },
  version: {
    textAlign: 'center',
    color: Colors.dim,
    fontSize: 12,
    marginTop: 8,
    marginBottom: 24,
  },
}));
