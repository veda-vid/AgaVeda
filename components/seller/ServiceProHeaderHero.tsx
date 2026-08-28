import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { Colors, Fonts, Radius, Shadow } from '../../constants/theme';
import type { ServiceProDashboardStats } from '../../lib/api';

type ServiceProHeaderHeroProps = {
  stats: ServiceProDashboardStats | null;
  loading?: boolean;
  isAvailable: boolean;
  onToggleAvailability: (next: boolean) => void;
  onListService: () => void;
};

export function ServiceProHeaderHero({
  stats,
  loading,
  isAvailable,
  onToggleAvailability,
  onListService,
}: ServiceProHeaderHeroProps) {
  return (
    <View style={s.root}>
      <View style={s.titleRow}>
        <Text style={s.title}>Service Pro Operations</Text>
        <Text style={s.subtitle}>Manage requests, quotes, and availability</Text>
      </View>

      <View style={s.metricsBar}>
        <MetricTile label="Active Requests" value={loading ? '—' : String(stats?.active_requests ?? 0)} />
        <MetricTile label="Quote Inquiries" value={loading ? '—' : String(stats?.quote_inquiries ?? 0)} />
        <View style={s.availabilityTile}>
          <Text style={s.availabilityLabel}>⚡ Availability</Text>
          <View style={s.availabilityRow}>
            <Text style={[s.availabilityValue, isAvailable ? s.availableOn : s.availableOff]}>
              {isAvailable ? 'Available' : 'Away'}
            </Text>
            <Switch
              value={isAvailable}
              onValueChange={onToggleAvailability}
              trackColor={{ false: '#334155', true: Colors.orange + '88' }}
              thumbColor={isAvailable ? Colors.orange : '#94A3B8'}
            />
          </View>
        </View>
      </View>

      <TouchableOpacity style={s.actionBtn} onPress={onListService} activeOpacity={0.88}>
        <Text style={s.actionBtnText}>+ List New Service / Skill</Text>
        <Text style={s.actionBtnSub}>Showcase plumbing, electrical, cleaning, and more</Text>
      </TouchableOpacity>
    </View>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metricTile}>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    ...Shadow.md,
  },
  titleRow: { marginBottom: 12 },
  title: {
    fontSize: 17,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    color: Colors.sub,
  },
  metricsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metricTile: {
    flexGrow: 1,
    minWidth: 100,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: Radius.md,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricValue: {
    fontSize: 18,
    fontFamily: Fonts.displayXBold,
    fontWeight: '800',
    color: '#F1F5F9',
  },
  metricLabel: {
    marginTop: 2,
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '600',
    color: Colors.dim,
    textAlign: 'center',
  },
  availabilityTile: {
    flexGrow: 1,
    minWidth: 140,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  availabilityLabel: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '600',
    color: Colors.dim,
    marginBottom: 4,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  availabilityValue: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
  availableOn: { color: Colors.green },
  availableOff: { color: Colors.amber },
  actionBtn: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.orange,
    alignItems: 'center',
  },
  actionBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
  actionBtnSub: {
    marginTop: 4,
    color: Colors.white + 'CC',
    fontSize: 11,
    textAlign: 'center',
  },
});
