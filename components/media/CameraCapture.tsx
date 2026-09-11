import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, Platform, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Fonts, Radius, createDynamicStyles } from '../../constants/theme';

export type CapturedMedia = {
  uri: string;
  type: 'image' | 'video';
  durationMs?: number;
};

type CameraCaptureProps = {
  visible: boolean;
  mode: 'photo' | 'video';
  onClose: () => void;
  onCapture: (media: CapturedMedia) => void;
};

/**
 * Live camera capture:
 * - Web: getUserMedia + canvas snapshot (photo) / MediaRecorder (hold-to-record video)
 * - Native: expo-image-picker camera (photo or video)
 */
export function CameraCapture({ visible, mode, onClose, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartedAt = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('environment');
  const [flashOn, setFlashOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [busy, setBusy] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startWebCamera = useCallback(async (face: 'user' | 'environment', torch?: boolean) => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    setError(null);
    setReady(false);
    stopStream();
    try {
      const constraints: MediaStreamConstraints = {
        audio: mode === 'video',
        video: {
          facingMode: { ideal: face },
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      // Torch if supported
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
      if (caps?.torch && torch) {
        await track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] }).catch(() => {});
      }
      setReady(true);
    } catch (e: any) {
      setError(e?.message || 'Camera permission denied or unavailable.');
      setReady(false);
    }
  }, [mode, stopStream]);

  useEffect(() => {
    if (!visible) {
      stopStream();
      setRecording(false);
      setElapsedMs(0);
      setReady(false);
      setError(null);
      return;
    }

    if (Platform.OS !== 'web') {
      // Native: jump straight into system camera UI
      (async () => {
        setBusy(true);
        try {
          const cam = await ImagePicker.requestCameraPermissionsAsync();
          if (cam.status !== 'granted') {
            Alert.alert('Permission needed', 'Allow camera access to capture media.');
            onClose();
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: mode === 'video'
              ? ImagePicker.MediaTypeOptions.Videos
              : ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsEditing: true,
            aspect: mode === 'photo' ? [1, 1] : [9, 16],
            videoMaxDuration: 60,
            videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
            videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
          });
          if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            onCapture({
              uri: asset.uri,
              type: asset.type === 'video' || mode === 'video' ? 'video' : 'image',
              durationMs: asset.duration ? asset.duration * 1000 : undefined,
            });
          } else {
            onClose();
          }
        } catch (e: any) {
          Alert.alert('Camera error', e?.message || 'Could not open camera.');
          onClose();
        } finally {
          setBusy(false);
        }
      })();
      return;
    }

    void startWebCamera(facing, flashOn);
    return () => stopStream();
  }, [visible, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const flipCamera = async () => {
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    await startWebCamera(next, flashOn);
  };

  const toggleFlash = async () => {
    const next = !flashOn;
    setFlashOn(next);
    const track = streamRef.current?.getVideoTracks()[0];
    const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
    if (caps?.torch) {
      await track!.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] }).catch(() => {});
    } else if (next) {
      Alert.alert('Flash', 'Torch is not supported on this camera.');
      setFlashOn(false);
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) return;
      const uri = URL.createObjectURL(blob);
      stopStream();
      onCapture({ uri, type: 'image' });
    }, 'image/jpeg', 0.9);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || recording) return;
    chunksRef.current = [];
    try {
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
        const uri = URL.createObjectURL(blob);
        const durationMs = Date.now() - recordStartedAt.current;
        stopStream();
        onCapture({ uri, type: 'video', durationMs });
      };
      recordStartedAt.current = Date.now();
      setElapsedMs(0);
      setRecording(true);
      recorder.start(200);
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - recordStartedAt.current);
      }, 200);
    } catch (e: any) {
      Alert.alert('Recording failed', e?.message || 'MediaRecorder is not available.');
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      recorderRef.current?.stop();
    } catch { /* noop */ }
  };

  const formatTimer = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  // Native path uses system UI — show a light loading overlay while launching
  if (Platform.OS !== 'web') {
    return (
      <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
        <View style={s.nativeLaunch}>
          <ActivityIndicator color={Colors.orange} size="large" />
          <Text style={s.nativeLaunchText}>{busy ? 'Opening camera…' : 'Camera'}</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Text style={s.closeText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => { stopStream(); onClose(); }} hitSlop={12}>
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={s.topTitle}>{mode === 'video' ? 'Record Moment' : 'Take Photo'}</Text>
          <TouchableOpacity onPress={toggleFlash} hitSlop={12}>
            <Text style={s.toolText}>{flashOn ? 'Flash On' : 'Flash'}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.previewWrap}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: facing === 'user' ? 'scaleX(-1)' : undefined,
              backgroundColor: '#000',
            }}
          />
          {!ready && !error ? (
            <View style={s.overlayCenter}>
              <ActivityIndicator color={Colors.orange} size="large" />
              <Text style={s.hint}>Starting camera…</Text>
            </View>
          ) : null}
          {error ? (
            <View style={s.overlayCenter}>
              <Text style={s.errorText}>{error}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={() => void startWebCamera(facing, flashOn)}>
                <Text style={s.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {recording ? (
            <View style={s.recBadge}>
              <View style={s.recDot} />
              <Text style={s.recText}>{formatTimer(elapsedMs)}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.controls}>
          <TouchableOpacity style={s.sideTool} onPress={() => void flipCamera()}>
            <Text style={s.sideToolIcon}>↺</Text>
            <Text style={s.sideToolLabel}>Flip</Text>
          </TouchableOpacity>

          {mode === 'photo' ? (
            <TouchableOpacity style={s.shutter} onPress={takePhoto} disabled={!ready}>
              <View style={s.shutterInner} />
            </TouchableOpacity>
          ) : (
            <Pressable
              style={[s.shutter, recording && s.shutterRecording]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
              disabled={!ready}
            >
              <View style={[s.shutterInner, recording && s.shutterInnerRec]} />
            </Pressable>
          )}

          <View style={s.sideTool}>
            <Text style={s.sideToolLabel}>
              {mode === 'video' ? (recording ? 'Release' : 'Hold') : 'Snap'}
            </Text>
          </View>
        </View>
        {mode === 'video' ? (
          <Text style={s.holdHint}>Hold the button to record · up to 60s</Text>
        ) : null}
      </View>
    </Modal>
  );
}

const s = createDynamicStyles((Colors) => ({
  root: { flex: 1, backgroundColor: Colors.black },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'web' ? 16 : 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topTitle: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
  },
  closeText: { color: Colors.white, fontSize: 22, fontWeight: '300' },
  toolText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  previewWrap: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#111',
    position: 'relative',
  },
  overlayCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 24,
  },
  hint: { color: Colors.sub, fontSize: 13 },
  errorText: { color: Colors.white, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  retryBtn: {
    marginTop: 8,
    backgroundColor: Colors.orange,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  retryText: { color: Colors.white, fontWeight: '700' },
  recBadge: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.red },
  recText: { color: Colors.white, fontWeight: '800', fontFamily: Fonts.bodySemiBold },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 36,
    paddingVertical: 28,
  },
  sideTool: { width: 64, alignItems: 'center', gap: 4 },
  sideToolIcon: { color: Colors.white, fontSize: 26 },
  sideToolLabel: { color: Colors.sub, fontSize: 11, fontWeight: '600' },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRecording: { borderColor: Colors.red },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Colors.white,
  },
  shutterInnerRec: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.red,
  },
  holdHint: {
    textAlign: 'center',
    color: Colors.dim,
    fontSize: 12,
    paddingBottom: 20,
  },
  nativeLaunch: {
    flex: 1,
    backgroundColor: '#000C',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  nativeLaunchText: { color: Colors.white, fontSize: 14 },
  closeBtn: { marginTop: 16, padding: 12 },
}));
