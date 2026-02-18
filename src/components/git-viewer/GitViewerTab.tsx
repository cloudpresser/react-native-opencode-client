import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigation/types';
import { useStore } from '../../store';
import { GitFile, Server, Session } from '../../types';
import { OpenCodeService } from '../../services/opencode';
import { useThemeColors } from '../../hooks/useThemeColors';

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface GitViewerTabProps {
  session: Session;
  server: Server;
}

export default function GitViewerTab({ session, server }: GitViewerTabProps) {
  const navigation = useNavigation<NavigationProp>();
  const colors = useThemeColors();
  const { gitFiles, setGitFiles } = useStore();
  const [loading, setLoading] = useState(false);
  const [service] = useState(() => new OpenCodeService(server));

  const sessionGitFiles = gitFiles[session.id] || [];

  useEffect(() => {
    loadGitStatus();
  }, []);

  const loadGitStatus = async () => {
    setLoading(true);
    try {
      const files = await service.getGitStatus(session.id);
      setGitFiles(session.id, files);
    } catch (error) {
      console.error('Error loading git status:', error);
      Alert.alert('Error', 'Failed to load git status');
    } finally {
      setLoading(false);
    }
  };

  const handleFilePress = (file: GitFile) => {
    navigation.navigate('GitDiffViewer', { file, session, server });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'modified':
        return 'bg-warning';
      case 'added':
        return 'bg-success';
      case 'deleted':
        return 'bg-danger';
      case 'renamed':
        return 'bg-primary';
      default:
        return 'bg-text-muted';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'modified':
        return 'M';
      case 'added':
        return 'A';
      case 'deleted':
        return 'D';
      case 'renamed':
        return 'R';
      default:
        return '?';
    }
  };

  const renderFile = ({ item }: { item: GitFile }): React.ReactElement => (
    <TouchableOpacity className="bg-surface rounded-xl p-4 mb-3 shadow-sm" onPress={() => handleFilePress(item)}>
      <View className="flex-row items-center mb-2">
        <View className={['w-6 h-6 rounded-full justify-center items-center mr-3', getStatusColor(item.status)].join(' ')}>
          <Text className="text-white font-bold text-xs">{getStatusIcon(item.status)}</Text>
        </View>
        <Text className="flex-1 text-sm text-text font-mono" numberOfLines={2}>
          {item.path}
        </Text>
      </View>
      <View className="flex-row gap-3">
        <Text className="text-success font-semibold font-mono">+{item.additions}</Text>
        <Text className="text-danger font-semibold font-mono">-{item.deletions}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row justify-between items-center p-4 bg-surface border-b border-border">
        <Text className="text-xl font-bold text-text">Modified Files</Text>
        <TouchableOpacity className="bg-primary/10 border border-primary/20 px-4 py-2 rounded-lg" onPress={loadGitStatus} testID="refresh-git-btn">
          <Text className="text-primary font-semibold">Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={sessionGitFiles}
          renderItem={renderFile}
          keyExtractor={(item: GitFile) => item.path}
          contentContainerClassName="p-4"
          ListEmptyComponent={
            <View className="items-center justify-center pt-16">
              <Text className="text-lg font-semibold text-text-muted mb-2">No modified files</Text>
              <Text className="text-sm text-text-subtle">Make some changes to see them here</Text>
            </View>
          }
        />
      )}
    </View>
  );
}