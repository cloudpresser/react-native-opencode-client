import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { withUniwind } from 'uniwind';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useStore } from '../../store';
import { ChatMessage, MessageAttachment, Server, Session } from '../../types';
import { OpenCodeService } from '../../services/opencode';
import { useThemeColors } from '../../hooks/useThemeColors';

const StyledImage = withUniwind(Image);
const StyledActivityIndicator = withUniwind(ActivityIndicator);

interface ChatTabProps {
  session: Session;
  server: Server;
}

export default function ChatTab({ session, server }: ChatTabProps) {
  const colors = useThemeColors();
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

  const renderMessage = ({ item }: { item: ChatMessage }): React.ReactElement => (
    <View
      className={`p-3 rounded-xl mb-3 max-w-[80%] ${item.role === 'user' ? 'bg-primary self-end' : 'bg-surface self-start border border-border'}`}
      testID={`message-${item.role}-${item.id}`}
    >
      <View className="flex-row justify-between mb-1">
        <Text className={item.role === 'user' ? 'text-white font-semibold text-xs' : 'text-text-muted font-semibold text-xs'}>
          {item.role === 'user' ? 'You' : 'Assistant'}
        </Text>
        <Text className={item.role === 'user' ? 'text-white/70 text-[10px]' : 'text-text-subtle text-[10px]'}>
          {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
      </View>
      
      {item.attachments && item.attachments.length > 0 && (
        <View className="mb-2">
          {item.attachments.map((att) => (
            <View key={att.id} className="mb-2">
              {att.type === 'image' ? (
                <StyledImage source={{ uri: att.uri }} className="w-48 h-48 rounded-lg" />
              ) : (
                <View className="bg-border-muted p-2 rounded-md">
                  <Text className="text-xs text-text">{att.name}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
      
      <Text className={item.role === 'user' ? 'text-white text-[15px] leading-5' : 'text-text text-[15px] leading-5'}>
        {item.content}
      </Text>
    </View>
  );

  const renderAttachment = ({ item }: { item: MessageAttachment }): React.ReactElement => (
    <View className="flex-row items-center bg-border-muted rounded-full px-3 py-1.5 mr-2 max-w-[150px]">
      {item.type === 'image' ? (
        <StyledImage source={{ uri: item.uri }} className="w-6 h-6 rounded mr-1.5" />
      ) : (
        <Text className="text-xs text-text flex-1" numberOfLines={1}>{item.name}</Text>
      )}
      <TouchableOpacity onPress={() => removeAttachment(item.id)}>
        <Text className="text-lg text-danger ml-1.5">×</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-background" testID="chat-tab">
      <FlatList
        ref={flatListRef}
        data={sessionMessages}
        renderItem={renderMessage}
        keyExtractor={(item: ChatMessage) => item.id}
        contentContainerClassName="p-4"
        testID="messages-list"
        ListEmptyComponent={
          <View className="items-center justify-center pt-16" testID="empty-messages">
            <Text className="text-lg font-semibold text-text-muted mb-2">No messages yet</Text>
            <Text className="text-sm text-text-subtle">Start a conversation with OpenCode</Text>
          </View>
        }
        ListFooterComponent={
          streamingText ? (
            <View className="bg-surface self-start p-3 rounded-xl border border-border max-w-[80%]" testID="streaming-message">
              <Text className="text-text-muted font-semibold text-xs mb-1">Assistant</Text>
              <Text className="text-text text-[15px] leading-5">{streamingText}</Text>
              <StyledActivityIndicator className="mt-2" />
            </View>
          ) : null
        }
      />

      {attachments.length > 0 && (
        <FlatList
          horizontal
          data={attachments}
          renderItem={renderAttachment}
keyExtractor={(item: MessageAttachment) => item.id}
          contentContainerClassName="px-4 py-2 bg-surface border-t border-border"
          testID="attachments-list"
        />
      )}

      <View className="flex-row items-end p-3 bg-surface border-t border-border">
        <TouchableOpacity 
          className="p-2 mr-1"
          onPress={handlePickFile}
          testID="attach-file-button"
        >
          <Text className="text-xl">📎</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="p-2 mr-1"
          onPress={handlePickImage}
          testID="attach-image-button"
        >
          <Text className="text-xl">🖼️</Text>
        </TouchableOpacity>

        <TextInput
          className="flex-1 border border-border rounded-full px-4 py-2 text-base max-h-24 mr-2 text-text"
          placeholder="Type a message..."
          placeholderTextColor={colors.textSubtle}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={10000}
          editable={!loading}
          testID="chat-input"
        />

        <TouchableOpacity
          className={`rounded-full px-5 py-2.5 justify-center items-center ${loading ? 'bg-border-muted' : 'bg-primary'}`}
          onPress={handleSend}
          disabled={loading}
          testID="send-message-btn"
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text className="text-white font-semibold">Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}