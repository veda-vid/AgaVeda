import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import { getProCategoryLabel, unicodeProsStyle } from '../../lib/prosUtils';
import { hapticLight, hapticSuccess } from '../../lib/haptics';
import type { ServiceProvider } from '../../types';

type ServiceProSkillCardProps = {
  provider: ServiceProvider | null;
  loading?: boolean;
  isAvailable: boolean;
  onEditProfile: () => void;
  onToggleAvailability: (next: boolean) => void;
};

export function ServiceProSkillCard({
  provider,
  loading,
  isAvailable,
  onEditProfile,
  onToggleAvailability,
}: ServiceProSkillCardProps) {
  const categoryLabel = provider ? getProCategoryLabel(provider) : 'Not set';
  const experience = provider?.experience_years ?? 0;
  const rateLabel = provider?.base_rate_label?.trim() || 'Rate not set';
  const portfolioCount = provider?.portfolio_photos?.length ?? 0;

  const handleToggle = (next: boolean) => {
    void (next ? hapticSuccess() : hapticLight());
    onToggleAvailability(next);
  };

  return (
    <View style={s.card}>
      <Text style={s.title}>Service & Skill Profile</Text>
      <Text style={s.subtitle}>Your primary listing shown to nearby buyers</Text>

      <View style={s.detailRow}>
        <Text style={s.detailLabel}>Primary skill</Text>
        <Text style={[s.detailValue, unicodeProsStyle]}>{loading ? '…' : categoryLabel}</Text>
      </View>
      <View style={s.detailRow}>
        <Text style={s.detailLabel}>Experience</Text>
        <Text style={s.detailValue}>{loading ? '…' : `${experience} year${experience === 1 ? '' : 's'}`}</Text>
      </View>
      <View style={s.detailRow}>
        <Text style={s.detailLabel}>Base rate</Text>
        <Text style={[s.detailValue, unicodeProsStyle]}>{loading ? '…' : rateLabel}</Text>
      </View>
      <View style={s.detailRow}>
        <Text style={s.detailLabel}>Portfolio</Text>
        <Text style={s.detailValue}>{loading ? '…' : `${portfolioCount} photo${portfolioCount === 1 ? '' : 's'}`}</Text>
      </View>

      <TouchableOpacity style={s.ctaBtn} onPress={onEditProfile} activeOpacity={0.88}>
        <Text style={s.ctaBtnText}>✏️ Edit Service Profile, Rates & Portfolio</Text>
      </TouchableOpacity>

      <View style={s.availabilityRow}>
        <Text style={[s.availabilityLabel, isAvailable ? s.online : s.away]}>
          {isAvailable ? '🟢 Online' : '🟠 Away'}
        </Text>
        <Switch
          value={isAvailable}
          onValueChange={handleToggle}
          trackColor={{ false: '#334155', true: Colors.orange + '88' }}
          thumbColor={isAvailable ? Colors.orange : '#94A3B8'}
        />
      </View>
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    marginTop: 2,
    marginBottom: 12,
    fontSize: 12,
    color: Colors.sub,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.dim,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  ctaBtn: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: Radius.md,
    backgroundColor: Colors.orange,
    alignItems: 'center',
  },
  ctaBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  availabilityRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availabilityLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  online: { color: Colors.green },
  away: { color: Colors.amber },
}));
