import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { withUniwind } from 'uniwind';
import { useStore } from '../../store';
import { FileNode } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { OpenCodeService } from '../../services/opencode';
import { useThemeColors } from '../../hooks/useThemeColors';

const StyledSafeAreaView = withUniwind(SafeAreaView);

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SelectDirectory'>;
type SelectDirectoryRouteProp = RouteProp<RootStackParamList, 'SelectDirectory'>;

export default function SelectDirectoryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SelectDirectoryRouteProp>();
  const colors = useThemeColors();
  const { server } = route.params;

  const { openProject } = useStore();
  const [service] = useState(() => new OpenCodeService(server));

  const [currentDirectory, setCurrentDirectory] = useState<string>('');
  const [homeDirectory, setHomeDirectory] = useState<string>('');
  const [entries, setEntries] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [pathInput, setPathInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<FileNode[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Load initial path (home directory)
  useEffect(() => {
    (async () => {
      try {
        const pathInfo = await service.getPath();
        if (pathInfo) {
          const startDir = pathInfo.home || pathInfo.directory || '/';
          setHomeDirectory(pathInfo.home || '/');
          setCurrentDirectory(startDir);
          setPathInput(startDir);
          await loadEntries(startDir);
        }
      } catch (error) {
        console.error('Error loading initial path:', error);
        Alert.alert('Error', 'Failed to connect to server');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Resolve a target directory into the API's { directory, path } params.
  // The OpenCode file.list API uses `directory` as a filesystem root
  // and `path` as a relative path within it (matching the web client pattern).
  const scopeDirectory = (target: string): { directory: string; path: string } => {
    const trimmed = target.replace(/\/+$/, '') || '/';
    if (trimmed === '/') {
      return { directory: '/', path: '' };
    }
    // Use root '/' as the base and the rest as relative path
    return { directory: '/', path: trimmed.slice(1) };
  };

  const loadEntries = async (directory: string) => {
    setLoading(true);
    setSearchResults(null);
    setSearchQuery('');
    try {
      const { directory: dir, path } = scopeDirectory(directory);
      const files = await service.listFiles(dir, path);
      // Only show directories, sorted alphabetically, hide hidden dirs
      const dirs = files
        .filter(f => f.type === 'directory' && !f.name.startsWith('.'))
        .sort((a, b) => a.name.localeCompare(b.name));
      setEntries(dirs);
    } catch (error) {
      console.error('Error listing files:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const navigateToDirectory = useCallback(async (directory: string) => {
    const normalized = directory.replace(/\/+$/, '') || '/';
    setCurrentDirectory(normalized);
    setPathInput(normalized);
    await loadEntries(normalized);
  }, []);

  const navigateUp = useCallback(async () => {
    const parent = currentDirectory.replace(/\/[^/]+$/, '') || '/';
    await navigateToDirectory(parent);
  }, [currentDirectory]);

  const handlePathSubmit = useCallback(async () => {
    let path = pathInput.trim();
    if (!path) return;
    // Expand tilde
    if (path.startsWith('~')) {
      path = homeDirectory + path.slice(1);
    }
    await navigateToDirectory(path);
  }, [pathInput, homeDirectory]);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      // Use '/' as directory root for broadest search, matching the web client
      const results = await service.findDirectories('/', query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSelectDirectory = useCallback(async (directory: string) => {
    const normalized = directory.replace(/\/+$/, '') || '/';
    // Add to local project list and navigate back
    await openProject({
      serverId: server.id,
      worktree: normalized,
    });
    navigation.goBack();
  }, [server.id]);

  const displayEntries = searchResults ?? entries;

  const renderEntry = ({ item }: { item: FileNode }): React.ReactElement => (
    <TouchableOpacity
      className="bg-surface rounded-lg p-3 mb-2 flex-row items-center"
      onPress={() => navigateToDirectory(item.absolute)}
      testID={`dir-entry-${item.name}`}
    >
      <View className="w-8 h-8 rounded bg-info/15 items-center justify-center mr-3">
        <Text className="text-info text-sm font-bold">/</Text>
      </View>
      <Text className="text-base text-text flex-1" numberOfLines={1}>
        {searchResults ? item.absolute : item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <StyledSafeAreaView className="flex-1 bg-background" testID="select-directory-screen">
      {/* Header */}
      <View className="flex-row justify-between items-center p-4 bg-surface border-b border-border">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          testID="back-button"
        >
          <Text className="text-base text-primary">Cancel</Text>
        </TouchableOpacity>
        <Text className="text-lg font-bold text-text">Open Folder</Text>
        <TouchableOpacity
          className="bg-primary px-4 py-2 rounded-lg"
          onPress={() => handleSelectDirectory(currentDirectory)}
          testID="select-btn"
        >
          <Text className="text-white font-semibold">Select</Text>
        </TouchableOpacity>
      </View>

      {/* Path input */}
      <View className="px-4 pt-3 pb-1">
        <View className="flex-row items-center bg-surface rounded-lg border border-border">
          <TextInput
            className="flex-1 px-3 py-2.5 text-base text-text"
            value={pathInput}
            onChangeText={setPathInput}
            onSubmitEditing={handlePathSubmit}
            placeholder="Enter path..."
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            testID="path-input"
          />
          {currentDirectory !== '/' && (
            <TouchableOpacity
              className="px-3 py-2.5"
              onPress={navigateUp}
              testID="navigate-up-btn"
            >
              <Text className="text-primary font-semibold">↑ Up</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search input */}
      <View className="px-4 pt-2 pb-1">
        <TextInput
          className="bg-surface rounded-lg border border-border px-3 py-2.5 text-base text-text"
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder="Search directories..."
          placeholderTextColor={colors.textSubtle}
          autoCapitalize="none"
          autoCorrect={false}
          testID="search-input"
        />
      </View>

      {/* Current path breadcrumb */}
      <View className="px-4 py-2">
        <Text className="text-xs text-text-muted" numberOfLines={1}>
          {currentDirectory}
        </Text>
      </View>

      {/* Directory listing */}
      {loading || searching ? (
        <View className="flex-1 justify-center items-center" testID="loading-indicator">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={displayEntries}
          renderItem={renderEntry}
          keyExtractor={(item: FileNode) => item.absolute}
          contentContainerClassName="px-4 pb-4"
          testID="directory-list"
          ListEmptyComponent={
            <View className="items-center justify-center pt-16" testID="empty-directory">
              <Text className="text-lg font-semibold text-text-muted mb-2">
                {searchResults ? 'No matching directories' : 'Empty directory'}
              </Text>
              <Text className="text-sm text-text-subtle">
                {searchResults
                  ? 'Try a different search term'
                  : 'Select this directory or navigate elsewhere'}
              </Text>
            </View>
          }
        />
      )}
    </StyledSafeAreaView>
  );
}
