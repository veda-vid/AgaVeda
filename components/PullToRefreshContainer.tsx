import React from 'react';
import { ScrollView, ScrollViewProps } from 'react-native';
import { useScreenRefresh } from '../hooks/useScreenRefresh';

type PullToRefreshContainerProps = ScrollViewProps & {
  onRefresh: () => void | Promise<void>;
};

/** ScrollView wrapper with standardized pull-to-refresh spinner + handler. */
export function PullToRefreshContainer({
  onRefresh,
  children,
  ...rest
}: PullToRefreshContainerProps) {
  const { refreshControl } = useScreenRefresh(onRefresh);
  return (
    <ScrollView refreshControl={refreshControl} {...rest}>
      {children}
    </ScrollView>
  );
}

export { useScreenRefresh } from '../hooks/useScreenRefresh';
