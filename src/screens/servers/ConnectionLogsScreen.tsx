import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { ConnectionLogEntry } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { useServerStatusContext } from '../../context/ServerStatusContext';
import { useThemeColors } from '../../hooks/useThemeColors';

const StyledSafeAreaView = withUniwind(SafeAreaView);

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ConnectionLogs'>;

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString();
}

function getErrorTypeLabel(errorType?: string): string {
  switch (errorType) {
    case 'network': return 'Network';
    case 'auth': return 'Auth';
    case 'timeout': return 'Timeout';
    case 'server': return 'Server';
    default: return 'Unknown';
  }
}

export default function ConnectionLogsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const { serverId, serverName } = route.params as { serverId: string; serverName: string };
  const { registerLogCallback } = useServerStatusContext();
  const colors = useThemeColors();
  const [logs, setLogs] = useState<ConnectionLogEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = registerLogCallback(serverId, (entry) => {
        setLogs((prev) => [entry, ...prev].slice(0, 100));
      });
      return unsubscribe;
    }, [serverId, registerLogCallback])
  );

  const renderLogEntry = ({ item }: { item: ConnectionLogEntry }) => {
    const isSuccess = item.status === 'success';
    
    return (
      <View className="bg-surface rounded-lg p-3 mb-2 border border-border">
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-row items-center gap-2">
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isSuccess ? colors.success : colors.danger },
              ]}
            />
            <Text
              className="font-medium text-sm"
              style={{ color: isSuccess ? colors.success : colors.danger }}
            >
              {isSuccess ? 'Success' : 'Failed'}
            </Text>
          </View>
          <Text className="text-xs text-text-subtle">
            {formatRelativeTime(item.timestamp)}
          </Text>
        </View>

        <View className="flex-row flex-wrap gap-x-4 gap-y-1">
          {item.latencyMs !== undefined && (
            <Text className="text-xs text-text-muted">
              {item.latencyMs}ms
            </Text>
          )}
          {item.httpCode !== undefined && (
            <Text className="text-xs text-text-muted">
              HTTP {item.httpCode}
            </Text>
          )}
          {item.errorType && (
            <View
              className="px-1.5 py-0.5 rounded"
              style={{ backgroundColor: colors.warning + '20' }}
            >
              <Text className="text-xs" style={{ color: colors.warning }}>
                {getErrorTypeLabel(item.errorType)}
              </Text>
            </View>
          )}
        </View>

        {item.errorMessage && (
          <Text className="text-xs text-text-subtle mt-2" numberOfLines={2}>
            {item.errorMessage}
          </Text>
        )}
      </View>
    );
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-background" testID="connection-logs-screen">
      <View className="flex-row items-center p-4 bg-surface border-b border-border">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mr-3"
          testID="back-button"
        >
          <Text className="text-primary text-lg">← Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-text flex-1">
          {serverName} Logs
        </Text>
      </View>

      <FlatList
        data={logs}
        renderItem={renderLogEntry}
        keyExtractor={(item: ConnectionLogEntry) => item.id}
        contentContainerClassName="p-4"
        testID="logs-list"
        ListEmptyComponent={
          <View className="items-center justify-center pt-16" testID="empty-logs">
            <Text className="text-lg font-semibold text-text-muted mb-2">
              No connection logs yet
            </Text>
            <Text className="text-sm text-text-subtle">
              Logs will appear here as connection attempts are made
            </Text>
          </View>
        }
      />
    </StyledSafeAreaView>
  );
}

const styles = StyleSheet.create({
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});