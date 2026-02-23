import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { useStore } from '../../store';

const StyledSafeAreaView = withUniwind(SafeAreaView);
import { Session, Project } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { OpenCodeService } from '../../services/opencode';
import { useThemeColors } from '../../hooks/useThemeColors';

function getDirectoryBasename(worktree: string): string {
  const parts = worktree.replace(/\/+$/, '').split('/');
  return parts[parts.length - 1] || worktree;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Sessions'>;
type SessionsRouteProp = RouteProp<RootStackParamList, 'Sessions'>;

export default function SessionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SessionsRouteProp>();
  const colors = useThemeColors();
  const { server, project } = route.params;
  
  const { sessions, addSession, deleteSession, selectSession, loadSessions } = useStore();
  const [loading, setLoading] = useState(false);
  const [showSubAgents, setShowSubAgents] = useState(false);
  const [service] = useState(() => new OpenCodeService(server));

  const headerTitle = project
    ? getDirectoryBasename(project.worktree)
    : 'All Sessions';

  useEffect(() => {
    loadSessionsFromServer();
  }, []);

  const loadSessionsFromServer = async () => {
    setLoading(true);
    try {
      const remoteSessions = await service.getSessions(project?.worktree);
      
      await loadSessions(server.id);
      
      // Get current sessions from store to avoid stale closure
      const currentSessions = useStore.getState().sessions;
      
      for (const remoteSession of remoteSessions) {
        const exists = currentSessions.find(s => s.id === remoteSession.id);
        if (!exists) {
          await addSession({ ...remoteSession, serverId: server.id });
        }
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      Alert.alert('Error', 'Failed to load sessions from server');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (session: Session) => {
    Alert.alert('Delete Session', `Are you sure you want to delete "${session.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const success = await service.deleteSession(session.id);
          if (success) {
            await deleteSession(session.id);
          } else {
            Alert.alert('Error', 'Failed to delete session from server');
          }
        },
      },
    ]);
  };

  const handleSelectSession = (session: Session) => {
    selectSession(session);
    navigation.navigate('SessionDetail', { session, server });
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const renderSession = ({ item }: { item: Session }): React.ReactElement => (
    <TouchableOpacity 
      className="bg-surface rounded-xl p-4 mb-3 shadow-sm flex-row justify-between items-center"
      onPress={() => handleSelectSession(item)}
      testID={`session-item-${item.id}`}
      accessible={false}
    >
      <View className="flex-1">
        <Text className="text-lg font-semibold text-text mb-1">{item.title}</Text>
        <Text className="text-xs text-text-muted mt-1">Created: {formatDate(item.createdAt)}</Text>
        {item.updatedAt && item.updatedAt !== item.createdAt && (
          <Text className="text-xs text-text-muted mt-1">Updated: {formatDate(item.updatedAt)}</Text>
        )}
      </View>
      <TouchableOpacity
        className="bg-danger/10 border border-danger/20 px-4 py-2 rounded-md"
        onPress={() => handleDeleteSession(item)}
        testID="session-delete-btn"
      >
        <Text className="text-danger font-semibold">Delete</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <StyledSafeAreaView className="flex-1 bg-background" testID="sessions-screen">
      <View className="flex-row justify-between items-center p-4 bg-surface border-b border-border">
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          testID="back-button"
        >
          <Text className="text-base text-primary">← Back</Text>
        </TouchableOpacity>
        <View className="flex-1 items-center mx-3">
          <Text className="text-xl font-bold text-text" numberOfLines={1}>{headerTitle}</Text>
          <Text className="text-xs text-text-muted" numberOfLines={1}>{server.name}</Text>
        </View>
        <TouchableOpacity 
          className="bg-primary px-4 py-2 rounded-lg"
          onPress={() => navigation.navigate('NewSession', { server, project })}
          testID="create-session-btn"
        >
          <Text className="text-white font-semibold">New</Text>
        </TouchableOpacity>
      </View>

      {/* Sub-agent toggle */}
      <View className="flex-row items-center justify-between px-4 py-2 bg-surface border-b border-border">
        <Text className="text-sm text-text-muted">Show sub-agent sessions</Text>
        <TouchableOpacity
          className={`px-3 py-1 rounded-full ${showSubAgents ? 'bg-primary' : 'bg-border'}`}
          onPress={() => setShowSubAgents(!showSubAgents)}
          testID="toggle-subagents-btn"
        >
          <Text className={`text-xs font-semibold ${showSubAgents ? 'text-white' : 'text-text-muted'}`}>
            {showSubAgents ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center" testID="loading-indicator">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={[...new Map(sessions.map(s => [s.id, s])).values()]
            .filter(s => showSubAgents || !s.parentId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
          renderItem={renderSession}
          keyExtractor={(item: Session) => item.id}
          contentContainerClassName="p-4"
          testID="sessions-list"
          ListEmptyComponent={
            <View className="items-center justify-center pt-16" testID="empty-sessions">
              <Text className="text-lg font-semibold text-text-muted mb-2">No sessions</Text>
              <Text className="text-sm text-text-subtle">Create a new session to get started</Text>
            </View>
          }
        />
      )}
    </StyledSafeAreaView>
  );
}