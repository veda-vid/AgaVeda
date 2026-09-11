// components/common/AppErrorBoundary.tsx — Catch native-module / render crashes without blank hang

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, createDynamicStyles } from '../../constants/theme';

type Props = {
  children: React.ReactNode;
  /** Called when an error is caught (e.g. force-hide splash). */
  onError?: (error: Error) => void;
  fallbackTitle?: string;
  fallbackMessage?: string;
};

type State = {
  hasError: boolean;
  message: string;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Something went wrong while loading this screen.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('[error-boundary] Caught render error:', error?.message, info?.componentStack);
    try {
      this.props.onError?.(error);
    } catch {
      // ignore
    }
  }

  private retry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.root} accessibilityRole="alert">
        <Text style={styles.title}>
          {this.props.fallbackTitle ?? 'We hit a snag'}
        </Text>
        <Text style={styles.body}>
          {this.props.fallbackMessage
            ?? 'This screen could not load. Your other tabs should still work.'}
        </Text>
        {__DEV__ && this.state.message ? (
          <Text style={styles.dev}>{this.state.message}</Text>
        ) : null}
        <Pressable onPress={this.retry} style={styles.btn} accessibilityRole="button">
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = createDynamicStyles((Colors) => ({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  title: {
    color: Colors.text,
    fontSize: 20,
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
}));
