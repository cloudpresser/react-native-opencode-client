import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import {
  KeyboardAvoidingView as ControllerKeyboardAvoidingView,
} from 'react-native-keyboard-controller';
import { useFocusEffect } from '@react-navigation/native';
import { withUniwind } from 'uniwind';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useStore } from '../../store';
import { Agent, ChatMessage, ChatMessagePart, MessageAttachment, Server, Session } from '../../types';
import {
  OpenCodeService,
  Message as ApiMessage,
  MessagePart as ApiMessagePart,
  PermissionReply,
  StreamPartEvent,
  ToolMetadata,
  QuestionAskedEvent,
  PermissionAskedEvent,
} from '../../services/opencode';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAppStateRefresh } from '../../hooks/useAppStateRefresh';
import MarkdownRenderer from './MarkdownRenderer';
import ToolCallDisplay from './ToolCallDisplay';
import QuestionDisplay from './QuestionDisplay';
import PermissionDisplay from './PermissionDisplay';

const StyledImage = withUniwind(Image);
const StyledActivityIndicator = withUniwind(ActivityIndicator);

interface ChatTabProps {
  session: Session;
  server: Server;
}

type ChatListItem =
  | { kind: 'message'; key: string; message: ChatMessage }
  | { kind: 'streaming'; key: string; message: ChatMessage }
  | { kind: 'blocked-placeholder'; key: string; promptType: 'question' | 'permission' }
  | { kind: 'question'; key: string; event: QuestionAskedEvent }
  | { kind: 'permission'; key: string; event: PermissionAskedEvent };

function buildPlainContent(parts: ChatMessagePart[]): string {
  return parts
    .filter((part) => part.type === 'text')
    .map((part) => part.content || '')
    .join('');
}

function createStreamingMessage(sessionId: string): ChatMessage {
  return {
    id: `streaming-${sessionId}`,
    role: 'assistant',
    content: '',
    parts: [],
    timestamp: new Date().toISOString(),
  };
}

function isTransientStreamingMessage(message: ChatMessage): boolean {
  return message.id.startsWith('streaming-');
}

function isUserPromptEcho(part: ApiMessagePart & { sessionID?: string }, delta: string | undefined, promptText: string): boolean {
  return part.type === 'text' && !delta && part.text === promptText;
}

function formatPermissionMessage(event: PermissionAskedEvent): { message: string; details?: string; patterns?: string[] } {
  const permissionType = event.permission.type || 'unknown';
  const filepath = typeof event.permission.metadata?.filepath === 'string'
    ? event.permission.metadata.filepath
    : undefined;
  const parentDir = typeof event.permission.metadata?.parentDir === 'string'
    ? event.permission.metadata.parentDir
    : undefined;

  switch (permissionType) {
    case 'external_directory':
      return {
        message: filepath
          ? `OpenCode wants to access ${filepath}.`
          : 'OpenCode wants to access a directory outside the workspace.',
        details: parentDir
          ? `Parent directory: ${parentDir}`
          : 'This request requires access outside the current workspace.',
        patterns: event.permission.patterns,
      };
    default:
      return {
        message: filepath
          ? `OpenCode requested ${permissionType.replace(/_/g, ' ')} for ${filepath}.`
          : `OpenCode requested ${permissionType.replace(/_/g, ' ')}.`,
        details: parentDir,
        patterns: event.permission.patterns,
      };
  }
}

