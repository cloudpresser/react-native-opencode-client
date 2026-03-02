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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { withUniwind } from 'uniwind';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useStore } from '../../store';
import { Agent, ChatMessage, ChatMessagePart, ChatPermission, ChatQuestion, MessageAttachment, Server, Session } from '../../types';
import { OpenCodeService, Message as ApiMessage, ToolMetadata, QuestionAskedEvent, PermissionAskedEvent } from '../../services/opencode';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAppStateRefresh } from '../../hooks/useAppStateRefresh';
import MarkdownRenderer from './MarkdownRenderer';
import ToolCallDisplay from './ToolCallDisplay';
import QuestionDisplay from './QuestionDisplay';
import PermissionDisplay from './PermissionDisplay';
import ModelSelector from './ModelSelector';
import { Provider } from '../../types';

const StyledImage = withUniwind(Image);
const StyledActivityIndicator = withUniwind(ActivityIndicator);

interface ChatTabProps {
  session: Session;
  server: Server;
}

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
      // step-start, source-url, and other structural types are skipped
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
  const { messages, addMessage, setMessages, prependMessages, setViewedSessionId, selectedModels, setSelectedModel } = useStore();
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [streamingText, setStreamingText] = useState('');
  const [pendingQuestion, setPendingQuestion] = useState<QuestionAskedEvent | null>(null);
  const [pendingPermission, setPendingPermission] = useState<PermissionAskedEvent | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const [service] = useState(() => new OpenCodeService(server));

  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);
  const [defaultModelId, setDefaultModelId] = useState<string | undefined>(undefined);
  const [providersLoading, setProvidersLoading] = useState(true);

  // ─── Notification suppression: report which session is being viewed ───
  useFocusEffect(
    useCallback(() => {
      setViewedSessionId(session.id);
      return () => setViewedSessionId(null);
    }, [session.id, setViewedSessionId]),
  );

  // ─── Refetch messages when app resumes from background ───
  useAppStateRefresh(useCallback(async () => {
    try {
      const apiMessages = await service.getMessages(session.id);
      const chatMessages = apiMessages.map(convertApiMessageToChatMessage);
      setMessages(session.id, chatMessages);
    } catch (err) {
      console.error('Error refreshing messages on resume:', err);
    }
  }, [session.id, service, setMessages]));

  useEffect(() => {
    const loadAgents = async () => {
      try {
        setAgentsLoading(true);
        const fetchedAgents = await service.getAgents();
        // Show non-hidden agents that are either primary or 'all'
        // Some backends might return agents without a mode, so we'll be permissive if mode is missing but it's not explicitly hidden
        const primaryAgents = fetchedAgents.filter(
          (a) => (!a.mode || a.mode === 'primary' || a.mode === 'all') && !a.hidden
        );
        setAgents(primaryAgents);
        // Default to first primary agent if current selection isn't in the list or is empty
        if (primaryAgents.length > 0 && (!selectedAgent || !primaryAgents.find((a) => a.name === selectedAgent))) {
          setSelectedAgent(primaryAgents[0].name);
        }
      } catch (error) {
        console.error('Error loading agents:', error);
      } finally {
        setAgentsLoading(false);
      }
    };
    loadAgents();
  }, [service]);

  useEffect(() => {
    const loadProviders = async () => {
      try {
        setProvidersLoading(true);
        const data = await service.getProviders();
        if (data) {
          setProviders(data.all || []);
          setConnectedProviders(data.connected || []);
          setDefaultModelId(data.default);
          
          const currentSelected = useStore.getState().selectedModels?.[session.id];
          if (data.default && !currentSelected) {
            useStore.getState().setSelectedModel?.(session.id, data.default);
          }
        }
      } catch (error) {
        console.error('Error loading providers:', error);
      } finally {
        setProvidersLoading(false);
      }
    };
    loadProviders();
  }, [service, session.id]);

  // Auto-scroll to bottom when keyboard opens
  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    return () => sub.remove();
  }, []);

  const sessionMessages = messages[session.id] || [];

  const loadInitialMessages = useCallback(async () => {
    try {
      setInitialLoading(true);
      const apiMessages = await service.getMessages(session.id);
      const chatMessages = apiMessages.map(convertApiMessageToChatMessage);
      setMessages(session.id, chatMessages);
    } catch (error) {
      console.error('Error loading initial messages:', error);
      Alert.alert('Error', 'Failed to load messages from server');
    } finally {
      setInitialLoading(false);
    }
  }, [session.id, service, setMessages]);

  useEffect(() => {
    loadInitialMessages();
  }, [loadInitialMessages]);

  useEffect(() => {
    if (sessionMessages.length > 0 && !initialLoading) {
      const currentLastMessage = sessionMessages[sessionMessages.length - 1];
      if (currentLastMessage.id !== lastMessageIdRef.current) {
        lastMessageIdRef.current = currentLastMessage.id;
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    }
  }, [sessionMessages.length, initialLoading]);

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

  const handleStop = async () => {
    try {
      await service.abortSession(session.id);
      // The stream will naturally end or error out, so we rely on that to clear loading state
      // But we can force it here for immediate UI feedback
      setLoading(false);
    } catch (error) {
      console.error('Error aborting session:', error);
      Alert.alert('Error', 'Failed to stop generation');
    }
  };

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;

    const messageText = input;
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      timestamp: new Date().toISOString(),
    };

    addMessage(session.id, userMessage);
    setInput('');
    const currentAttachments = [...attachments];
    setAttachments([]);
    setLoading(true);
    setStreamingText('');

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

      let streamedText = '';

      await service.streamMessage(
        session.id,
        messageText,
        preparedAttachments.length > 0 ? preparedAttachments : undefined,
        {
          onTextDelta: (delta) => {
            streamedText += delta;
            setStreamingText(streamedText);
          },
          onQuestionAsked: (event) => {
            setPendingQuestion(event);
          },
          onPermissionAsked: (event) => {
            setPendingPermission(event);
          },
          onComplete: async () => {
            // Fetch final messages from server to get rich parts
            // (tool calls, reasoning blocks, attachments, etc.)
            try {
              const apiMessages = await service.getMessages(session.id);
              const chatMessages = apiMessages.map(convertApiMessageToChatMessage);
              setMessages(session.id, chatMessages);
            } catch (err) {
              console.error('Error fetching final messages:', err);
            }
          },
        },
        selectedAgent,
        selectedModels?.[session.id]
      );

      setStreamingText('');
    } catch (error) {
      console.error('Error sending message:', error);
      // On SSE failure, try to reload messages from server
      try {
        const apiMessages = await service.getMessages(session.id);
        const chatMessages = apiMessages.map(convertApiMessageToChatMessage);
        setMessages(session.id, chatMessages);
      } catch (_) {}
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setLoading(false);
      setStreamingText('');
    }
  };

  /**
   * Reply to a pending question from the server.
   * We call the dedicated question reply endpoint — NOT prompt_async.
   * The original SSE stream from handleSend is still open and will
   * continue receiving events once the server unblocks.
   */
  const handleAnswerQuestion = async (requestId: string, answers: string[][]) => {
    setPendingQuestion(null);

    try {
      const ok = await service.replyToQuestion(requestId, answers);
      if (!ok) {
        Alert.alert('Error', 'Failed to send answer to server');
      }
      // The original SSE stream is still open.
      // When the LLM resumes, we'll get more message.part.updated events,
      // and eventually session.status: idle → onComplete fires.
    } catch (error) {
      console.error('Error answering question:', error);
      Alert.alert('Error', 'Failed to send answer');
    }
  };

  /**
   * Approve a pending permission request from the server.
   */
  const handleApprovePermission = async (requestId: string) => {
    setPendingPermission(null);

    try {
      const ok = await service.approvePermission(requestId);
      if (!ok) {
        Alert.alert('Error', 'Failed to approve permission');
      }
    } catch (error) {
      console.error('Error approving permission:', error);
      Alert.alert('Error', 'Failed to approve permission');
    }
  };

  /**
   * Deny a pending permission request from the server.
   */
  const handleDenyPermission = async (requestId: string) => {
    setPendingPermission(null);

    try {
      const ok = await service.denyPermission(requestId);
      if (!ok) {
        Alert.alert('Error', 'Failed to deny permission');
      }
    } catch (error) {
      console.error('Error denying permission:', error);
      Alert.alert('Error', 'Failed to deny permission');
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

  if (initialLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center" testID="chat-tab">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-text-muted mt-3">Loading messages...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 120}
      testID="chat-tab"
    >
      <FlatList
        ref={flatListRef}
        data={sessionMessages}
        renderItem={renderMessage}
        keyExtractor={(item: ChatMessage) => item.id}
        contentContainerClassName="p-4"
        testID="messages-list"
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        ListEmptyComponent={
          <View className="items-center justify-center pt-16" testID="empty-messages">
            <Text className="text-lg font-semibold text-text-muted mb-2">No messages yet</Text>
            <Text className="text-sm text-text-subtle">Start a conversation with OpenCode</Text>
          </View>
        }
        ListFooterComponent={
          streamingText || pendingQuestion || pendingPermission ? (
            <View>
              {streamingText ? (
                <View className="self-start w-full py-2" testID="streaming-message">
                  <Text className="text-text-muted font-semibold text-xs mb-1 px-1">Assistant</Text>
                  <MarkdownRenderer content={streamingText} />
                  {!pendingQuestion && !pendingPermission && <StyledActivityIndicator className="mt-2" />}
                </View>
              ) : null}
              {pendingQuestion && pendingQuestion.questions.map((q, idx) => (
                <QuestionDisplay
                  key={`${pendingQuestion.id}-${idx}`}
                  question={{
                    requestId: pendingQuestion.id,
                    question: q.question,
                    header: q.header,
                    options: q.options,
                    multiple: q.multiple,
                    custom: q.custom,
                  }}
                  onAnswer={(selectedLabels: string[]) => {
                    // Build the answers array: one entry per question
                    // For now we only support single-question events
                    handleAnswerQuestion(pendingQuestion.id, [selectedLabels]);
                  }}
                />
              ))}
              {pendingPermission && (
                <PermissionDisplay
                  key={pendingPermission.id}
                  permission={{
                    requestId: pendingPermission.id,
                    message: pendingPermission.permission.message,
                    header: pendingPermission.permission.header,
                    details: pendingPermission.permission.details,
                  }}
                  onApprove={() => handleApprovePermission(pendingPermission.id)}
                  onDeny={() => handleDenyPermission(pendingPermission.id)}
                />
              )}
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

      <View className="bg-surface border-t border-border">
        {/* Agent and Model selector row */}
        <View className="flex-row items-center px-3 pt-2 pb-1 justify-between z-10">
          <View className="flex-row items-center flex-1 pr-2">
            <Text className="text-text-subtle text-xs mr-2">Agent:</Text>
            {agentsLoading ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : agents.length > 0 ? (
              <TouchableOpacity
                onPress={() => setShowAgentPicker(true)}
                className="flex-row items-center bg-surface-elevated px-2.5 py-1 rounded-full border border-border flex-shrink"
                testID="agent-selector"
              >
                <Text className="text-text text-xs font-medium" numberOfLines={1} ellipsizeMode="tail">
                  {agents.find(a => a.name === selectedAgent)?.name ?? selectedAgent}
                </Text>
                <Text className="text-text-muted text-[10px] ml-1">▼</Text>
              </TouchableOpacity>
            ) : (
              <Text className="text-text-subtle text-xs">No agents available</Text>
            )}
          </View>
          
          <View className="flex-row items-center flex-1 justify-end">
            <ModelSelector
              providers={providers}
              connectedProviders={connectedProviders}
              defaultModelId={defaultModelId}
              selectedModelId={selectedModels?.[session.id] || null}
              onSelectModel={(modelId) => setSelectedModel?.(session.id, modelId)}
              loading={providersLoading}
            />
          </View>
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
            testID="chat-input"
          />

          {loading ? (
            <TouchableOpacity
              className="rounded-full px-5 py-2.5 justify-center items-center bg-danger"
              onPress={handleStop}
              testID="stop-message-btn"
            >
              <Text className="text-on-primary font-semibold">Stop</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className="rounded-full px-5 py-2.5 justify-center items-center bg-primary"
              onPress={handleSend}
              testID="send-message-btn"
            >
              <Text className="text-on-primary font-semibold">Send</Text>
            </TouchableOpacity>
          )}
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
            {agents.map((agent) => (
              <TouchableOpacity
                key={agent.name}
                className={`flex-row items-center p-3 rounded-lg mb-1 ${selectedAgent === agent.name ? 'bg-primary/10 border border-primary' : 'border border-transparent'}`}
                onPress={() => {
                  setSelectedAgent(agent.name);
                  setShowAgentPicker(false);
                }}
              >
                <View className="flex-1">
                  <Text className={`text-sm font-medium ${selectedAgent === agent.name ? 'text-primary' : 'text-text'}`}>
                    {agent.name}
                  </Text>
                  {agent.description && (
                    <Text className="text-text-subtle text-xs">{agent.description}</Text>
                  )}
                </View>
                {selectedAgent === agent.name && (
                  <Text className="text-primary text-sm">✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}