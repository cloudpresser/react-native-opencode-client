import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';
import { OpenCodeService } from '../../services/opencode';
import { useThemeColors } from '../../hooks/useThemeColors';

type GitDiffViewerScreenRouteProp = RouteProp<RootStackParamList, 'GitDiffViewer'>;

import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';

const StyledSafeAreaView = withUniwind(SafeAreaView);

export default function GitDiffViewerScreen() {
  const route = useRoute<GitDiffViewerScreenRouteProp>();
  const navigation = useNavigation();
  const colors = useThemeColors();
  const { file, session, server } = route.params;

  const [diffContent, setDiffContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [service] = useState(() => new OpenCodeService(server));

  useEffect(() => {
    loadDiff();
  }, []);

  const loadDiff = async () => {
    setLoading(true);
    try {
      const diffs = await service.getGitDiff(session.id, file.path);
      const fileDiff = diffs.find(d => d.path === file.path);
      setDiffContent(fileDiff?.diff || file.diff || 'No diff available');
    } catch (error) {
      console.error('Error loading diff:', error);
      setDiffContent('Error loading diff');
    } finally {
      setLoading(false);
    }
  };

  const renderDiffLine = (line: string, index: number) => {
    let lineClass = 'text-text';
    
    if (line.startsWith('+')) {
      lineClass = 'bg-success/20 text-success';
    } else if (line.startsWith('-')) {
      lineClass = 'bg-danger/20 text-danger';
    } else if (line.startsWith('@@')) {
      lineClass = 'bg-info/20 text-info font-bold';
    } else if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
      lineClass = 'text-text-subtle';
    }

    return (
      <Text key={index} className={['font-mono text-xs leading-[18px] px-2 py-0.5', lineClass].join(' ')}>
        {line}
      </Text>
    );
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-surface-elevated" testID="git-diff-viewer-screen">
      <View className="flex-row justify-between items-center p-4 bg-surface border-b border-border">
        <TouchableOpacity onPress={() => navigation.goBack()} testID="back-button">
          <Text className="text-base text-primary min-w-[60]">← Back</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-sm font-semibold text-text text-center font-mono" numberOfLines={1}>
          {file.path}
        </Text>
        <View className="min-w-[60]" />
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4"
          horizontal
        >
          <ScrollView>
            <View className="bg-surface-elevated">
              {diffContent.split('\n').map((line, index) => renderDiffLine(line, index))}
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </StyledSafeAreaView>
  );
}
