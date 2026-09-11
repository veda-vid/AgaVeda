// components/daily/CityEventsSection.tsx — Local events & exhibitions carousel

import { useState } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity, Linking, Platform, Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';
import { hapticLight } from '../../lib/haptics';
import { toggleEventReminder, type CityEvent } from '../../services/dailyApi';

type Props = {
  city: string;
  events: CityEvent[];
  loading?: boolean;
  onEventsChange?: (events: CityEvent[]) => void;
};

function dateBadge(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: '--', mon: '---' };
  return {
    day: String(d.getDate()).padStart(2, '0'),
    mon: d.toLocaleString('en-GB', { month: 'short' }).toUpperCase(),
  };
}

function openDirections(event: CityEvent) {
  const q = encodeURIComponent(`${event.venue}, ${event.city}`);
  const url = event.lat != null && event.lng != null
    ? Platform.select({
      ios: `http://maps.apple.com/?daddr=${event.lat},${event.lng}`,
      android: `geo:${event.lat},${event.lng}?q=${q}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`,
    })
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
  void Linking.openURL(url!);
}

function EventCard({
  event,
  onToggleRemind,
}: {
  event: CityEvent;
  onToggleRemind: (id: string) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const badge = dateBadge(event.startsAt);

  return (
    <View style={s.card}>
      <View style={s.bannerWrap}>
        {!imgFailed && event.bannerUrl ? (
          <Image
            source={{ uri: event.bannerUrl }}
            style={s.banner}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <View style={s.bannerFallback}>
            <Text style={s.bannerEmoji}>🎪</Text>
            <Text style={s.bannerFallbackText}>{event.category.toUpperCase()}</Text>
          </View>
        )}
        <View style={s.dateBadge}>
          <Text style={s.dateDay}>{badge.day}</Text>
          <Text style={s.dateMon}>{badge.mon}</Text>
        </View>
      </View>

      <Text style={s.title} numberOfLines={2}>{event.title}</Text>
      <Text style={s.host} numberOfLines={1}>{event.host}</Text>
      <Text style={s.venue} numberOfLines={1}>📍 {event.venue}</Text>

      <View style={s.actions}>
        <TouchableOpacity
          style={[s.btn, event.reminded && s.btnActive]}
          onPress={() => onToggleRemind(event.id)}
          activeOpacity={0.85}
        >
          <Text style={[s.btnText, event.reminded && s.btnTextActive]}>
            {event.reminded ? '✓ Saved' : '🔖 Save event'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.btnOutline}
          onPress={() => {
            void hapticLight();
            openDirections(event);
          }}
          activeOpacity={0.85}
        >
          <Text style={s.btnOutlineText}>📍 Get Directions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function CityEventsSection({ city, events, loading, onEventsChange }: Props) {
  const handleRemind = async (id: string) => {
    void hapticLight();
    try {
      const on = await toggleEventReminder(id);
      const next = events.map(e => (e.id === id ? { ...e, reminded: on } : e));
      onEventsChange?.(next);
      Toast.show({
        type: 'success',
        text1: on ? 'Saved on this device' : 'Cleared',
        text2: on
          ? 'Marked for this event on Daily. Push alerts coming soon.'
          : 'Event unmarked on this device.',
      });
    } catch {
      Alert.alert('Could not update reminder', 'Please try again in a moment.');
    }
  };

  return (
    <View style={s.section}>
      <View style={s.head}>
        <Text style={s.heading}>City Events</Text>
        <Text style={s.sub}>Happenings in {city || 'your city'}</Text>
      </View>

      {loading && !events.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
          {[0, 1].map(i => <View key={i} style={s.skelCard} />)}
        </ScrollView>
      ) : !events.length ? (
        <Text style={s.empty}>No upcoming events listed for this city yet.</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          contentContainerStyle={s.rail}
        >
          {events.map(event => (
            <EventCard key={event.id} event={event} onToggleRemind={id => { void handleRemind(id); }} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = createDynamicStyles((Colors) => ({
  section: {
    marginTop: 20,
    marginBottom: 8,
  },
  head: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  heading: {
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
  rail: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    width: 268,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border2,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  bannerWrap: {
    height: 120,
    backgroundColor: Colors.card,
  },
  banner: { width: '100%', height: '100%' },
  bannerFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  bannerEmoji: { fontSize: 28 },
  bannerFallbackText: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: Colors.dim,
  },
  dateBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    minWidth: 48,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(8,8,14,0.82)',
    alignItems: 'center',
  },
  dateDay: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.white,
  },
  dateMon: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.orange,
    letterSpacing: 0.6,
  },
  title: {
    marginTop: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    color: Colors.text,
  },
  host: {
    marginTop: 4,
    paddingHorizontal: 12,
    fontSize: 12,
    color: Colors.sub,
  },
  venue: {
    marginTop: 4,
    paddingHorizontal: 12,
    fontSize: 12,
    color: Colors.dim,
  },
  actions: {
    marginTop: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  btnActive: {
    backgroundColor: Colors.orange,
    borderColor: Colors.orange,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
  },
  btnTextActive: { color: Colors.white },
  btnOutline: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border2,
  },
  btnOutlineText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.sub,
  },
  empty: {
    paddingHorizontal: 16,
    color: Colors.sub,
    fontSize: 13,
  },
  skelCard: {
    width: 268,
    height: 260,
    borderRadius: 18,
    backgroundColor: Colors.card,
  },
}));
