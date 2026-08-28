// components/seller/WeeklyHoursPicker.tsx — Weekly operating schedule UI
import { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform, Modal, ScrollView,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Colors, Fonts } from '../../constants/theme';
import {
  WEEKDAYS, type WeekdayKey, type WeeklySchedule, type DayHours,
  defaultWeeklySchedule, preset24_7Schedule, presetStandardHours,
  formatTimeLabel, formatScheduleSummary, timeStringToMinutes, minutesToTimeString,
} from '../../lib/shopScheduleUtils';
import type { ShopOperatingHours } from '../../types';

const WebInput = 'input' as any;

function hexAlpha(hex: string, alpha: string) {
  return `${hex}${alpha}`;
}

function dateFromTimeString(time: string): Date {
  const mins = timeStringToMinutes(time) ?? 9 * 60;
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}

function timeFromDate(date: Date): string {
  return minutesToTimeString(date.getHours() * 60 + date.getMinutes());
}

type PickerTarget = { day: WeekdayKey; field: 'open' | 'close' } | null;

function ScaleChip({
  label, active, onPress, accent,
}: { label: string; active?: boolean; onPress: () => void; accent?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        st.chip,
        active && { borderColor: accent ?? Colors.orange, backgroundColor: hexAlpha(accent ?? Colors.orange, '18') },
      ]}
    >
      <Text style={[st.chipText, active && { color: accent ?? Colors.orange }]}>{label}</Text>
    </Pressable>
  );
}