function applyStreamUpdate(
  current: ChatMessage | null,
  sessionId: string,
  event: StreamPartEvent,
): ChatMessage {
  const next = current
    ? { ...current, parts: current.parts ? [...current.parts] : [] }
    : createStreamingMessage(sessionId);

  const parts = next.parts || [];

  const upsertPart = (candidate: ChatMessagePart, predicate: (part: ChatMessagePart) => boolean) => {
    const existingIndex = parts.findIndex(predicate);
    if (existingIndex >= 0) {
      parts[existingIndex] = { ...parts[existingIndex], ...candidate };
      return parts[existingIndex];
    }
    parts.push(candidate);
    return candidate;
  };

  if (event.type === 'message.part.delta') {
    if (event.field !== 'text') {
      return next;
    }

    const existingIndex = parts.findIndex((part) => part.id === event.partID);
    if (existingIndex >= 0) {
      const existing = parts[existingIndex];
      parts[existingIndex] = {
        ...existing,
        content: `${existing.content || ''}${event.delta}`,
      };
    } else {
      parts.push({
        id: event.partID,
        type: 'text',
        content: event.delta,
      });
    }

    next.parts = parts;
    next.content = buildPlainContent(parts);
    return next;
  }

  const { part, delta } = event;

  const buildToolCallPart = (toolPart: Extract<ApiMessagePart, { type: 'tool' | 'tool-invocation' }>): ChatMessagePart => {
    if (toolPart.type === 'tool-invocation') {
      const invocation = toolPart.toolInvocation;
      return {
        id: toolPart.id,
        type: 'tool-call',
        toolCall: {
          toolCallId: invocation.toolCallId,
          toolName: invocation.toolName,
          args: invocation.args,
          state: invocation.state,
          result: invocation.state === 'result' ? invocation.result : undefined,
          metadata: undefined,
        },
      };
    }

    const state = toolPart.state;
    return {
      id: toolPart.id,
      type: 'tool-call',
      toolCall: {
        toolCallId: toolPart.callID,
        toolName: toolPart.tool,
        args: state.input,
        state:
          state.status === 'completed' || state.status === 'error'
            ? 'result'
            : state.status === 'running'
              ? 'call'
              : 'partial-call',
        result:
          state.status === 'completed'
            ? state.output
            : state.status === 'error'
              ? state.error
              : undefined,
        title: state.status === 'running' || state.status === 'completed' ? state.title : undefined,
        metadata: ('metadata' in state ? state.metadata : undefined) ?? toolPart.metadata,
      },
    };
  };

  if (part.type === 'reasoning') {
    const reasoningContent = typeof part.text === 'string' ? part.text : delta || '';
    const previous = parts.find((item) => item.id === part.id);
    const nextContent =
      typeof part.text === 'string' && part.text.length > 0
        ? part.text
        : `${previous?.content || ''}${delta || ''}`;

    upsertPart(
      {
        id: part.id,
        type: 'reasoning',
        content: nextContent,
      },
      (item) => item.id === part.id,
    );

    next.parts = parts;
    next.content = buildPlainContent(parts);
    return next;
  }

  if (part.type === 'text') {
    const content = typeof part.text === 'string' ? part.text : delta || '';
    if (!content) {
      return next;
    }

    const previous = parts.find((item) => item.id === part.id);
    upsertPart(
      {
        id: part.id,
        type: part.type,
        content:
          typeof part.text === 'string'
            ? part.text
            : `${previous?.content || ''}${delta || ''}`,
      },
      (item) => item.id === part.id,
    );

    next.parts = parts;
    next.content = buildPlainContent(parts);
    return next;
  }

  if (part.type === 'tool-invocation' || part.type === 'tool') {
    const toolCall = buildToolCallPart(part);
    const toolCallId = toolCall.toolCall?.toolCallId;

    const existingIndex = parts.findIndex(
      (item) => item.id === part.id || (item.type === 'tool-call' && item.toolCall?.toolCallId === toolCallId),
    );

    if (existingIndex >= 0) {
      parts[existingIndex] = toolCall;
    } else {
      parts.push(toolCall);
    }

    next.parts = parts;
    next.content = buildPlainContent(parts);
  }

  return next;
}

