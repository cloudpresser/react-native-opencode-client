import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStore } from '../../store';
import { Session } from '../../types';
import { RootStackParamList } from '../../navigation/types';
import { OpenCodeService } from '../../services/opencode';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Sessions'>;
type SessionsRouteProp = RouteProp<RootStackParamList, 'Sessions'>;

export default function SessionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SessionsRouteProp>();
  const { server } = route.params;
  
  const { sessions, addSession, deleteSession, selectSession, loadSessions } = useStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [service] = useState(() => new OpenCodeService(server));

  useEffect(() => {
    loadSessionsFromServer();
  }, []);

  const loadSessionsFromServer = async () => {
    setLoading(true);
    try {
      const remoteSessions = await service.getSessions();
      
      await loadSessions(server.id);
      
      for (const remoteSession of remoteSessions) {
        const exists = sessions.find(s => s.id === remoteSession.id);
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
        setNewSessionTitle('');
        setModalVisible(false);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const renderSession = ({ item }: { item: Session }) => (
    <TouchableOpacity 
      style={styles.sessionCard} 
      onPress={() => handleSelectSession(item)}
      testID={`session-item-${item.id}`}
    >
      <View style={styles.sessionInfo}>
        <Text style={styles.sessionTitle}>{item.title}</Text>
        <Text style={styles.sessionDate}>Created: {formatDate(item.createdAt)}</Text>
        {item.updatedAt !== item.createdAt && (
          <Text style={styles.sessionDate}>Updated: {formatDate(item.updatedAt)}</Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteSession(item)}
        testID={`delete-session-${item.id}`}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container} testID="sessions-screen">
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          testID="back-button"
        >
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{server.name}</Text>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => setModalVisible(true)}
          testID="add-session-button"
        >
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer} testID="loading-indicator">
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderSession}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          testID="sessions-list"
          ListEmptyComponent={
            <View style={styles.emptyContainer} testID="empty-sessions">
              <Text style={styles.emptyText}>No sessions</Text>
              <Text style={styles.emptySubtext}>Create a new session to get started</Text>
            </View>
          }
        />
      )}

      <Modal 
        visible={modalVisible} 
        animationType="slide" 
        transparent
        testID="session-modal"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Session</Text>

            <TextInput
              style={styles.input}
              placeholder="Session Title"
              value={newSessionTitle}
              onChangeText={setNewSessionTitle}
              autoFocus
              testID="session-title-input"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setNewSessionTitle('');
                  setModalVisible(false);
                }}
                testID="cancel-session-button"
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.createButton]}
                onPress={handleCreateSession}
                disabled={loading}
                testID="create-session-button"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalButtonText, styles.createButtonText]}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
  backButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
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
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sessionDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  createButton: {
    backgroundColor: '#007AFF',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  createButtonText: {
    color: '#fff',
  },
});