export function WeeklyHoursPicker({
  value, onChange,
}: {
  value: ShopOperatingHours;
  onChange: (next: ShopOperatingHours) => void;
}) {
  const [picker, setPicker] = useState<PickerTarget>(null);
  const { schedule: rawSchedule, closedToday, is24_7 } = value;
  const schedule = rawSchedule as WeeklySchedule;

  const updateSchedule = (next: WeeklySchedule) => onChange({ ...value, schedule: next, is24_7: false });
  const updateDay = (day: WeekdayKey, patch: Partial<DayHours>) => {
    updateSchedule({ ...schedule, [day]: { ...schedule[day], ...patch } } as WeeklySchedule);
  };

  const applyPreset24_7 = () => {
    onChange({ schedule: preset24_7Schedule(), closedToday: false, is24_7: true });
  };

  const applyStandard = () => {
    onChange({ schedule: presetStandardHours(), closedToday: false, is24_7: false });
  };

  const toggleClosedToday = () => {
    onChange({ ...value, closedToday: !closedToday, is24_7: false });
  };

  const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (!picker) return;
    if (Platform.OS === 'android') setPicker(null);
    if (event.type === 'dismissed' || !date) return;
    updateDay(picker.day, { [picker.field]: timeFromDate(date) });
  };

  const pickerTime = picker
    ? schedule[picker.day][picker.field]
    : '09:00';

  return (
    <View style={st.root}>
      <View style={st.presetRow}>
        <ScaleChip label="24/7" active={is24_7} onPress={applyPreset24_7} accent="#10B981" />
        <ScaleChip label="Standard (9 AM – 8 PM)" active={!is24_7 && !closedToday} onPress={applyStandard} />
        <ScaleChip label={closedToday ? 'Closed Today ✓' : 'Mark Closed Today'} active={closedToday} onPress={toggleClosedToday} accent="#64748B" />
      </View>

      <Text style={st.summary}>{formatScheduleSummary(schedule)}</Text>

      {!is24_7 ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.dayRail}>
            {WEEKDAYS.map(day => {
              const enabled = schedule[day.key].enabled;
              return (
                <Pressable
                  key={day.key}
                  onPress={() => updateDay(day.key, { enabled: !enabled })}
                  style={[st.dayChip, enabled && st.dayChipActive]}
                >
                  <Text style={[st.dayChipText, enabled && st.dayChipTextActive]}>{day.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={st.slotsCard}>
            {WEEKDAYS.filter(d => schedule[d.key].enabled).map(day => {
              const slot = schedule[day.key];
              return (
                <View key={day.key} style={st.slotRow}>
                  <Text style={st.slotDay}>{day.full}</Text>
                  <View style={st.slotPills}>
                    {Platform.OS === 'web' ? (
                      <>
                        <View style={st.timePill}>
                          <Text style={st.timePillLabel}>Opens</Text>
                          <WebInput
                            type="time"
                            value={slot.open}
                            onChange={(e: any) => updateDay(day.key, { open: e.target.value })}
                            style={st.webTimeInput as any}
                          />
                        </View>
                        <Text style={st.slotSep}>→</Text>
                        <View style={st.timePill}>
                          <Text style={st.timePillLabel}>Closes</Text>
                          <WebInput
                            type="time"
                            value={slot.close}
                            onChange={(e: any) => updateDay(day.key, { close: e.target.value })}
                            style={st.webTimeInput as any}
                          />
                        </View>
                      </>
                    ) : (
                      <>
                        <Pressable style={st.timePill} onPress={() => setPicker({ day: day.key, field: 'open' })}>
                          <Text style={st.timePillLabel}>Opens</Text>
                          <Text style={st.timePillValue}>{formatTimeLabel(slot.open)}</Text>
                        </Pressable>
                        <Text style={st.slotSep}>→</Text>
                        <Pressable style={st.timePill} onPress={() => setPicker({ day: day.key, field: 'close' })}>
                          <Text style={st.timePillLabel}>Closes</Text>
                          <Text style={st.timePillValue}>{formatTimeLabel(slot.close)}</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
            {!WEEKDAYS.some(d => schedule[d.key].enabled) ? (
              <Text style={st.emptyHint}>Enable at least one day above to set hours.</Text>
            ) : null}
          </View>
        </>
      ) : (
        <View style={st.allDayBanner}>
          <Text style={st.allDayEmoji}>🌙</Text>
          <View style={{ flex: 1 }}>
            <Text style={st.allDayTitle}>Open 24 hours, 7 days a week</Text>
            <Text style={st.allDaySub}>Customers can reach you anytime.</Text>
          </View>
        </View>
      )}

      {closedToday ? (
        <View style={st.closedTodayBanner}>
          <Text style={st.closedTodayText}>Today is marked closed — your shop will show as closed until tomorrow.</Text>
        </View>
      ) : null}

      {Platform.OS !== 'web' && picker ? (
        <Modal transparent animationType="slide" visible onRequestClose={() => setPicker(null)}>
          <Pressable style={st.modalBackdrop} onPress={() => setPicker(null)}>
            <Pressable style={st.modalCard} onPress={() => {}}>
              <Text style={st.modalTitle}>
                {picker.field === 'open' ? 'Opening time' : 'Closing time'} · {WEEKDAYS.find(d => d.key === picker.day)?.full}
              </Text>
              <DateTimePicker
                value={dateFromTimeString(pickerTime)}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handlePickerChange}
              />
              {Platform.OS === 'ios' ? (
                <Pressable style={st.modalDone} onPress={() => setPicker(null)}>
                  <Text style={st.modalDoneText}>Done</Text>
                </Pressable>
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: { gap: 14 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999, borderWidth: 1.5, borderColor: Colors.border2,
    backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 8,
  },
  chipText: { fontSize: 12, fontFamily: Fonts.bodySemiBold, fontWeight: '700', color: Colors.sub },
  summary: { fontSize: 12, color: Colors.dim, fontFamily: Fonts.body },
  dayRail: { gap: 8, paddingVertical: 2 },
  dayChip: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border2,
  },
  dayChipActive: { backgroundColor: hexAlpha(Colors.orange, '22'), borderColor: Colors.orange },
  dayChipText: { fontSize: 11, fontWeight: '800', color: Colors.dim },
  dayChipTextActive: { color: Colors.orange },
  slotsCard: {
    backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border2,
    padding: 12, gap: 10,
  },
  slotRow: { gap: 8 },
  slotDay: { fontSize: 12, fontWeight: '800', color: Colors.text, fontFamily: Fonts.bodySemiBold },
  slotPills: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  slotSep: { color: Colors.dim, fontSize: 14, fontWeight: '700' },
  timePill: {
    flex: 1, minWidth: 120, backgroundColor: Colors.card, borderRadius: 999,
    borderWidth: 1.5, borderColor: Colors.border2, paddingHorizontal: 14, paddingVertical: 10, gap: 2,
  },
  timePillLabel: { fontSize: 10, color: Colors.dim, fontWeight: '700', letterSpacing: 0.3 },
  timePillValue: { fontSize: 14, color: Colors.text, fontWeight: '800', fontFamily: Fonts.bodySemiBold },
  webTimeInput: Platform.OS === 'web' ? ({
    border: 'none', outline: 'none', background: 'transparent',
    color: Colors.text, fontSize: 14, fontWeight: 700, fontFamily: 'system-ui',
  } as object) : {},
  emptyHint: { fontSize: 12, color: Colors.dim, fontStyle: 'italic' },
  allDayBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: hexAlpha('#10B981', '14'), borderRadius: 14,
    borderWidth: 1, borderColor: hexAlpha('#10B981', '33'), padding: 14,
  },
  allDayEmoji: { fontSize: 28 },
  allDayTitle: { fontSize: 14, fontWeight: '800', color: Colors.text },
  allDaySub: { fontSize: 12, color: Colors.sub, marginTop: 2 },
  closedTodayBanner: {
    backgroundColor: hexAlpha('#64748B', '18'), borderRadius: 12,
    borderWidth: 1, borderColor: hexAlpha('#64748B', '33'), padding: 10,
  },
  closedTodayText: { fontSize: 12, color: Colors.sub, lineHeight: 17 },
  modalBackdrop: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 18, gap: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  modalDone: {
    backgroundColor: Colors.orange, borderRadius: 12, alignItems: 'center', paddingVertical: 12,
  },
  modalDoneText: { color: Colors.white, fontWeight: '800' },
});
