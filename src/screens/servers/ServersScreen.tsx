import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { useStore } from '../../store';

const StyledSafeAreaView = withUniwind(SafeAreaView);
import { Server } from '../../types';
import { RootStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Servers'>;

export default function ServersScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { servers, deleteServer, selectServer, loadServers } = useStore();

  useEffect(() => {
    loadServers();
  }, []);

  const handleEdit = (server: Server) => {
    navigation.navigate('AddEditServer', { server });
  };

  const handleDelete = (server: Server) => {
    Alert.alert('Delete Server', `Are you sure you want to delete ${server.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteServer(server.id),
      },
    ]);
  };

  const handleSelectServer = (server: Server) => {
    selectServer(server);
    navigation.navigate('Sessions', { server });
  };

  const renderServer = ({ item }: { item: Server }): React.ReactElement => (
    <TouchableOpacity
      className="bg-surface rounded-xl p-4 mb-3 shadow-sm"
      onPress={() => handleSelectServer(item)}
      testID={`server-item-${item.id}`}
      accessible={false}
    >
      <View className="mb-3">
        <Text className="text-lg font-semibold text-text mb-1">{item.name}</Text>
        <Text className="text-sm text-text-muted">
          {item.useSSL ? 'https' : 'http'}://{item.host}:{item.port}
        </Text>
      </View>
      <View className="flex-row gap-2">
        <TouchableOpacity
          className="px-4 py-2 rounded-md bg-primary"
          onPress={() => handleEdit(item)}
          testID={`edit-server-btn-${item.name}`}
        >
          <Text className="text-white font-semibold">Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="px-4 py-2 rounded-md bg-danger"
          onPress={() => handleDelete(item)}
          testID={`delete-server-btn-${item.name}`}
        >
          <Text className="text-white font-semibold">Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <StyledSafeAreaView className="flex-1 bg-background" testID="servers-screen">
      <View className="flex-row justify-between items-center p-4 bg-surface border-b border-border">
        <Text className="text-2xl font-bold text-text">OpenCode Servers</Text>
        <TouchableOpacity
          className="bg-primary px-4 py-2 rounded-lg"
          onPress={() => navigation.navigate('AddEditServer', {})}
          testID="add-server-button"
        >
          <Text className="text-white font-semibold">+ Add Server</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={servers}
        renderItem={renderServer}
        keyExtractor={(item: Server) => item.id}
        contentContainerClassName="p-4"
        testID="servers-list"
        ListEmptyComponent={
          <View className="items-center justify-center pt-16" testID="empty-servers">
            <Text className="text-lg font-semibold text-text-muted mb-2">No servers configured</Text>
            <Text className="text-sm text-text-subtle">Tap "Add Server" to get started</Text>
          </View>
        }
      />
    </StyledSafeAreaView>
  );
}
