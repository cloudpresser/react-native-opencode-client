import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { withUniwind } from 'uniwind';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useStore } from '../../store';
import { ChatMessage, ChatMessagePart, MessageAttachment, Server, Session } from '../../types';
import { OpenCodeService, Message as ApiMessage, ToolMetadata } from '../../services/opencode';
import { useThemeColors } from '../../hooks/useThemeColors';
import MarkdownRenderer from './MarkdownRenderer';
import ToolCallDisplay from './ToolCallDisplay';

const StyledImage = withUniwind(Image);
const StyledActivityIndicator = withUniwind(ActivityIndicator);

interface ChatTabProps {
  session: Session;
  server: Server;
}

const INITIAL_LOAD_LIMIT = 10;
const PAGINATION_LIMIT = 10;

function convertApiMessageToChatMessage(apiMsg: ApiMessage): ChatMessage {
  const chatParts: ChatMessagePart[] = [];
  const attachments: MessageAttachment[] = [];
  let plainContent = '';

  const toolMeta = apiMsg.metadata?.tool ?? {};

  for (const part of apiMsg.parts) {
    switch (part.type) {
      case 'text':
        chatParts.push({ type: 'text', content: part.text });
        plainContent += part.text;
        break;
      case 'reasoning':
        chatParts.push({ type: 'reasoning', content: part.text });
        break;
      case 'tool-invocation': {
        const inv = part.toolInvocation;
        const meta: ToolMetadata | undefined = toolMeta[inv.toolCallId];
        chatParts.push({
          type: 'tool-call',
          toolCall: {
            toolCallId: inv.toolCallId,
            toolName: inv.toolName,
            args: inv.args,
            state: inv.state,
            result: inv.state === 'result' ? inv.result : undefined,
            title: meta?.title,
          },
        });
        break;
      }
      case 'image':
        if (part.image) {
          attachments.push({
            id: `${apiMsg.info.id}-img-${attachments.length}`,
            type: 'image',
            uri: part.image.startsWith('data:') ? part.image : `data:image/png;base64,${part.image}`,
            name: `image_${attachments.length}.png`,
            mimeType: 'image/png',
          });
        }
        break;
      case 'file':
        if (part.data || part.url) {
          attachments.push({
            id: `${apiMsg.info.id}-file-${attachments.length}`,
            type: 'file',
            uri: part.url || part.data || '',
            name: part.filename || `file_${attachments.length}`,
            mimeType: part.mimeType || part.mediaType || 'application/octet-stream',
          });
        }
        break;
      // step-start and source-url are structural, skip
    }
  }

  return {
    id: apiMsg.info.id,
    role: apiMsg.info.role,
    content: plainContent,
    parts: chatParts.length > 0 ? chatParts : undefined,
    timestamp: apiMsg.info.time?.created
      ? new Date(apiMsg.info.time.created * 1000).toISOString()
      : new Date().toISOString(),
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

export default function ChatTab({ session, server }: ChatTabProps) {
  const colors = useThemeColors();
  const { messages, hasMoreMessages, addMessage, setMessages, prependMessages, setHasMoreMessages } = useStore();
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [streamingText, setStreamingText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const [service] = useState(() => new OpenCodeService(server));

  const [selectedAgent, setSelectedAgent] = useState<string>('coder');
  const [showAgentPicker, setShowAgentPicker] = useState(false);

  const AGENTS = [
    { id: 'coder', label: 'Coder', description: 'Default coding agent' },
    { id: 'task', label: 'Task', description: 'Task-oriented agent' },
    { id: 'explore', label: 'Explore', description: 'Codebase exploration' },
  ];

  const sessionMessages = messages[session.id] || [];
  const canLoadMore = hasMoreMessages[session.id] ?? true;

  const loadInitialMessages = useCallback(async () => {
    try {
      setInitialLoading(true);
      const apiMessages = await service.getMessages(session.id, INITIAL_LOAD_LIMIT);
      const chatMessages = apiMessages.map(convertApiMessageToChatMessage);
      setMessages(session.id, chatMessages);
      setHasMoreMessages(session.id, apiMessages.length === INITIAL_LOAD_LIMIT);
    } catch (error) {
      console.error('Error loading initial messages:', error);
      Alert.alert('Error', 'Failed to load messages from server');
    } finally {
      setInitialLoading(false);
    }
  }, [session.id, service, setMessages, setHasMoreMessages]);

  const loadOlderMessages = useCallback(async () => {
    if (loadingMore || !canLoadMore || sessionMessages.length === 0) return;

    try {
      setLoadingMore(true);
      const oldestMessage = sessionMessages[0];
      const apiMessages = await service.getMessages(
        session.id,
        PAGINATION_LIMIT,
        oldestMessage.timestamp
      );
      
      if (apiMessages.length > 0) {
        const chatMessages = apiMessages.map(convertApiMessageToChatMessage);
        prependMessages(session.id, chatMessages);
        setHasMoreMessages(session.id, apiMessages.length === PAGINATION_LIMIT);
      } else {
        setHasMoreMessages(session.id, false);
      }
    } catch (error) {
      console.error('Error loading older messages:', error);
      Alert.alert('Error', 'Failed to load older messages');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, canLoadMore, sessionMessages, session.id, service, prependMessages, setHasMoreMessages]);

  useEffect(() => {
    loadInitialMessages();
  }, [loadInitialMessages]);

  useEffect(() => {
    if (sessionMessages.length > 0 && !initialLoading && !loadingMore) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [sessionMessages.length, initialLoading, loadingMore]);

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

  const renderMessageContent = (item: ChatMessage) => {
    const isUser = item.role === 'user';
    const parts = item.parts;

    // If no parts, fall back to plain content rendered as markdown
    if (!parts || parts.length === 0) {
      if (isUser) {
        return <Text className="text-on-primary text-[15px] leading-5">{item.content}</Text>;
      }
      return <MarkdownRenderer content={item.content} />;
    }

    return (
      <>
        {parts.map((part, idx) => {
          switch (part.type) {
            case 'text':
              if (isUser) {
                return (
                  <Text key={idx} className="text-on-primary text-[15px] leading-5">
                    {part.content}
                  </Text>
                );
              }
              return <MarkdownRenderer key={idx} content={part.content || ''} />;

            case 'tool-call':
              if (part.toolCall) {
                return <ToolCallDisplay key={part.toolCall.toolCallId || idx} toolCall={part.toolCall} />;
              }
              return null;

            case 'reasoning':
              return (
                <View key={idx} className="border-l-2 border-info pl-2 mb-2 opacity-70">
                  <Text className="text-text-muted text-[10px] font-semibold mb-0.5">Thinking</Text>
                  <Text className="text-text-muted text-[13px] italic leading-4">
                    {part.content}
                  </Text>
                </View>
              );

            default:
              return null;
          }
        })}
      </>
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }): React.ReactElement => {
    const isUser = item.role === 'user';

    return (
      <View
        className={`rounded-xl mb-3 ${isUser ? 'self-end max-w-[80%]' : 'self-start w-full'}`}
        testID={`message-${item.role}-${item.id}`}
      >
        {/* User messages get the bubble style */}
        {isUser ? (
          <View className="bg-primary p-3 rounded-xl">
            <View className="flex-row justify-between mb-1">
              <Text className="text-on-primary font-semibold text-xs">You</Text>
              <Text className="text-on-primary/70 text-[10px]">
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
                      <View className="bg-on-primary/20 p-2 rounded-md">
                        <Text className="text-xs text-on-primary">{att.name}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
            {renderMessageContent(item)}
          </View>
        ) : (
          /* Assistant messages: full-width, no bubble, parts render inline */
          <View className="py-2">
            <View className="flex-row justify-between mb-1 px-1">
              <Text className="text-text-muted font-semibold text-xs">Assistant</Text>
              <Text className="text-text-subtle text-[10px]">
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
            {renderMessageContent(item)}
          </View>
        )}
      </View>
    );
  };

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

  const renderLoadMoreHeader = () => {
    if (!canLoadMore || sessionMessages.length === 0) return null;
    
    return (
      <TouchableOpacity 
        onPress={loadOlderMessages}
        disabled={loadingMore}
        className="items-center py-3 mb-2"
        testID="load-more-button"
      >
        {loadingMore ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text className="text-primary text-sm font-medium">Load older messages</Text>
        )}
      </TouchableOpacity>
    );
  };

  if (initialLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center" testID="chat-tab">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-text-muted mt-3">Loading messages...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" testID="chat-tab">
      <FlatList
        ref={flatListRef}
        data={sessionMessages}
        renderItem={renderMessage}
        keyExtractor={(item: ChatMessage) => item.id}
        contentContainerClassName="p-4"
        testID="messages-list"
        ListHeaderComponent={renderLoadMoreHeader}
        ListEmptyComponent={
          <View className="items-center justify-center pt-16" testID="empty-messages">
            <Text className="text-lg font-semibold text-text-muted mb-2">No messages yet</Text>
            <Text className="text-sm text-text-subtle">Start a conversation with OpenCode</Text>
          </View>
        }
        ListFooterComponent={
          streamingText ? (
            <View className="self-start w-full py-2" testID="streaming-message">
              <Text className="text-text-muted font-semibold text-xs mb-1 px-1">Assistant</Text>
              <MarkdownRenderer content={streamingText} />
              <StyledActivityIndicator className="mt-2" />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={loadingMore}
            onRefresh={loadOlderMessages}
            tintColor={colors.primary}
            title={canLoadMore ? "Pull to load older messages" : "No older messages"}
            titleColor={colors.textMuted}
          />
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

      <View className="bg-surface border-t border-border">
        {/* Agent selector row */}
        <View className="flex-row items-center px-3 pt-2 pb-1">
          <Text className="text-text-subtle text-xs mr-2">Agent:</Text>
          <TouchableOpacity
            onPress={() => setShowAgentPicker(true)}
            className="flex-row items-center bg-surface-elevated px-2.5 py-1 rounded-full border border-border"
            testID="agent-selector"
          >
            <Text className="text-text text-xs font-medium">{AGENTS.find(a => a.id === selectedAgent)?.label ?? selectedAgent}</Text>
            <Text className="text-text-muted text-[10px] ml-1">▼</Text>
          </TouchableOpacity>
        </View>

        {/* Input row */}
        <View className="flex-row items-end px-3 pb-3 pt-1">
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
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text className="text-on-primary font-semibold">Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Agent picker modal */}
      <Modal
        visible={showAgentPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAgentPicker(false)}
      >
        <Pressable
          className="flex-1 bg-overlay justify-end"
          onPress={() => setShowAgentPicker(false)}
        >
          <View className="bg-surface rounded-t-2xl p-4 pb-8">
            <Text className="text-text font-semibold text-base mb-3">Select Agent</Text>
            {AGENTS.map((agent) => (
              <TouchableOpacity
                key={agent.id}
                className={`flex-row items-center p-3 rounded-lg mb-1 ${selectedAgent === agent.id ? 'bg-primary/10 border border-primary' : 'border border-transparent'}`}
                onPress={() => {
                  setSelectedAgent(agent.id);
                  setShowAgentPicker(false);
                }}
              >
                <View className="flex-1">
                  <Text className={`text-sm font-medium ${selectedAgent === agent.id ? 'text-primary' : 'text-text'}`}>
                    {agent.label}
                  </Text>
                  <Text className="text-text-subtle text-xs">{agent.description}</Text>
                </View>
                {selectedAgent === agent.id && (
                  <Text className="text-primary text-sm">✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}