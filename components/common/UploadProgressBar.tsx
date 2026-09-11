// components/common/UploadProgressBar.tsx — Instagram-style top upload progress

import { useEffect } from 'react';
import {
  View, Text, StyleSheet, Image, Pressable, Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  FadeInUp,
  FadeOutUp,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';
import {
  activeUploadJob,
  useUploadProgressStore,
  type UploadJob,
} from '../../stores/uploadProgressStore';

type UploadProgressBarProps = {
  onDismissSuccess?: () => void;
};

function labelFor(job: UploadJob) {
  if (job.status === 'success') {
    return job.kind === 'spark' ? 'Moment Published Successfully!' : 'Post Published Successfully!';
  }
  if (job.status === 'error') {
    return job.errorMessage || 'Upload failed. Tap to dismiss.';
  }
  if (job.status === 'saving') {
    return job.kind === 'spark' ? 'Saving Moment…' : 'Saving post…';
  }
  if (job.kind === 'spark' && job.progress < 55) {
    return 'Optimizing video…';
  }
  return job.kind === 'spark' ? 'Posting Moment…' : 'Posting…';
}

export function UploadProgressBar({ onDismissSuccess }: UploadProgressBarProps) {
  const insets = useSafeAreaInsets();
  const jobs = useUploadProgressStore(s => s.jobs);
  const dismissJob = useUploadProgressStore(s => s.dismissJob);
  const job = activeUploadJob(jobs);
  const width = useSharedValue(0);

  useEffect(() => {
    if (!job) {
      width.value = 0;
      return;
    }
    width.value = withTiming(job.progress / 100, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [job?.id, job?.progress, width, job]);

  useEffect(() => {
    if (!job || job.status !== 'success') return undefined;
    const t = setTimeout(() => {
      dismissJob(job.id);
      onDismissSuccess?.();
    }, 1600);
    return () => clearTimeout(t);
  }, [job?.id, job?.status, dismissJob, onDismissSuccess, job]);

  useEffect(() => {
    if (!job || job.status !== 'error') return undefined;
    const t = setTimeout(() => dismissJob(job.id), 4200);
    return () => clearTimeout(t);
  }, [job?.id, job?.status, dismissJob, job]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0.02, width.value) * 100}%`,
  }));

  if (!job) return null;

  const success = job.status === 'success';
  const failed = job.status === 'error';

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(180)}
      style={[
        s.wrap,
        {
          top: Math.max(insets.top, Platform.OS === 'android' ? 8 : 0) + 4,
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        style={[s.card, success && s.cardSuccess, failed && s.cardError]}
        onPress={() => {
          if (failed || success) dismissJob(job.id);
        }}
      >
        {job.thumbnailUri ? (
          <Image source={{ uri: job.thumbnailUri }} style={s.thumb} />
        ) : (
          <View style={[s.thumb, s.thumbFallback]}>
            <Text style={s.thumbEmoji}>{job.kind === 'spark' ? '⚡' : '📝'}</Text>
          </View>
        )}

        <View style={s.copy}>
          <Text style={s.title} numberOfLines={1}>
            {success ? '✓ ' : failed ? '✕ ' : ''}
            {labelFor(job)}
          </Text>
          {!success && !failed ? (
            <Text style={s.pct}>{Math.max(1, Math.min(100, job.progress))}%</Text>
          ) : null}
          {failed && job.errorMessage ? (
            <Text style={s.errorDetail} numberOfLines={2}>{job.errorMessage}</Text>
          ) : null}
        </View>
      </Pressable>

      {!success && !failed ? (
        <View style={s.track}>
          <Animated.View style={[s.fill, fillStyle]} />
        </View>
      ) : (
        <View style={[s.track, success ? s.trackDone : s.trackFail]}>
          <View style={[s.fill, { width: '100%', backgroundColor: success ? '#22C55E' : Colors.red }]} />
        </View>
      )}
    </Animated.View>
  );
}

const s = createDynamicStyles((Colors) => ({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 2000,
    elevation: 2000,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(18,18,24,0.94)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  cardSuccess: {
    backgroundColor: 'rgba(20,40,28,0.96)',
    borderColor: 'rgba(34,197,94,0.45)',
  },
  cardError: {
    backgroundColor: 'rgba(40,18,18,0.96)',
    borderColor: 'rgba(239,68,68,0.45)',
  },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: { fontSize: 18 },
  copy: { flex: 1, minWidth: 0 },
  title: {
    color: Colors.white,
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '700',
  },
  pct: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  errorDetail: {
    color: 'rgba(255,200,200,0.85)',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },
  track: {
    marginTop: 6,
    height: 3,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  trackDone: { backgroundColor: 'rgba(34,197,94,0.25)' },
  trackFail: { backgroundColor: 'rgba(239,68,68,0.25)' },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.orange,
  },
}));
