import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { Colors, Fonts, Radius } from '../../constants/theme';
import { reverseGeocodeLocation, searchLocations, type LocationSuggestion } from '../../lib/locationSearch';

const SLATE_800 = '#1E293B';
const SLATE_700 = '#334155';
const SLATE_600 = '#475569';

type SparkLocationPickerProps = {
  value: string;
  onChange: (location: string) => void;
  /** Run GPS detection when the details step mounts */
  autoDetectOnMount?: boolean;
  disabled?: boolean;
};

export function SparkLocationPicker({
  value,
  onChange,
  autoDetectOnMount = true,
  disabled = false,
}: SparkLocationPickerProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const detectRanRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const detectCurrentLocation = useCallback(async (silent = false) => {
    if (disabled) return;
    setDetecting(true);
    if (!silent) setHint(null);

    try {
      if (Platform.OS === 'web') {
        if (!navigator.geolocation) {
          setHint('Location is not supported in this browser. Type your city manually.');
          return;
        }
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 12000,
            maximumAge: 60000,
          });
        });
        const result = await reverseGeocodeLocation(
          position.coords.latitude,
          position.coords.longitude,
        );
        if (!mountedRef.current) return;
        if (result?.label) {
          onChange(result.label);
          setQuery(result.label);
          setDropdownOpen(false);
          setSuggestions([]);
        } else {
          setHint('Could not resolve your city. Please search or type manually.');
        }
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setHint('Location permission denied. Search or type your city manually.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const result = await reverseGeocodeLocation(
        position.coords.latitude,
        position.coords.longitude,
      );

      if (!mountedRef.current) return;
      if (result?.label) {
        onChange(result.label);
        setQuery(result.label);
        setDropdownOpen(false);
        setSuggestions([]);
      } else {
        setHint('Could not resolve your city. Please search or type manually.');
      }
    } catch {
      if (mountedRef.current) {
        setHint('Could not detect location. Search or type your city manually.');
      }
    } finally {
      if (mountedRef.current) setDetecting(false);
    }
  }, [disabled, onChange]);

  useEffect(() => {
    if (!autoDetectOnMount) {
      detectRanRef.current = false;
      return;
    }
    if (detectRanRef.current) return;
    detectRanRef.current = true;
    if (!value.trim()) {
      void detectCurrentLocation(true);
    }
  }, [autoDetectOnMount, detectCurrentLocation, value]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      void searchLocations(trimmed)
        .then(rows => {
          if (!mountedRef.current) return;
          setSuggestions(rows);
          if (!rows.length) {
            setHint('No matches found. You can still use your typed text.');
          } else {
            setHint(null);
          }
        })
        .catch(() => {
          if (!mountedRef.current) return;
          setSuggestions([]);
          setHint('Search unavailable. You can still type your location manually.');
        })
        .finally(() => {
          if (mountedRef.current) setSearching(false);
        });
    }, 350);

    return () => clearTimeout(timer);
  }, [query, dropdownOpen]);

  const onSelectSuggestion = (item: LocationSuggestion) => {
    onChange(item.label);
    setQuery(item.label);
    setDropdownOpen(false);
    setSuggestions([]);
    setHint(null);
  };

  const onChangeText = (text: string) => {
    setQuery(text);
    onChange(text);
    setDropdownOpen(true);
    if (!text.trim()) {
      setSuggestions([]);
      setHint(null);
    }
  };

  return (
    <View style={s.wrap}>
      <View style={s.inputRow}>
        <View style={s.inputShell}>
          <Text style={s.pinIcon}>📍</Text>
          <TextInput
            value={query}
            onChangeText={onChangeText}
            onFocus={() => setDropdownOpen(true)}
            placeholder="Search city, landmark, or country"
            placeholderTextColor={SLATE_600}
            style={s.input}
            editable={!disabled}
            autoCorrect={false}
            autoCapitalize="words"
          />
          {(searching || detecting) ? (
            <ActivityIndicator size="small" color={Colors.orange} style={s.inputSpinner} />
          ) : null}
        </View>
        <TouchableOpacity
          style={[s.detectBtn, (detecting || disabled) && s.detectBtnDisabled]}
          onPress={() => void detectCurrentLocation()}
          disabled={detecting || disabled}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Use current location"
        >
          <Text style={s.detectBtnText}>
            {detecting ? 'Detecting…' : '📍 Current Location'}
          </Text>
        </TouchableOpacity>
      </View>

      {hint ? <Text style={s.hint}>{hint}</Text> : null}

      {dropdownOpen && (suggestions.length > 0 || (searching && query.trim().length >= 2)) ? (
        <View style={s.dropdown}>
          {searching && !suggestions.length ? (
            <View style={s.dropdownLoading}>
              <ActivityIndicator size="small" color={Colors.orange} />
              <Text style={s.dropdownLoadingText}>Searching locations…</Text>
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              style={s.dropdownList}
            >
              {suggestions.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={s.suggestionRow}
                  onPress={() => onSelectSuggestion(item)}
                  activeOpacity={0.75}
                >
                  <Text style={s.suggestionPin}>📍</Text>
                  <Text style={s.suggestionText} numberOfLines={2}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginBottom: 12,
    zIndex: 20,
  },
  inputRow: {
    gap: 8,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SLATE_800,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: SLATE_700,
    paddingHorizontal: 10,
    minHeight: 48,
  },
  pinIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  input: {
    flex: 1,
    color: Colors.white,
    fontSize: 14,
    fontFamily: Fonts.body,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  inputSpinner: {
    marginLeft: 8,
  },
  detectBtn: {
    alignSelf: 'flex-start',
    backgroundColor: SLATE_800,
    borderWidth: 1,
    borderColor: SLATE_700,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detectBtnDisabled: { opacity: 0.55 },
  detectBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
  },
  hint: {
    marginTop: 6,
    color: Colors.dim,
    fontSize: 11,
    lineHeight: 16,
  },
  dropdown: {
    marginTop: 6,
    backgroundColor: SLATE_800,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: SLATE_700,
    overflow: 'hidden',
    maxHeight: 220,
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(0,0,0,0.45)' } as object,
      default: { elevation: 6 },
    }),
  },
  dropdownList: {
    maxHeight: 220,
  },
  dropdownLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dropdownLoadingText: {
    color: Colors.sub,
    fontSize: 13,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SLATE_700,
  },
  suggestionPin: { fontSize: 14 },
  suggestionText: {
    flex: 1,
    color: Colors.white,
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
    lineHeight: 19,
  },
});
