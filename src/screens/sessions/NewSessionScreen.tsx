import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { useStore } from '../../store';
import { Session } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { OpenCodeService } from '../../services/opencode';
import { useThemeColors } from '../../hooks/useThemeColors';

const StyledSafeAreaView = withUniwind(SafeAreaView);

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'NewSession'>;
type NewSessionRouteProp = RouteProp<RootStackParamList, 'NewSession'>;

export default function NewSessionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<NewSessionRouteProp>();
  const colors = useThemeColors();
  const { server } = route.params;
  
  const { addSession } = useStore();
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [service] = useState(() => new OpenCodeService(server));

  const handleCreateSession = async () => {
    if (!newSessionTitle.trim()) {
      Alert.alert('Error', 'Please enter a session title');
      return;
    }

    setLoading(true);
    try {
      const remoteSession = await service.createSession(newSessionTitle);
      
      if (remoteSession) {
        const session: Session = {
          id: remoteSession.id,
          serverId: server.id,
          title: newSessionTitle,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        await addSession(session);
        navigation.goBack();
      } else {
        Alert.alert('Error', 'Failed to create session on server');
      }
    } catch (error) {
      console.error('Error creating session:', error);
      Alert.alert('Error', 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-background" testID="new-session-screen">
      <View className="flex-row justify-between items-center p-4 bg-surface border-b border-border">
        <TouchableOpacity onPress={handleCancel} testID="back-button">
          <Text className="text-base text-primary">← Back</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-text">New Session</Text>
        <View className="w-[60px]" />
      </View>

      <View className="p-6">
        <TextInput
          className="border border-border rounded-lg p-3 text-base mb-3 text-text bg-surface"
          placeholder="Session Title"
          placeholderTextColor={colors.textSubtle}
          value={newSessionTitle}
          onChangeText={setNewSessionTitle}
          autoFocus
          testID="session-title-input"
        />

        <View className="flex-row gap-3 mt-2">
          <TouchableOpacity
            className="flex-1 py-3 rounded-lg items-center bg-surface border border-border"
            onPress={handleCancel}
            testID="cancel-session-button"
          >
            <Text className="text-base font-semibold text-text">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 py-3 rounded-lg items-center bg-primary"
            onPress={handleCreateSession}
            disabled={loading}
            testID="create-session-button"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-base font-semibold text-white">Create</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </StyledSafeAreaView>
  );
}
