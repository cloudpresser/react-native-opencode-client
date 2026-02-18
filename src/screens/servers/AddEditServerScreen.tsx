import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { useStore } from '../../store';
import { Server } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { useThemeColors } from '../../hooks/useThemeColors';

const StyledSafeAreaView = withUniwind(SafeAreaView);

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AddEditServer'>;
type AddEditServerRouteProp = RouteProp<RootStackParamList, 'AddEditServer'>;

export default function AddEditServerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<AddEditServerRouteProp>();
  const colors = useThemeColors();
  const editingServer = route.params?.server;
  
  const { addServer, updateServer } = useStore();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [formData, setFormData] = useState({
    name: editingServer?.name || '',
    host: editingServer?.host || '',
    port: editingServer?.port?.toString() || '',
    useSSL: editingServer?.useSSL || false,
    apiKey: editingServer?.apiKey || '',
  });

  const handleSave = async () => {
    if (savingRef.current) return;
    if (!formData.name || !formData.host || !formData.port) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    savingRef.current = true;
    setSaving(true);

    const server: Server = {
      id: editingServer?.id || Date.now().toString(),
      name: formData.name,
      host: formData.host,
      port: parseInt(formData.port) || 3000,
      useSSL: formData.useSSL,
      apiKey: formData.apiKey || undefined,
    };

    if (editingServer) {
      await updateServer(server.id, server);
    } else {
      await addServer(server);
    }

    // Delay navigation to allow duplicate taps to be absorbed before navigating away
    setTimeout(() => {
      navigation.goBack();
    }, 1500);
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-background" testID="add-edit-server-screen">
      <View className="flex-row justify-between items-center p-4 bg-surface border-b border-border">
        <TouchableOpacity onPress={handleCancel} testID="back-button">
          <Text className="text-base text-primary">← Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-text">
          {editingServer ? 'Edit Server' : 'Add Server'}
        </Text>
        <View className="w-[60px]" />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-6">
        <TextInput
          className="border border-border rounded-lg p-3 text-base mb-3 text-text bg-surface"
          placeholder="Server Name"
          placeholderTextColor={colors.textSubtle}
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          testID="server-name-input"
        />

        <TextInput
          className="border border-border rounded-lg p-3 text-base mb-3 text-text bg-surface"
          placeholder="Host (e.g., localhost or 192.168.1.100)"
          placeholderTextColor={colors.textSubtle}
          value={formData.host}
          onChangeText={(text) => setFormData({ ...formData, host: text })}
          autoCapitalize="none"
          autoCorrect={false}
          testID="server-host-input"
        />

        <TextInput
          className="border border-border rounded-lg p-3 text-base mb-3 text-text bg-surface"
          placeholder="Port"
          placeholderTextColor={colors.textSubtle}
          value={formData.port}
          onChangeText={(text) => setFormData({ ...formData, port: text })}
          keyboardType="number-pad"
          testID="server-port-input"
        />

        <View className="flex-row justify-between items-center mb-3 py-3 px-4 bg-surface rounded-lg border border-border">
          <Text className="text-base text-text">Use SSL (HTTPS)</Text>
          <Switch
            value={formData.useSSL}
            onValueChange={(value) => setFormData({ ...formData, useSSL: value })}
            testID="server-ssl-switch"
          />
        </View>

        <TextInput
          className="border border-border rounded-lg p-3 text-base mb-6 text-text bg-surface"
          placeholder="API Key (optional)"
          placeholderTextColor={colors.textSubtle}
          value={formData.apiKey}
          onChangeText={(text) => setFormData({ ...formData, apiKey: text })}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          testID="server-apikey-input"
        />

        <View className="flex-row gap-3 mt-2">
          <TouchableOpacity
            className="flex-1 py-3 rounded-lg items-center bg-border-muted"
            onPress={handleCancel}
            testID="cancel-server-button"
          >
            <Text className="text-base font-semibold text-text">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 py-3 rounded-lg items-center bg-primary"
            onPress={handleSave}
            testID="save-server-button"
          >
            <Text className="text-base font-semibold text-white">Save</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </StyledSafeAreaView>
  );
}
