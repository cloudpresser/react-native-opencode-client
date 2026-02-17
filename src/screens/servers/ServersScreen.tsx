import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Switch,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStore } from '../../store';
import { Server } from '../../types';
import { RootStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Servers'>;

export default function ServersScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { servers, addServer, updateServer, deleteServer, selectServer, loadServers } = useStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '3000',
    useSSL: false,
    apiKey: '',
  });

  useEffect(() => {
    loadServers();
  }, []);

  const handleSave = async () => {
    if (!formData.name || !formData.host || !formData.port) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const server: Server = {
      id: editingServer?.id || Date.now().toString(),
      name: formData.name,
      host: formData.host,
      port: parseInt(formData.port),
      useSSL: formData.useSSL,
      apiKey: formData.apiKey || undefined,
    };

    if (editingServer) {
      await updateServer(server.id, server);
    } else {
      await addServer(server);
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      host: '',
      port: '3000',
      useSSL: false,
      apiKey: '',
    });
    setEditingServer(null);
    setModalVisible(false);
  };

  const handleEdit = (server: Server) => {
    setEditingServer(server);
    setFormData({
      name: server.name,
      host: server.host,
      port: server.port.toString(),
      useSSL: server.useSSL,
      apiKey: server.apiKey || '',
    });
    setModalVisible(true);
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

  const renderServer = ({ item }: { item: Server }) => (
    <TouchableOpacity 
      style={styles.serverCard} 
      onPress={() => handleSelectServer(item)}
      testID={`server-item-${item.id}`}
    >
      <View style={styles.serverInfo}>
        <Text style={styles.serverName}>{item.name}</Text>
        <Text style={styles.serverDetails}>
          {item.useSSL ? 'https' : 'http'}://{item.host}:{item.port}
        </Text>
      </View>
      <View style={styles.serverActions}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => handleEdit(item)}
          testID={`edit-server-${item.id}`}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteButton]} 
          onPress={() => handleDelete(item)}
          testID={`delete-server-${item.id}`}
        >
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container} testID="servers-screen">
      <View style={styles.header}>
        <Text style={styles.title}>OpenCode Servers</Text>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => setModalVisible(true)} 
          testID="add-server-button"
        >
          <Text style={styles.addButtonText}>+ Add Server</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={servers}
        renderItem={renderServer}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        testID="servers-list"
        ListEmptyComponent={
          <View style={styles.emptyContainer} testID="empty-servers">
            <Text style={styles.emptyText}>No servers configured</Text>
            <Text style={styles.emptySubtext}>Tap "Add Server" to get started</Text>
          </View>
        }
      />

      <Modal 
        visible={modalVisible} 
        animationType="slide" 
        transparent
        testID="server-modal"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingServer ? 'Edit Server' : 'Add Server'}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Server Name"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              testID="server-name-input"
            />

            <TextInput
              style={styles.input}
              placeholder="Host (e.g., localhost or 192.168.1.100)"
              value={formData.host}
              onChangeText={(text) => setFormData({ ...formData, host: text })}
              autoCapitalize="none"
              autoCorrect={false}
              testID="server-host-input"
            />

            <TextInput
              style={styles.input}
              placeholder="Port"
              value={formData.port}
              onChangeText={(text) => setFormData({ ...formData, port: text })}
              keyboardType="number-pad"
              testID="server-port-input"
            />

            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Use SSL (HTTPS)</Text>
              <Switch
                value={formData.useSSL}
                onValueChange={(value) => setFormData({ ...formData, useSSL: value })}
                testID="server-ssl-switch"
              />
            </View>

            <TextInput
              style={styles.input}
              placeholder="API Key (optional)"
              value={formData.apiKey}
              onChangeText={(text) => setFormData({ ...formData, apiKey: text })}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              testID="server-apikey-input"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton} 
                onPress={resetForm}
                testID="cancel-server-button"
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSave}
                testID="save-server-button"
              >
                <Text style={[styles.modalButtonText, styles.saveButtonText]}>Save</Text>
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
  title: {
    fontSize: 24,
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
  listContent: {
    padding: 16,
  },
  serverCard: {
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
  serverInfo: {
    marginBottom: 12,
  },
  serverName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  serverDetails: {
    fontSize: 14,
    color: '#666',
  },
  serverActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  deleteButtonText: {
    color: '#fff',
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
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
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
  saveButton: {
    backgroundColor: '#007AFF',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  saveButtonText: {
    color: '#fff',
  },
});