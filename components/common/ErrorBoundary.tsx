// components/common/ErrorBoundary.tsx — Feed-safe recovery boundary (Refresh Feed)

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Fonts, createDynamicStyles } from '../../constants/theme';

type Props = {
  children: React.ReactNode;
  onError?: (error: Error) => void;
  /** Called when user taps Refresh Feed — parent should re-fetch. */
  onRefresh?: () => void;
  fallbackTitle?: string;
  fallbackMessage?: string;
  refreshLabel?: string;
};

type State = {
  hasError: boolean;
  message: string;
};

/**
 * Catches render crashes in the Home feed tree and shows a recovery UI
 * instead of a black / blank screen.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Something went wrong while loading the feed.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('[feed-error-boundary]', error?.message, info?.componentStack);
    try {
      this.props.onError?.(error);
    } catch {
      /* ignore */
    }
  }

  private refresh = () => {
    this.setState({ hasError: false, message: '' }, () => {
      try {
        this.props.onRefresh?.();
      } catch (e) {
        console.warn('[feed-error-boundary] refresh failed', e);
      }
    });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.root} accessibilityRole="alert">
        <Text style={styles.emoji}>⚡</Text>
        <Text style={styles.title}>
          {this.props.fallbackTitle ?? 'Feed needs a refresh'}
        </Text>
        <Text style={styles.body}>
          {this.props.fallbackMessage
            ?? 'Something interrupted the Home feed. Your post may still have published — tap Refresh Feed to continue.'}
        </Text>
        {__DEV__ && this.state.message ? (
          <Text style={styles.dev}>{this.state.message}</Text>
        ) : null}
        <Pressable onPress={this.refresh} style={styles.btn} accessibilityRole="button">
          <Text style={styles.btnText}>
            {this.props.refreshLabel ?? 'Refresh Feed'}
          </Text>
        </Pressable>
      </View>
    );
  }
}

export default ErrorBoundary;

const styles = createDynamicStyles((Colors) => ({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  emoji: { fontSize: 28, marginBottom: 4 },
  title: {
    color: Colors.text,
    fontSize: 20,
    fontFamily: Fonts.bodySemiBold,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    color: Colors.sub,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  dev: {
    marginTop: 8,
    color: Colors.dim,
    fontSize: 11,
    textAlign: 'center',
  },
  btn: {
    marginTop: 14,
    backgroundColor: Colors.orange,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
}));
