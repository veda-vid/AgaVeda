// components/daily/MandiRatesWidget.tsx — Seasonal Sabji / Fruits / Anaaj (+ millets) board

import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import type { MandiBoard, MandiItem } from '../../services/dailyApi';

type MandiTab = 'sabji' | 'fruits' | 'anaaj';

type Props = {
  board: MandiBoard | null;
  loading?: boolean;
};

function RateRow({ item }: { item: MandiItem }) {
  const pct = item.changePct;
  const flat = pct == null || Math.abs(pct) < 0.05;
  const up = !flat && pct! > 0;
  const down = !flat && pct! < 0;
  return (
    <View style={s.row}>
      <Text style={s.name} numberOfLines={1}>{item.name}</Text>
      <View style={s.right}>
        <Text style={s.price}>{item.price}</Text>
        {!flat ? (
          <Text style={[s.chg, up ? s.chgUp : down ? s.chgDown : undefined]}>
            {up ? '▲' : '▼'} {Math.abs(pct!).toFixed(1)}%
          </Text>
        ) : (
          <Text style={s.unit}>{item.unit}</Text>
        )}
      </View>
    </View>
  );
}

export function MandiRatesWidget({ board, loading }: Props) {
  const [tab, setTab] = useState<MandiTab>('sabji');

  const tabs = useMemo(() => ([
    { id: 'sabji' as const, label: '🥦 Seasonal Sabji', count: board?.sabji?.length ?? 0 },
    { id: 'fruits' as const, label: '🥭 Seasonal Fruits', count: board?.fruits?.length ?? 0 },
    { id: 'anaaj' as const, label: '🌾 Anaaj + Millets', count: board?.anaaj?.length ?? 0 },
  ]), [board?.sabji?.length, board?.fruits?.length, board?.anaaj?.length]);

  const rows = tab === 'sabji'
    ? board?.sabji ?? []
    : tab === 'fruits'
      ? board?.fruits ?? []
      : board?.anaaj ?? [];

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title}>Mandi Bhaav</Text>
          <Text style={s.sub} numberOfLines={2}>
            {board?.city
              ? `${board.city} exact wholesale · ${board.seasonLabel || 'Daily desk'}`
              : 'Exact local wholesale desk'}
          </Text>
        </View>
        <View style={s.stamp}>
          <Text style={s.stampText}>{board?.updatedLabel || 'Updated today at 8:00 AM'}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabs}
      >
        {tabs.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[s.tab, tab === t.id && s.tabActive]}
            onPress={() => setTab(t.id)}
            activeOpacity={0.85}
          >
            <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && !rows.length ? (
        <View style={s.skeletonBox}>
          {[0, 1, 2, 3].map(i => <View key={i} style={s.skeletonRow} />)}
        </View>
      ) : (
        <View style={s.grid}>
          {rows.map(item => <RateRow key={item.id} item={item} />)}
          {!rows.length ? (
            <Text style={s.empty}>Rates will appear when the city desk is ready.</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  card: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.display,
    fontWeight: '800',
    color: Colors.text,
  },
  sub: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.sub,
  },
  stamp: {
    maxWidth: '42%',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stampText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.dim,
    textAlign: 'right',
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    paddingRight: 4,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  tabActive: {
    borderColor: Colors.orange,
    backgroundColor: Colors.bg,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.sub,
  },
  tabTextActive: { color: Colors.text },
  grid: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: Colors.card,
  },
  name: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
    color: Colors.text,
    paddingRight: 8,
  },
  right: { alignItems: 'flex-end' },
  price: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
  },
  unit: { marginTop: 2, fontSize: 11, color: Colors.dim },
  chg: { marginTop: 2, fontSize: 11, fontWeight: '800' },
  chgUp: { color: Colors.green },
  chgDown: { color: Colors.red },
  empty: {
    textAlign: 'center',
    color: Colors.sub,
    fontSize: 13,
    paddingVertical: 12,
  },
  skeletonBox: { gap: 8 },
  skeletonRow: {
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.card,
  },
}));
