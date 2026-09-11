import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, Pressable, ScrollView, TextInput,
  Image, ActivityIndicator, Alert, StyleSheet, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Fonts, OTHER_SERVICE_SUBCATEGORIES, SERVICE_CATEGORIES, createDynamicStyles } from '../../constants/theme';
import { updateServiceProvider, uploadImage } from '../../lib/api';
import { compressPortfolioImage } from '../../lib/portfolioImage';
import { CAT_TINT, getProCategoryLabel, PRO_RADIUS_OPTIONS, unicodeProsStyle, type ProRadiusKm } from '../../lib/prosUtils';
import { hapticLight, hapticSuccess } from '../../lib/haptics';
import { GLASS, GlassSurface, SpringPressable } from '../ui/modernSurfaces';
import {
  CategoryIcon, IconBriefcase, IconClock, IconPin, IconStar, PresenceBadge, VerifiedMark,
} from '../services/ServiceIcons';
import type { ServiceCategory, ServiceProvider } from '../../types';

function isRemoteMediaUri(uri: string) {
  return /^https?:\/\//i.test(uri);
}

type PortfolioTile = {
  id: string;
  uri: string;
  uploading?: boolean;
};

type AddServiceSkillModalProps = {
  visible: boolean;
  provider: ServiceProvider | null;
  onClose: () => void;
  onSaved: (provider: ServiceProvider) => void;
};

function LivePreviewCard({
  provider,
  businessName,
  category,
  subcategory,
  baseRate,
  experienceYears,
  portfolio,
  coverageRadiusKm,
}: {
  provider: ServiceProvider;
  businessName: string;
  category: ServiceCategory;
  subcategory: string | null;
  baseRate: string;
  experienceYears: string;
  portfolio: string[];
  coverageRadiusKm: ProRadiusKm;
}) {
  const tint = CAT_TINT[category] ?? Colors.orange;
  const previewSvc = useMemo(() => ({
    ...provider,
    business_name: businessName.trim() || 'Your Business Name',
    category,
    subcategory,
    base_rate_label: baseRate.trim() || null,
    experience_years: Math.max(0, parseInt(experienceYears, 10) || 0),
    portfolio_photos: portfolio,
    coverage_radius_km: coverageRadiusKm,
    is_available: provider.is_available,
  }), [provider, businessName, category, subcategory, baseRate, experienceYears, portfolio, coverageRadiusKm]);

  const catLabel = getProCategoryLabel(previewSvc);

  return (
    <GlassSurface style={pv.card} radius={GLASS.cardRadius}>
      <Text style={pv.eyebrow}>Live Preview — Buyer View</Text>
      <View style={[pv.accent, { backgroundColor: tint }]} />
      <View style={pv.cardBody}>
        <View style={pv.headerRow}>
          <View style={[pv.avatar, { backgroundColor: tint + '22' }]}>
            <CategoryIcon id={category} size={28} color={tint} />
          </View>
          <View style={pv.meta}>
            <View style={pv.nameRow}>
              <View style={pv.nameCluster}>
                <Text style={[pv.name, unicodeProsStyle]} numberOfLines={1}>
                  {previewSvc.business_name}
                </Text>
                {previewSvc.is_verified ? <VerifiedMark /> : null}
              </View>
              <PresenceBadge svc={previewSvc} />
            </View>
            <Text style={[pv.cat, { color: tint }, unicodeProsStyle]}>{catLabel}</Text>
            {baseRate.trim() ? (
              <View style={pv.rateBadge}>
                <Text style={[pv.rateText, unicodeProsStyle]} numberOfLines={1}>
                  🏷️ {baseRate.trim()}
                </Text>
              </View>
            ) : (
              <Text style={pv.rateHint}>Add a base rate to show your price tag</Text>
            )}
          </View>
        </View>

        <GlassSurface style={pv.statsRow} radius={GLASS.cardRadius} intensity={16}>
          <View style={pv.statCell}>
            <IconClock color={Colors.sub} />
            <Text style={pv.statValue}>{previewSvc.experience_years} yrs</Text>
            <Text style={pv.statLabel}>Experience</Text>
          </View>
          <View style={pv.statDivider} />
          <View style={pv.statCell}>
            <IconBriefcase color={Colors.sub} />
            <Text style={pv.statValue}>{previewSvc.total_jobs}</Text>
            <Text style={pv.statLabel}>Jobs</Text>
          </View>
          <View style={pv.statDivider} />
          <View style={pv.statCell}>
            <IconStar size={14} color={Colors.amber} />
            <Text style={pv.statValue}>{Number(previewSvc.avg_rating).toFixed(1)}</Text>
            <Text style={pv.statLabel}>{previewSvc.total_reviews} reviews</Text>
          </View>
        </GlassSurface>

        <View style={pv.areaRow}>
          <IconPin color={Colors.sub} />
          <Text style={[pv.area, unicodeProsStyle]} numberOfLines={1}>
            {previewSvc.area_served || provider.city || 'Your service area'}
            {'  ·  '}{coverageRadiusKm} km coverage
          </Text>
        </View>

        {portfolio.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={pv.gallery}>
            {portfolio.map(uri => (
              <Image key={uri} source={{ uri }} style={pv.thumb} />
            ))}
          </ScrollView>
        ) : (
          <Text style={pv.galleryEmpty}>Portfolio photos will appear here for nearby buyers.</Text>
        )}
      </View>
    </GlassSurface>
  );
}

function CategoryChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <SpringPressable
      onPress={onPress}
      haptic
      style={[
        chipS.chip,
        active && chipS.chipActive,
        active && Platform.select({
          web: { boxShadow: `0 0 14px ${Colors.orange}55` } as object,
          default: {
            shadowColor: Colors.orange,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.45,
            shadowRadius: 8,
            elevation: 4,
          },
        }),
      ]}
    >
      <Text style={[chipS.chipText, active && chipS.chipTextActive, unicodeProsStyle]}>{label}</Text>
    </SpringPressable>
  );
}

export function AddServiceSkillModal({
  visible, provider, onClose, onSaved,
}: AddServiceSkillModalProps) {
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('other');
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [baseRate, setBaseRate] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [coverageRadiusKm, setCoverageRadiusKm] = useState<ProRadiusKm>(5);
  const [experienceYears, setExperienceYears] = useState('0');
  const [portfolio, setPortfolio] = useState<string[]>([]);
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !provider) return;
    setBusinessName(provider.business_name);
    setCategory(provider.category);
    setSubcategory(provider.subcategory ?? null);
    setDescription(provider.description);
    setBaseRate(provider.base_rate_label ?? '');
    setWhatsapp(provider.whatsapp ?? provider.phone ?? '');
    setCoverageRadiusKm((provider.coverage_radius_km ?? 5) as ProRadiusKm);
    setExperienceYears(String(provider.experience_years ?? 0));
    setPortfolio(provider.portfolio_photos ?? []);
    setUploadingIds(new Set());
  }, [visible, provider?.id]);

  const removePortfolioPhoto = (uri: string) => {
    void hapticLight();
    setPortfolio(prev => prev.filter(item => item !== uri));
  };

  const pickPortfolioPhoto = async () => {
    if (!provider || portfolio.length + uploadingIds.size >= 8) {
      Alert.alert('Portfolio limit', 'You can add up to 8 portfolio photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;

    const tileId = `upload-${Date.now()}`;
    const localUri = result.assets[0].uri;
    setUploadingIds(prev => new Set(prev).add(tileId));
    setPortfolio(prev => [...prev, localUri]);

    try {
      const compressed = await compressPortfolioImage(localUri);
      const response = await fetch(compressed.uri);
      const blob = await response.blob();
      const path = `portfolio/${provider.profile_id}/${Date.now()}.jpg`;
      const url = await uploadImage('cityconnect', path, blob, compressed.mime);
      setPortfolio(prev => prev.map(item => (item === localUri ? url : item)));
    } catch (e: any) {
      setPortfolio(prev => prev.filter(item => item !== localUri));
      Alert.alert('Upload failed', e.message || 'Could not upload photo.');
    } finally {
      setUploadingIds(prev => {
        const next = new Set(prev);
        next.delete(tileId);
        return next;
      });
    }
  };

  const portfolioTiles: PortfolioTile[] = portfolio.map((uri, index) => ({
    id: `${uri}-${index}`,
    uri,
    uploading: !isRemoteMediaUri(uri),
  }));

  const handleClose = () => {
    void hapticLight();
    onClose();
  };

  const handleSave = async () => {
    if (!provider) return;
    if (!businessName.trim()) {
      Alert.alert('Required', 'Please enter your business or skill name.');
      return;
    }
    if (uploadingIds.size > 0 || portfolioTiles.some(t => t.uploading)) {
      Alert.alert('Upload in progress', 'Please wait for portfolio photos to finish uploading.');
      return;
    }
    setSaving(true);
    try {
      const years = Math.max(0, parseInt(experienceYears, 10) || 0);
      const remotePortfolio = portfolio.filter(isRemoteMediaUri);
      const updated = await updateServiceProvider(provider.id, {
        business_name: businessName.trim(),
        category,
        subcategory: category === 'other' ? subcategory : null,
        description: description.trim(),
        base_rate_label: baseRate.trim() || null,
        experience_years: years,
        portfolio_photos: remotePortfolio,
        whatsapp: whatsapp.trim() || null,
        coverage_radius_km: coverageRadiusKm,
      });
      void hapticSuccess();
      onSaved(updated);
      onClose();
    } catch (e: any) {
      Alert.alert('Could not save', e.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  if (!provider) {
    return (
      <Modal visible animationType="slide" transparent onRequestClose={handleClose}>
        <View style={s.overlay}>
          <Pressable style={s.backdrop} onPress={handleClose} />
          <GlassSurface style={[s.sheet, s.loadingSheet]} radius={24}>
            <View style={s.handle} />
            <ActivityIndicator color={Colors.orange} size="large" />
            <Text style={s.loadingText}>Loading your service profile…</Text>
          </GlassSurface>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={s.overlay}>
        <Pressable
          style={s.backdrop}
          onPress={handleClose}
          onPressIn={() => { void hapticLight(); }}
        />
        <GlassSurface style={s.sheet} radius={24} overflow="visible">
          <View style={s.handle} />
          <Text style={s.title}>List New Service / Skill</Text>
          <Text style={s.subtitle}>
            Configure how buyers see your profile, rates, coverage, and portfolio.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <LivePreviewCard
              provider={provider}
              businessName={businessName}
              category={category}
              subcategory={subcategory}
              baseRate={baseRate}
              experienceYears={experienceYears}
              portfolio={portfolio}
              coverageRadiusKm={coverageRadiusKm}
            />

            <Text style={s.label}>Business / Skill Name</Text>
            <TextInput
              style={[s.input, unicodeProsStyle]}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="e.g. Raju Plumbing"
              placeholderTextColor={Colors.dim}
            />

            <Text style={s.label}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipScroll}
            >
              {SERVICE_CATEGORIES.map(cat => (
                <CategoryChip
                  key={cat.id}
                  active={category === cat.id}
                  label={`${cat.emoji} ${cat.label}`}
                  onPress={() => {
                    setCategory(cat.id as ServiceCategory);
                    if (cat.id !== 'other') setSubcategory(null);
                  }}
                />
              ))}
            </ScrollView>

            {category === 'other' && (
              <>
                <Text style={s.label}>Sub-skill</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.chipScroll}
                >
                  {OTHER_SERVICE_SUBCATEGORIES.map(sub => (
                    <CategoryChip
                      key={sub.id}
                      active={subcategory === sub.id}
                      label={sub.label}
                      onPress={() => setSubcategory(sub.id)}
                    />
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={s.label}>WhatsApp / Direct Contact Number</Text>
            <TextInput
              style={[s.input, unicodeProsStyle]}
              value={whatsapp}
              onChangeText={setWhatsapp}
              placeholder="e.g. +91 98765 43210"
              placeholderTextColor={Colors.dim}
              keyboardType="phone-pad"
            />

            <Text style={s.label}>Base Rate Label</Text>
            <TextInput
              style={[s.input, unicodeProsStyle]}
              value={baseRate}
              onChangeText={setBaseRate}
              placeholder="e.g. ₹300 / visit, ₹500 / hr"
              placeholderTextColor={Colors.dim}
            />

            <Text style={s.label}>Coverage Radius</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipScroll}
            >
              {PRO_RADIUS_OPTIONS.map(radius => (
                <CategoryChip
                  key={radius}
                  active={coverageRadiusKm === radius}
                  label={`${radius} km`}
                  onPress={() => setCoverageRadiusKm(radius)}
                />
              ))}
            </ScrollView>

            <Text style={s.label}>Experience (years)</Text>
            <TextInput
              style={s.input}
              value={experienceYears}
              onChangeText={setExperienceYears}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.dim}
            />

            <Text style={s.label}>Description</Text>
            <TextInput
              style={[s.input, s.textArea, unicodeProsStyle]}
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Describe your skills, service area, and specialties…"
              placeholderTextColor={Colors.dim}
            />

            <Text style={s.label}>Portfolio Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.portfolioRow}>
              {portfolioTiles.map(tile => (
                <View key={tile.id} style={s.thumbWrap}>
                  <Image source={{ uri: tile.uri }} style={s.portfolioThumb} />
                  {tile.uploading ? (
                    <View style={s.uploadOverlay}>
                      <ActivityIndicator color={Colors.white} />
                    </View>
                  ) : (
                    <SpringPressable
                      style={s.deleteBtn}
                      onPress={() => removePortfolioPhoto(tile.uri)}
                      haptic
                      pressedScale={0.9}
                    >
                      <Text style={s.deleteBtnText}>✕</Text>
                    </SpringPressable>
                  )}
                </View>
              ))}
              <SpringPressable
                style={s.addPhotoBtn}
                onPress={() => void pickPortfolioPhoto()}
                disabled={portfolio.length >= 8 || uploadingIds.size > 0}
                haptic
              >
                <Text style={s.addPhotoText}>+ Add</Text>
              </SpringPressable>
            </ScrollView>
          </ScrollView>

          <SpringPressable onPress={() => void handleSave()} disabled={saving} haptic style={s.saveWrap}>
            <LinearGradient
              colors={['#FF6B00', '#FF8800']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[s.saveBtn, saving && s.saveBtnDisabled]}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.saveBtnText}>Save Service Profile</Text>}
            </LinearGradient>
          </SpringPressable>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const chipS = createDynamicStyles((Colors) => ({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: GLASS.chipRadius,
    borderWidth: 1,
    borderColor: GLASS.border,
    backgroundColor: GLASS.bg,
    marginRight: 8,
  },
  chipActive: {
    borderColor: Colors.orange + 'AA',
    backgroundColor: Colors.orange + '22',
  },
  chipText: { fontSize: 13, color: Colors.sub, fontWeight: '600' },
  chipTextActive: { color: Colors.orange, fontWeight: '800' },
}));

const pv = createDynamicStyles((Colors) => ({
  card: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: Colors.orange,
    marginBottom: 10,
    marginHorizontal: 14,
    marginTop: 14,
    textTransform: 'uppercase',
  },
  accent: { height: 3, width: '100%' },
  cardBody: { padding: 14, gap: 12 },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, gap: 5, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nameCluster: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  name: { flexShrink: 1, fontSize: 16, fontWeight: '800', color: Colors.text },
  cat: { fontSize: 12, fontWeight: '600' },
  rateBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: GLASS.chipRadius,
    backgroundColor: Colors.orange + '18',
    borderWidth: 1,
    borderColor: Colors.orange + '44',
    maxWidth: '100%',
  },
  rateText: { fontSize: 12, fontWeight: '800', color: Colors.orange },
  rateHint: { marginTop: 4, fontSize: 11, color: Colors.dim },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: 1, height: 28, backgroundColor: GLASS.border },
  statValue: { fontSize: 13, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 10, color: Colors.dim },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  area: { flex: 1, fontSize: 12, color: Colors.sub },
  gallery: { marginTop: 2 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: GLASS.cardRadius,
    marginRight: 8,
    backgroundColor: GLASS.border,
  },
  galleryEmpty: { fontSize: 11, color: Colors.dim, fontStyle: 'italic' },
}));

const s = createDynamicStyles((Colors) => ({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.58)' },
  sheet: {
    maxHeight: '92%',
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    paddingTop: 10,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 14,
    opacity: 0.65,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 14,
    fontSize: 12,
    color: Colors.sub,
    lineHeight: 17,
  },
  label: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.sub,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1,
    borderColor: GLASS.border,
    borderRadius: GLASS.cardRadius,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: Colors.text,
    backgroundColor: GLASS.bg,
  },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  chipScroll: { paddingVertical: 2, paddingRight: 8 },
  portfolioRow: { marginBottom: 8 },
  thumbWrap: { position: 'relative', marginRight: 8 },
  portfolioThumb: {
    width: 72,
    height: 72,
    borderRadius: GLASS.cardRadius,
    backgroundColor: GLASS.border,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: GLASS.cardRadius,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: '#fff', fontSize: 12, fontWeight: '800', lineHeight: 14 },
  addPhotoBtn: {
    width: 72,
    height: 72,
    borderRadius: GLASS.cardRadius,
    borderWidth: 1,
    borderColor: GLASS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS.bg,
  },
  addPhotoText: { color: Colors.orange, fontWeight: '700' },
  saveWrap: {
    marginTop: 10,
    borderRadius: GLASS.cardRadius,
    overflow: 'hidden',
  },
  saveBtn: {
    borderRadius: GLASS.cardRadius,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.65 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  loadingSheet: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: Colors.sub, fontSize: 14, fontWeight: '600' },
}));
