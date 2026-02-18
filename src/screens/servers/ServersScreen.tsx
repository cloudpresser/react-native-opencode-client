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
import { ServerStatusBadge } from '../../components/ServerStatusBadge';
import { useServerStatusContext } from '../../context/ServerStatusContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Servers'>;

export default function ServersScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { servers, deleteServer, selectServer, loadServers } = useStore();
  const { getStatus } = useServerStatusContext();

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

  const renderServer = ({ item }: { item: Server }): React.ReactElement => {
    const status = getStatus(item.id);
    
    return (
      <TouchableOpacity
        className="bg-surface rounded-xl p-4 mb-3 shadow-sm border border-border"
        onPress={() => handleSelectServer(item)}
        testID={`server-item-${item.id}`}
        accessible={false}
      >
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1 mr-4">
            <Text className="text-lg font-semibold text-text mb-1" numberOfLines={1}>{item.name}</Text>
            <Text className="text-sm text-text-muted mb-2" numberOfLines={1}>
              {item.useSSL ? 'https' : 'http'}://{item.host}:{item.port}
            </Text>
            <ServerStatusBadge status={status} serverName={item.name} />
          </View>
          
          <View className="flex-row gap-2">
            <TouchableOpacity
              className="px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20"
              onPress={() => handleEdit(item)}
              testID={`edit-server-btn-${item.name}`}
            >
              <Text className="text-primary font-medium text-sm">Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="px-3 py-1.5 rounded-md bg-danger/10 border border-danger/20"
              onPress={() => handleDelete(item)}
              testID={`delete-server-btn-${item.name}`}
            >
              <Text className="text-danger font-medium text-sm">Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
