import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SSHConnectionStatus } from '../../types';
import { useThemeColors } from '../../hooks/useThemeColors';

interface SSHStatusLineProps {
  status: SSHConnectionStatus;
  errorMessage?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

const STATUS_CONFIG: Record<SSHConnectionStatus, { color: string; label: string }> = {
  disconnected: { color: '#6b7280', label: 'Disconnected' },
  connecting: { color: '#eab308', label: 'Connecting...' },
  connected: { color: '#22c55e', label: 'Connected' },
  error: { color: '#ef4444', label: 'Error' },
};

export default function SSHStatusLine({
  status,
  errorMessage,
  onConnect,
  onDisconnect,
}: SSHStatusLineProps) {
  const colors = useThemeColors();
  const config = STATUS_CONFIG[status];
  const isConnecting = status === 'connecting';
  const isConnected = status === 'connected';

  return (
    <View className="bg-surface border-b border-border px-4 py-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2 flex-1">
          {isConnecting ? (
            <ActivityIndicator size="small" color={config.color} />
          ) : (
            <View
              style={{ backgroundColor: config.color }}
              className="w-2.5 h-2.5 rounded-full"
            />
          )}
          <Text className="text-text font-semibold text-sm">SSH</Text>
          <Text style={{ color: config.color }} className="text-sm">
            {config.label}
          </Text>
        </View>

        <TouchableOpacity
          onPress={isConnected ? onDisconnect : onConnect}
          disabled={isConnecting}
          className={`px-3 py-1.5 rounded-md ${
            isConnected
              ? 'bg-danger/10 border border-danger/20'
              : isConnecting
                ? 'bg-border-muted'
                : 'bg-primary'
          }`}
        >
          <Text
            className={`text-sm font-semibold ${
              isConnected ? 'text-danger' : isConnecting ? 'text-text-subtle' : 'text-white'
            }`}
          >
            {isConnected ? 'Disconnect' : isConnecting ? 'Connecting...' : 'Connect'}
          </Text>
        </TouchableOpacity>
      </View>

      {status === 'error' && errorMessage && (
        <Text className="text-danger text-xs mt-1" numberOfLines={2}>
          {errorMessage}
        </Text>
      )}
    </View>
  );
}
