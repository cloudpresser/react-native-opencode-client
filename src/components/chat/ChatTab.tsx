import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useStore } from '../../store';
import { ChatMessage, MessageAttachment, Server, Session } from '../../types';
import { OpenCodeService } from '../../services/opencode';

interface ChatTabProps {
  session: Session;
  server: Server;
}

export default function ChatTab({ session, server }: ChatTabProps) {
  const { messages, addMessage, loadMessages } = useStore();
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const [service] = useState(() => new OpenCodeService(server));

  const sessionMessages = messages[session.id] || [];

  useEffect(() => {
    loadMessages(session.id);
  }, [session.id]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (sessionMessages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [sessionMessages.length]);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const content = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const attachment: MessageAttachment = {
          id: Date.now().toString(),
          type: 'file',
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType,
          size: asset.size,
        };

        setAttachments([...attachments, attachment]);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please grant permission to access photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const attachment: MessageAttachment = {
          id: Date.now().toString(),
          type: 'image',
          uri: asset.uri,
          name: `image_${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
        };

        setAttachments([...attachments, attachment]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter(a => a.id !== id));
  };

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      timestamp: new Date().toISOString(),
    };

    addMessage(session.id, userMessage);
    setInput('');
    const currentAttachments = [...attachments];
    setAttachments([]);
    setLoading(true);

    try {
      // Prepare attachments for sending
      const preparedAttachments = await Promise.all(
        currentAttachments.map(async (att) => {
          let content = '';
          
          if (att.type === 'image') {
            content = await FileSystem.readAsStringAsync(att.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            content = `data:${att.mimeType || 'image/jpeg'};base64,${content}`;
          } else {
            content = await FileSystem.readAsStringAsync(att.uri, {
              encoding: FileSystem.EncodingType.UTF8,
            });
          }

          return {
            type: att.type,
            content,
            name: att.name,
          };
        })
      );

      let fullResponse = '';
      setStreamingText('');

      await service.sendMessage(
        session.id,
        input,
        preparedAttachments.length > 0 ? preparedAttachments : undefined,
        (chunk) => {
          fullResponse += chunk;
          setStreamingText(fullResponse);
        }
      );

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date().toISOString(),
      };

      addMessage(session.id, assistantMessage);
      setStreamingText('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <View
      style={[
        styles.messageContainer,
        item.role === 'user' ? styles.userMessage : styles.assistantMessage,
      ]}
    >
      <View style={styles.messageHeader}>
        <Text style={styles.messageRole}>{item.role === 'user' ? 'You' : 'Assistant'}</Text>
        <Text style={styles.messageTime}>
          {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
      </View>
      
      {item.attachments && item.attachments.length > 0 && (
        <View style={styles.attachmentsPreview}>
          {item.attachments.map((att) => (
            <View key={att.id} style={styles.attachmentItem}>
              {att.type === 'image' ? (
                <Image source={{ uri: att.uri }} style={styles.attachmentImage} />
              ) : (
                <View style={styles.fileAttachment}>
                  <Text style={styles.fileName}>{att.name}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
      
      <Text style={styles.messageContent}>{item.content}</Text>
    </View>
  );

  const renderAttachment = ({ item }: { item: MessageAttachment }) => (
    <View style={styles.attachmentChip}>
      {item.type === 'image' ? (
        <Image source={{ uri: item.uri }} style={styles.attachmentThumb} />
      ) : (
        <Text style={styles.attachmentName} numberOfLines={1}>
          {item.name}
        </Text>
      )}
      <TouchableOpacity onPress={() => removeAttachment(item.id)}>
        <Text style={styles.removeAttachment}>×</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={sessionMessages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start a conversation with OpenCode</Text>
          </View>
        }
        ListFooterComponent={
          streamingText ? (
            <View style={[styles.messageContainer, styles.assistantMessage]}>
              <Text style={styles.messageRole}>Assistant</Text>
              <Text style={styles.messageContent}>{streamingText}</Text>
              <ActivityIndicator style={styles.streamingIndicator} />
            </View>
          ) : null
        }
      />

      {attachments.length > 0 && (
        <FlatList
          horizontal
          data={attachments}
          renderItem={renderAttachment}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.attachmentsBar}
        />
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachButton} onPress={handlePickFile}>
          <Text style={styles.attachButtonText}>📎</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.attachButton} onPress={handlePickImage}>
          <Text style={styles.attachButtonText}>🖼️</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={10000}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.sendButton, loading && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messagesContainer: {
    padding: 16,
  },
  messageContainer: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    maxWidth: '80%',
  },
  userMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  messageRole: {
    fontWeight: '600',
    fontSize: 12,
    color: '#666',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
  },
  messageContent: {
    fontSize: 15,
    lineHeight: 20,
    color: '#333',
  },
  attachmentsPreview: {
    marginBottom: 8,
  },
  attachmentItem: {
    marginBottom: 8,
  },
  attachmentImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
  },
  fileAttachment: {
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 6,
  },
  fileName: {
    fontSize: 12,
    color: '#333',
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
  streamingIndicator: {
    marginTop: 8,
  },
  attachmentsBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    maxWidth: 150,
  },
  attachmentThumb: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 6,
  },
  attachmentName: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  removeAttachment: {
    fontSize: 20,
    color: '#FF3B30',
    marginLeft: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  attachButton: {
    padding: 8,
    marginRight: 4,
  },
  attachButtonText: {
    fontSize: 20,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
