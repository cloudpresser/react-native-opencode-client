import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { useStore } from '../../store';
import { Project } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { OpenCodeService } from '../../services/opencode';
import { useThemeColors } from '../../hooks/useThemeColors';

const StyledSafeAreaView = withUniwind(SafeAreaView);

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Projects'>;
type ProjectsRouteProp = RouteProp<RootStackParamList, 'Projects'>;

// Pseudo-project sentinel for "All Sessions"
const ALL_SESSIONS_ITEM = { __allSessions: true } as const;
type ListItem = Project | typeof ALL_SESSIONS_ITEM;

function isAllSessions(item: ListItem): item is typeof ALL_SESSIONS_ITEM {
  return '__allSessions' in item;
}

function getDirectoryBasename(worktree: string): string {
  const parts = worktree.replace(/\/+$/, '').split('/');
  return parts[parts.length - 1] || worktree;
}

export default function ProjectsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ProjectsRouteProp>();
  const colors = useThemeColors();
  const { server } = route.params;

  const { projects, loadProjects, openProject, closeProject, enrichProjects } = useStore();
  const [loading, setLoading] = useState(false);
  const [service] = useState(() => new OpenCodeService(server));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load locally-tracked projects
      await loadProjects(server.id);

      // Fetch API projects and enrich + auto-open
      const apiProjects = await service.getProjects();
      const apiWithServerId = apiProjects.map(p => ({ ...p, serverId: server.id }));

      // Auto-open any API projects not already in the local list
      const currentProjects = useStore.getState().projects;
      for (const ap of apiWithServerId) {
        const exists = currentProjects.find(p => p.worktree === ap.worktree && p.serverId === server.id);
        if (!exists) {
          await openProject(ap);
        }
      }

      // Enrich local projects with API metadata (id, vcs, timestamps)
      await enrichProjects(server.id, apiWithServerId);
    } catch (error) {
      console.error('Error loading projects:', error);
      Alert.alert('Error', 'Failed to load projects from server');
    } finally {
      setLoading(false);
    }
  }, [server.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh when navigating back from SelectDirectory
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const serverProjects = projects.filter(p => p.serverId === server.id);

  const handleSelectProject = (project: Project) => {
    navigation.navigate('Sessions', { server, project });
  };

  const handleAllSessions = () => {
    navigation.navigate('Sessions', { server });
  };

  const handleCloseProject = (project: Project) => {
    Alert.alert(
      'Close Project',
      `Remove "${getDirectoryBasename(project.worktree)}" from your project list? This does not delete any data on the server.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: async () => {
            await closeProject(server.id, project.worktree);
          },
        },
      ]
    );
  };

  const listData: ListItem[] = [ALL_SESSIONS_ITEM, ...serverProjects];

  const renderItem = ({ item }: { item: ListItem }): React.ReactElement => {
    if (isAllSessions(item)) {
      return (
        <TouchableOpacity
          className="bg-surface rounded-xl p-4 mb-3 shadow-sm flex-row items-center"
          onPress={handleAllSessions}
          testID="all-sessions-item"
        >
          <View className="w-10 h-10 rounded-lg bg-primary/15 items-center justify-center mr-3">
            <Text className="text-primary text-lg font-bold">*</Text>
          </View>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-text">All Sessions</Text>
            <Text className="text-xs text-text-muted mt-1">Browse sessions across all projects</Text>
          </View>
        </TouchableOpacity>
      );
    }

    const basename = getDirectoryBasename(item.worktree);

    return (
      <TouchableOpacity
        className="bg-surface rounded-xl p-4 mb-3 shadow-sm flex-row items-center"
        onPress={() => handleSelectProject(item)}
        onLongPress={() => handleCloseProject(item)}
        testID={`project-item-${item.worktree}`}
      >
        <View className="w-10 h-10 rounded-lg bg-info/15 items-center justify-center mr-3">
          <Text className="text-info text-lg font-bold">
            {basename.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="text-lg font-semibold text-text flex-shrink">{basename}</Text>
            {item.vcs === 'git' && (
              <View className="bg-success/15 px-2 py-0.5 rounded ml-2">
                <Text className="text-success text-xs font-medium">git</Text>
              </View>
            )}
          </View>
          <Text className="text-xs text-text-muted mt-1" numberOfLines={1}>
            {item.worktree}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-background" testID="projects-screen">
      <View className="flex-row justify-between items-center p-4 bg-surface border-b border-border">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          testID="back-button"
        >
          <Text className="text-base text-primary">← Back</Text>
        </TouchableOpacity>
        <View className="items-center">
          <Text className="text-xl font-bold text-text">{server.name}</Text>
          <Text className="text-xs text-text-muted">Projects</Text>
        </View>
        <TouchableOpacity
          className="bg-primary px-4 py-2 rounded-lg"
          onPress={() => navigation.navigate('SelectDirectory', { server })}
          testID="open-folder-btn"
        >
          <Text className="text-white font-semibold">+ Open</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center" testID="loading-indicator">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={listData}
          renderItem={renderItem}
          keyExtractor={(item: ListItem) =>
            isAllSessions(item) ? '__all_sessions__' : item.worktree
          }
          contentContainerClassName="p-4"
          testID="projects-list"
          ListEmptyComponent={
            <View className="items-center justify-center pt-16" testID="empty-projects">
              <Text className="text-lg font-semibold text-text-muted mb-2">No projects</Text>
              <Text className="text-sm text-text-subtle">Open a folder to get started</Text>
            </View>
          }
        />
      )}
    </StyledSafeAreaView>
  );
}
