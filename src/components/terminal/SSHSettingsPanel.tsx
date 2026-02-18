import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { SSHConfig } from '../../types';
import { useThemeColors } from '../../hooks/useThemeColors';

interface SSHSettingsPanelProps {
  config: SSHConfig;
  onConfigChange: (config: SSHConfig) => void;
  disabled?: boolean;
}

export default function SSHSettingsPanel({
  config,
  onConfigChange,
  disabled = false,
}: SSHSettingsPanelProps) {
  const colors = useThemeColors();
  const [expanded, setExpanded] = useState(false);

  const updateField = <K extends keyof SSHConfig>(field: K, value: SSHConfig[K]) => {
    onConfigChange({ ...config, [field]: value });
  };

  return (
    <View className="border-b border-border">
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        className="flex-row items-center justify-between px-4 py-2.5 bg-surface"
      >
        <Text className="text-text-subtle text-sm font-medium">SSH Settings</Text>
        <Text className="text-text-subtle text-sm">{expanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View className="px-4 py-3 bg-surface-elevated gap-3">
          <View>
            <Text className="text-text-subtle text-xs mb-1">Host</Text>
            <TextInput
              className="text-text text-sm p-2 bg-surface rounded border border-border"
              value={config.host}
              editable={false}
              placeholderTextColor={colors.textSubtle}
            />
          </View>

          <View>
            <Text className="text-text-subtle text-xs mb-1">Port</Text>
            <TextInput
              className="text-text text-sm p-2 bg-surface rounded border border-border"
              value={String(config.port)}
              onChangeText={(text) => {
                const port = parseInt(text, 10);
                if (!isNaN(port)) updateField('port', port);
              }}
              keyboardType="number-pad"
              editable={!disabled}
              placeholderTextColor={colors.textSubtle}
            />
          </View>

          <View>
            <Text className="text-text-subtle text-xs mb-1">Username</Text>
            <TextInput
              className="text-text text-sm p-2 bg-surface rounded border border-border"
              value={config.username}
              onChangeText={(text) => updateField('username', text)}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!disabled}
              placeholderTextColor={colors.textSubtle}
              placeholder="e.g. root"
            />
          </View>

          <View>
            <Text className="text-text-subtle text-xs mb-1">Password</Text>
            <TextInput
              className="text-text text-sm p-2 bg-surface rounded border border-border"
              value={config.password || ''}
              onChangeText={(text) => updateField('password', text)}
              secureTextEntry
              editable={!disabled}
              placeholderTextColor={colors.textSubtle}
              placeholder="SSH password"
            />
          </View>

          <View>
            <Text className="text-text-subtle text-xs mb-1">Private Key (PEM)</Text>
            <TextInput
              className="text-text text-xs p-2 bg-surface rounded border border-border font-mono"
              value={config.privateKey || ''}
              onChangeText={(text) => updateField('privateKey', text)}
              multiline
              numberOfLines={4}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!disabled}
              placeholderTextColor={colors.textSubtle}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          </View>

          <View>
            <Text className="text-text-subtle text-xs mb-1">Passphrase (optional)</Text>
            <TextInput
              className="text-text text-sm p-2 bg-surface rounded border border-border"
              value={config.passphrase || ''}
              onChangeText={(text) => updateField('passphrase', text)}
              secureTextEntry
              editable={!disabled}
              placeholderTextColor={colors.textSubtle}
              placeholder="Key passphrase"
            />
          </View>

          <TouchableOpacity
            onPress={() => {
              onConfigChange(config);
              setExpanded(false);
            }}
            disabled={disabled}
            className={`py-2 rounded-md items-center ${disabled ? 'bg-border-muted' : 'bg-primary'}`}
          >
            <Text className={`font-semibold text-sm ${disabled ? 'text-text-subtle' : 'text-white'}`}>
              Apply Settings
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
