import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ConnectionStatus } from '../types';
import { useThemeColors } from '../hooks/useThemeColors';

interface ServerStatusBadgeProps {
  status: ConnectionStatus;
  serverName: string;
  size?: 'small' | 'medium';
  testId?: string;
}

export const ServerStatusBadge: React.FC<ServerStatusBadgeProps> = ({
  status,
  serverName,
  size = 'small',
  testId,
}) => {
  const colors = useThemeColors();
  
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return colors.success;
      case 'disconnected':
        return colors.danger;
      case 'checking':
        return colors.textMuted;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'checking':
        return 'Checking...';
    }
  };

  const dotSize = size === 'small' ? 8 : 10;
  const fontSize = size === 'small' ? 11 : 13;

  const badgeId = testId || `server-status-${serverName.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <View
      style={[styles.container, size === 'medium' && styles.containerMedium]}
      testID={badgeId}
    >
      <View
        style={[
          styles.dot,
          status === 'checking' && styles.dotPulsing,
          { width: dotSize, height: dotSize, backgroundColor: getStatusColor() },
        ]}
      />
      <Text style={[styles.text, { fontSize, color: colors.textMuted }]}>
        {getStatusText()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  containerMedium: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 12,
  },
  dot: {
    borderRadius: 4,
  },
  dotPulsing: {
    opacity: 0.6,
  },
  text: {
    fontWeight: '500',
  },
});