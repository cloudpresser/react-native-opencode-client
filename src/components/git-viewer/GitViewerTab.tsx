import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { useStore } from '../../store';
import { GitFile, Server, Session } from '../../types';
import { OpenCodeService } from '../../services/opencode';

interface GitViewerTabProps {
  session: Session;
  server: Server;
}

export default function GitViewerTab({ session, server }: GitViewerTabProps) {
  const { gitFiles, setGitFiles } = useStore();
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<GitFile | null>(null);
  const [diffContent, setDiffContent] = useState<string>('');
  const [loadingDiff, setLoadingDiff] = useState(false);
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

  const handleFilePress = async (file: GitFile) => {
    setSelectedFile(file);
    setLoadingDiff(true);
    
    try {
      const diffs = await service.getGitDiff(session.id, file.path);
      const fileDiff = diffs.find(d => d.path === file.path);
      setDiffContent(fileDiff?.diff || file.diff || 'No diff available');
    } catch (error) {
      console.error('Error loading diff:', error);
      setDiffContent('Error loading diff');
    } finally {
      setLoadingDiff(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'modified':
        return '#FF9500';
      case 'added':
        return '#34C759';
      case 'deleted':
        return '#FF3B30';
      case 'renamed':
        return '#007AFF';
      default:
        return '#666';
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

  const renderFile = ({ item }: { item: GitFile }) => (
    <TouchableOpacity style={styles.fileCard} onPress={() => handleFilePress(item)}>
      <View style={styles.fileHeader}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusIcon(item.status)}</Text>
        </View>
        <Text style={styles.filePath} numberOfLines={2}>
          {item.path}
        </Text>
      </View>
      <View style={styles.fileStats}>
        <Text style={styles.additions}>+{item.additions}</Text>
        <Text style={styles.deletions}>-{item.deletions}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderDiffLine = (line: string, index: number) => {
    let lineStyle = styles.diffLineNormal;
    
    if (line.startsWith('+')) {
      lineStyle = styles.diffLineAdded;
    } else if (line.startsWith('-')) {
      lineStyle = styles.diffLineDeleted;
    } else if (line.startsWith('@@')) {
      lineStyle = styles.diffLineHeader;
    } else if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
      lineStyle = styles.diffLineMeta;
    }

    return (
      <Text key={index} style={[styles.diffLine, lineStyle]}>
        {line}
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Modified Files</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadGitStatus}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={sessionGitFiles}
          renderItem={renderFile}
          keyExtractor={(item) => item.path}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No modified files</Text>
              <Text style={styles.emptySubtext}>Make some changes to see them here</Text>
            </View>
          }
        />
      )}

      <Modal visible={selectedFile !== null} animationType="slide" transparent={false}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedFile(null)}>
              <Text style={styles.closeButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {selectedFile?.path}
            </Text>
            <View style={styles.placeholder} />
          </View>

          {loadingDiff ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : (
            <ScrollView
              style={styles.diffContainer}
              contentContainerStyle={styles.diffContent}
              horizontal
            >
              <ScrollView>
                <View style={styles.diffTextContainer}>
                  {diffContent.split('\n').map((line, index) => renderDiffLine(line, index))}
                </View>
              </ScrollView>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  fileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  filePath: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontFamily: 'monospace',
  },
  fileStats: {
    flexDirection: 'row',
    gap: 12,
  },
  additions: {
    color: '#34C759',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  deletions: {
    color: '#FF3B30',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2d2d2d',
    borderBottomWidth: 1,
    borderBottomColor: '#3d3d3d',
  },
  closeButton: {
    fontSize: 16,
    color: '#007AFF',
    minWidth: 60,
  },
  modalTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  placeholder: {
    minWidth: 60,
  },
  diffContainer: {
    flex: 1,
  },
  diffContent: {
    padding: 16,
  },
  diffTextContainer: {
    backgroundColor: '#1e1e1e',
  },
  diffLine: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  diffLineNormal: {
    color: '#d4d4d4',
  },
  diffLineAdded: {
    backgroundColor: '#1a3a1a',
    color: '#4ec9b0',
  },
  diffLineDeleted: {
    backgroundColor: '#3a1a1a',
    color: '#f48771',
  },
  diffLineHeader: {
    backgroundColor: '#2d4a5a',
    color: '#569cd6',
    fontWeight: 'bold',
  },
  diffLineMeta: {
    color: '#858585',
  },
});