function convertApiMessageToChatMessage(apiMsg: ApiMessage): ChatMessage {
  const chatParts: ChatMessagePart[] = [];
  const attachments: MessageAttachment[] = [];
  let plainContent = '';

  const toolMeta = apiMsg.metadata?.tool ?? {};

  const buildPersistedToolCall = (part: Extract<ApiMessagePart, { type: 'tool' | 'tool-invocation' }>): ChatMessagePart => {
    if (part.type === 'tool-invocation') {
      const inv = part.toolInvocation;
      const meta: ToolMetadata | undefined = toolMeta[inv.toolCallId];
      return {
        id: part.id,
        type: 'tool-call',
        toolCall: {
          toolCallId: inv.toolCallId,
          toolName: inv.toolName,
          args: inv.args,
          state: inv.state,
          result: inv.state === 'result' ? inv.result : undefined,
          title: meta?.title,
          metadata: undefined,
        },
      };
    }

    const state = part.state;
    return {
      id: part.id,
      type: 'tool-call',
      toolCall: {
        toolCallId: part.callID,
        toolName: part.tool,
        args: state.input,
        state:
          state.status === 'completed' || state.status === 'error'
            ? 'result'
            : state.status === 'running'
              ? 'call'
              : 'partial-call',
        result:
          state.status === 'completed'
            ? state.output
            : state.status === 'error'
              ? state.error
              : undefined,
        title: state.status === 'running' || state.status === 'completed' ? state.title : undefined,
        metadata: ('metadata' in state ? state.metadata : undefined) ?? part.metadata,
      },
    };
  };

  for (const part of apiMsg.parts) {
    switch (part.type) {
      case 'text':
        chatParts.push({ id: part.id, type: 'text', content: part.text });
        plainContent += part.text;
        break;
      case 'reasoning':
        chatParts.push({ id: part.id, type: 'reasoning', content: part.text });
        break;
      case 'tool-invocation':
      case 'tool': {
        chatParts.push(buildPersistedToolCall(part));
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
  const { messages, addMessage, setMessages, setViewedSessionId } = useStore();
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<QuestionAskedEvent | null>(null);
  const [pendingPermission, setPendingPermission] = useState<PermissionAskedEvent | null>(null);
  const [blockedPlaceholder, setBlockedPlaceholder] = useState<'question' | 'permission' | null>(null);
  const resolvedPermissionIdsRef = useRef<Set<string>>(new Set());
  const [service] = useState(() => new OpenCodeService(server));

  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);

  // ─── Notification suppression: report which session is being viewed ───
  useFocusEffect(
    useCallback(() => {
      setViewedSessionId(session.id);
      return () => setViewedSessionId(null);
    }, [session.id, setViewedSessionId]),
  );

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

  const sessionMessages = messages[session.id] || [];

  const syncSessionState = useCallback(async (
    options?: {
      showLoader?: boolean;
      fallbackQuestion?: QuestionAskedEvent | null;
      fallbackPermission?: PermissionAskedEvent | null;
      clearStreaming?: boolean;
    },
  ) => {
    const {
      showLoader = false,
      fallbackQuestion = null,
      fallbackPermission = null,
      clearStreaming = false,
    } = options || {};

    try {
      if (showLoader) {
        setInitialLoading(true);
      }

      const [apiMessages, questions, permissions] = await Promise.all([
        service.getMessages(session.id),
        service.listPendingQuestions(),
        service.listPendingPermissions(),
      ]);
      const chatMessages = apiMessages.map(convertApiMessageToChatMessage);
      const nextQuestion = questions.find((question) => question.sessionID === session.id) ?? fallbackQuestion;
      const serverPermissionIds = new Set(permissions.map((permission) => permission.id));
      for (const resolvedId of Array.from(resolvedPermissionIdsRef.current)) {
        if (!serverPermissionIds.has(resolvedId)) {
          resolvedPermissionIdsRef.current.delete(resolvedId);
        }
      }
      const nextPermission = permissions.find(
        (permission) => permission.sessionID === session.id && !resolvedPermissionIdsRef.current.has(permission.id),
      ) ?? (fallbackPermission && !resolvedPermissionIdsRef.current.has(fallbackPermission.id) ? fallbackPermission : null);

      setMessages(session.id, chatMessages);
      setPendingQuestion(nextQuestion ?? null);
      setPendingPermission(nextPermission ?? null);
      setBlockedPlaceholder(null);

      if (clearStreaming) {
        setStreamingMessage(null);
      }
    } catch (error) {
      console.error('Error syncing session state:', error);

      if (fallbackQuestion) {
        setPendingQuestion(fallbackQuestion);
        setPendingPermission(null);
        setBlockedPlaceholder(null);
      }

      if (fallbackPermission) {
        setPendingPermission(fallbackPermission);
        setPendingQuestion(null);
        setBlockedPlaceholder(null);
      }

      if (showLoader) {
        Alert.alert('Error', 'Failed to load messages from server');
      }
    } finally {
      if (showLoader) {
        setInitialLoading(false);
      }
    }
  }, [session.id, service, setMessages]);

  // ─── Refetch messages and pending prompts when app resumes ───
  useAppStateRefresh(useCallback(async () => {
    await syncSessionState();
  }, [syncSessionState]));

  useEffect(() => {
    syncSessionState({ showLoader: true, clearStreaming: true });
  }, [syncSessionState]);

  const listItems = useMemo<ChatListItem[]>(() => {
    const items: ChatListItem[] = [];

    if (blockedPlaceholder && !pendingQuestion && !pendingPermission) {
      items.push({
        kind: 'blocked-placeholder',
        key: `blocked-placeholder-${blockedPlaceholder}-${session.id}`,
        promptType: blockedPlaceholder,
      });
    }

    if (pendingPermission) {
      items.push({
        kind: 'permission',
        key: `pending-permission-${pendingPermission.id}`,
        event: pendingPermission,
      });
    }

    if (pendingQuestion) {
      items.push({
        kind: 'question',
        key: `pending-question-${pendingQuestion.id}`,
        event: pendingQuestion,
      });
    }

    if (streamingMessage) {
      items.push({
        kind: 'streaming',
        key: `streaming-${session.id}`,
        message: streamingMessage,
      });
    }

    return [
      ...items,
      ...sessionMessages
        .slice()
        .reverse()
        .map((message) => ({ kind: 'message', key: message.id, message }) satisfies ChatListItem),
    ];
  }, [blockedPlaceholder, pendingPermission, pendingQuestion, session.id, sessionMessages, streamingMessage]);

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
      setBlockedPlaceholder(null);
    } catch (error) {
      console.error('Error aborting session:', error);
      Alert.alert('Error', 'Failed to stop generation');
    }
  };

  const handleSend = useCallback(async () => {
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
    setStreamingMessage(null);
    setPendingQuestion(null);
    setPendingPermission(null);
    setBlockedPlaceholder(null);

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

      await service.streamMessage(
        session.id,
        messageText,
        preparedAttachments.length > 0 ? preparedAttachments : undefined,
        {
          onPartUpdated: (event) => {
            if (event.type === 'message.part.updated' && !streamingMessage && isUserPromptEcho(event.part, event.delta, messageText)) {
              return;
            }
            setStreamingMessage((current) => applyStreamUpdate(current, session.id, event));
            setBlockedPlaceholder(null);
          },
          onQuestionAsked: async (event) => {
            setBlockedPlaceholder('question');
            setPendingQuestion(null);
            setPendingPermission(null);
            await syncSessionState({ fallbackQuestion: event });
          },
          onPermissionAsked: async (event) => {
            setBlockedPlaceholder('permission');
            setPendingPermission(null);
            setPendingQuestion(null);
            await syncSessionState({ fallbackPermission: event });
          },
          onComplete: async () => {
            // Fetch final messages from server to get rich parts
            // (tool calls, reasoning blocks, attachments, etc.)
            try {
              await syncSessionState({ clearStreaming: true });
            } catch (err) {
              console.error('Error fetching final messages:', err);
            }
          },
        },
        selectedAgent
      );

    } catch (error) {
      console.error('Error sending message:', error);
      // On SSE failure, try to reload messages from server
      try {
        await syncSessionState({ clearStreaming: true });
      } catch (_) {}
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setLoading(false);
    }
  }, [addMessage, attachments, input, selectedAgent, service, session.id, syncSessionState]);

  /**
   * Reply to a pending question from the server.
   * We call the dedicated question reply endpoint — NOT prompt_async.
   * The original SSE stream from handleSend is still open and will
   * continue receiving events once the server unblocks.
   */
  const handleAnswerQuestion = async (requestId: string, answers: string[][]) => {
    try {
      const ok = await service.replyToQuestion(requestId, answers);
      if (!ok) {
        Alert.alert('Error', 'Failed to send answer to server');
        return;
      }
      setPendingQuestion(null);
      setBlockedPlaceholder(null);
      // The original SSE stream is still open.
      // When the LLM resumes, we'll get more message.part.updated events,
      // and eventually session.status: idle → onComplete fires.
    } catch (error) {
      console.error('Error answering question:', error);
      Alert.alert('Error', 'Failed to send answer');
    }
  };

  /**
   * Reply to a pending permission request using the v2 reply semantics.
   */
  const handleReplyPermission = async (requestId: string, reply: PermissionReply) => {
    try {
      const ok = await service.replyToPermission(requestId, reply);
      if (!ok) {
        Alert.alert('Error', 'Failed to reply to permission');
        return;
      }
      resolvedPermissionIdsRef.current.add(requestId);
      setPendingPermission(null);
      setBlockedPlaceholder(null);
    } catch (error) {
      console.error('Error replying to permission:', error);
      Alert.alert('Error', 'Failed to reply to permission');
    }
  };

  const renderMessageContent = (item: ChatMessage) => {
    const isUser = item.role === 'user';
    const isTransient = isTransientStreamingMessage(item);
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
              if (!part.content?.trim()) {
                if (!isTransient) {
                  return null;
                }
                return (
                  <View key={idx} className="border-l-2 border-info pl-2 mb-2 opacity-70">
                    <Text className="text-text-muted text-[10px] font-semibold mb-0.5">Thinking</Text>
                    <Text className="text-text-muted text-[13px] italic leading-4">Thinking...</Text>
                  </View>
                );
              }
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

  const renderMessage = (message: ChatMessage): React.ReactElement => {
    const isUser = message.role === 'user';

    return (
      <View
        className={`rounded-xl mb-3 ${isUser ? 'self-end max-w-[80%]' : 'self-start w-full'}`}
        testID={`message-${message.role}-${message.id}`}
      >
        {/* User messages get the bubble style */}
        {isUser ? (
          <View className="bg-primary p-3 rounded-xl">
            <View className="flex-row justify-between mb-1">
              <Text className="text-on-primary font-semibold text-xs">You</Text>
              <Text className="text-on-primary/70 text-[10px]">
                {new Date(message.timestamp).toLocaleTimeString()}
              </Text>
            </View>
            {message.attachments && message.attachments.length > 0 && (
              <View className="mb-2">
                {message.attachments.map((att) => (
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
            {renderMessageContent(message)}
          </View>
        ) : (
          /* Assistant messages: full-width, no bubble, parts render inline */
          <View className="py-2">
            <View className="flex-row justify-between mb-1 px-1">
              <Text className="text-text-muted font-semibold text-xs">Assistant</Text>
              <Text className="text-text-subtle text-[10px]">
                {new Date(message.timestamp).toLocaleTimeString()}
              </Text>
            </View>
            {message.attachments && message.attachments.length > 0 && (
              <View className="mb-2">
                {message.attachments.map((att) => (
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
            {renderMessageContent(message)}
          </View>
        )}
      </View>
    );
  };

  const renderListItem = ({ item }: { item: ChatListItem }): React.ReactElement => {
    switch (item.kind) {
      case 'message':
        return renderMessage(item.message);
      case 'streaming':
        return (
          <View testID="streaming-message">
            {renderMessage(item.message)}
            {!pendingQuestion && !pendingPermission && !blockedPlaceholder ? (
              <StyledActivityIndicator className="mt-2 mb-3 self-start" />
            ) : null}
          </View>
        );
      case 'blocked-placeholder':
        return (
          <View className="self-start w-full py-2 mb-3" testID={`blocked-${item.promptType}`}>
            <Text className="text-text-muted font-semibold text-xs mb-1 px-1">Assistant</Text>
            <View className="bg-surface-elevated border border-border rounded-lg px-3 py-3 self-start">
              <Text className="text-text font-medium">
                {item.promptType === 'question' ? 'Asking question...' : 'Requesting permission...'}
              </Text>
            </View>
            <StyledActivityIndicator className="mt-2 self-start" />
          </View>
        );
      case 'question':
        return (
          <View className="mb-3">
            <QuestionDisplay
              questions={item.event.questions.map((question) => ({
                requestId: item.event.id,
                question: question.question,
                header: question.header,
                options: question.options,
                multiple: question.multiple,
                custom: question.custom,
              }))}
              onAnswer={(answers: string[][]) => {
                handleAnswerQuestion(item.event.id, answers);
              }}
            />
          </View>
        );
      case 'permission':
        return (
          <View className="mb-3">
            <PermissionDisplay
              permission={{
                requestId: item.event.id,
                type: item.event.permission.type,
                ...formatPermissionMessage(item.event),
              }}
              onReply={(reply) => handleReplyPermission(item.event.id, reply)}
            />
          </View>
        );
    }
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
    <ControllerKeyboardAvoidingView
      className="flex-1 bg-background"
      behavior="translate-with-padding"
      keyboardVerticalOffset={115}
      testID="chat-tab"
    >
      <FlatList
        data={listItems}
        renderItem={renderListItem}
        keyExtractor={(item: ChatListItem) => item.key}
        inverted
        contentContainerClassName="p-4"
        testID="messages-list"
        ListEmptyComponent={
          <View className="items-center justify-center pt-16" testID="empty-messages">
            <Text className="text-lg font-semibold text-text-muted mb-2">No messages yet</Text>
            <Text className="text-sm text-text-subtle">Start a conversation with OpenCode</Text>
          </View>
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
          {agentsLoading ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : agents.length > 0 ? (
            <TouchableOpacity
              onPress={() => setShowAgentPicker(true)}
              className="flex-row items-center bg-surface-elevated px-2.5 py-1 rounded-full border border-border"
              testID="agent-selector"
            >
              <Text className="text-text text-xs font-medium">{agents.find(a => a.name === selectedAgent)?.name ?? selectedAgent}</Text>
              <Text className="text-text-muted text-[10px] ml-1">▼</Text>
            </TouchableOpacity>
          ) : (
            <Text className="text-text-subtle text-xs">No agents available</Text>
          )}
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
    </ControllerKeyboardAvoidingView>
  );
}
