import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { Colors } from '../constants/theme';

/**
 * Standard pull-to-refresh control + handler for ScrollView / FlatList.
 */
export function usePullToRefresh(refetch: () => void | Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={Colors.orange}
      colors={[Colors.orange]}
      progressBackgroundColor={Colors.surface}
    />
  );

  return { refreshing, onRefresh, refreshControl };
}
