import { Server, Session, GitFile, Project, FileNode, Agent } from '../types';
import EventSource from 'react-native-sse';
import base64 from 'base-64';

interface PartEnvelope {
  id?: string;
  messageID?: string;
  sessionID?: string;
}

export interface TextPart extends PartEnvelope {
  type: 'text';
  text: string;
}

export interface ReasoningPart extends PartEnvelope {
  type: 'reasoning';
  text: string;
}

export interface ToolInvocationCall {
  state: 'call' | 'partial-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  step?: number;
}

export interface ToolInvocationResult {
  state: 'result';
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  result: string;
  step?: number;
}

export type ToolInvocation = ToolInvocationCall | ToolInvocationResult;

export interface ToolInvocationPart extends PartEnvelope {
  type: 'tool-invocation';
  toolInvocation: ToolInvocation;
}

export interface ToolStatePending {
  status: 'pending';
  input: Record<string, any>;
  raw?: string;
}

export interface ToolStateRunning {
  status: 'running';
  input: Record<string, any>;
  title?: string;
  metadata?: Record<string, any>;
  time?: { start: number };
}

export interface ToolStateCompleted {
  status: 'completed';
  input: Record<string, any>;
  output: string;
  title: string;
  metadata?: Record<string, any>;
  time?: { start: number; end: number; compacted?: number };
  attachments?: FilePart[];
}

export interface ToolStateError {
  status: 'error';
  input: Record<string, any>;
  error: string;
  metadata?: Record<string, any>;
}

export type ToolState = ToolStatePending | ToolStateRunning | ToolStateCompleted | ToolStateError;

export interface ToolPart extends PartEnvelope {
  type: 'tool';
  callID: string;
  tool: string;
  state: ToolState;
  metadata?: Record<string, any>;
}

export interface SourceUrlPart {
  type: 'source-url';
  sourceId: string;
  url: string;
  title?: string;
}

export interface StepStartPart {
  type: 'step-start';
}

export interface FilePart {
  type: 'file';
  mediaType?: string;
  filename?: string;
  url?: string;
  data?: string;
  mimeType?: string;
}

export interface ImagePart {
  type: 'image';
  image?: string;
}

export type MessagePart =
  | TextPart
  | ReasoningPart
  | ToolInvocationPart
  | ToolPart
  | SourceUrlPart
  | StepStartPart
  | FilePart
  | ImagePart;

export interface StreamPartDelta {
  type: 'message.part.delta';
  sessionID: string;
  messageID: string;
  partID: string;
  field: string;
  delta: string;
}

export interface StreamPartUpdated {
  type: 'message.part.updated';
  part: MessagePart;
  delta?: string;
}

export type StreamPartEvent = StreamPartUpdated | StreamPartDelta;

export type PermissionReply = 'once' | 'always' | 'reject';

/** Shape of an individual question inside a question.asked SSE event */
export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionItem {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
}

/** Payload from the server's `question.asked` SSE event */
export interface QuestionAskedEvent {
  id: string;           // requestID – used for reply/reject
  sessionID: string;
  questions: QuestionItem[];
  tool?: { messageID: string; callID: string };
}

/** Permission request item */
export interface PermissionItem {
  type: string;
  patterns?: string[];
  metadata?: Record<string, any>;
  always?: string[];
}

/** Payload from the server's `permission.asked` SSE event */
export interface PermissionAskedEvent {
  id: string;           // requestID – used for v2 permission replies
  sessionID: string;
  permission: PermissionItem;
  tool?: { messageID: string; callID: string };
}

function normalizePermissionEvent(raw: any): PermissionAskedEvent {
  const permission = raw?.permission;

  if (typeof permission === 'string') {
    return {
      id: raw.id,
      sessionID: raw.sessionID,
      permission: {
        type: permission,
        patterns: raw.patterns,
        metadata: raw.metadata,
        always: raw.always,
      },
      tool: raw.tool,
    };
  }

  return {
    id: raw.id,
    sessionID: raw.sessionID,
    permission: {
      type: permission?.type || 'unknown',
      patterns: permission?.patterns ?? raw.patterns,
      metadata: permission?.metadata ?? raw.metadata,
      always: permission?.always ?? raw.always,
    },
    tool: raw.tool,
  };
}

export interface ToolMetadata {
  title?: string;
  time?: { start?: number; end?: number };
  [key: string]: any;
}

export interface Message {
  info: {
    id: string;
    sessionID: string;
    role: 'user' | 'assistant';
    time: {
      created: number;
      completed?: number;
    };
  };
  metadata?: {
    tool?: Record<string, ToolMetadata>;
    assistant?: {
      modelID?: string;
      providerID?: string;
      cost?: number;
      tokens?: { input?: number; output?: number; reasoning?: number };
    };
  };
  parts: MessagePart[];
}

// Raw API session shape (different from our local Session type)
interface ApiSession {
  id: string;
  projectID?: string;
  directory?: string;
  title: string;
  time: {
    created: number;
    updated: number;
  };
  version?: string;
  parentID?: string;
}

// Raw API project shape
interface ApiProject {
  id: string;
  worktree: string;
  vcsDir?: string;
  vcs?: 'git';
  time: {
    created: number;
    initialized?: number;
  };
}

// Raw API path shape
interface ApiPath {
  home: string;
  directory: string;
  state?: string;
  config?: string;
  worktree?: string;
}

// Raw API file node shape
interface ApiFileNode {
  name: string;
  path: string;
  absolute: string;
  type: 'file' | 'directory';
  ignored: boolean;
}

interface FileDiff {
  path: string;
  status: 'M' | 'A' | 'D' | 'R';
  diff?: string;
}

export class OpenCodeService {
  private baseUrl: string;
  private username: string;
  private password?: string;

  constructor(server: Server) {
    const protocol = server.useSSL ? 'https' : 'http';
    this.baseUrl = `${protocol}://${server.host}:${server.port}`;
    this.username = 'opencode';
    this.password = server.apiKey;
  }

  async getSessions(directory?: string): Promise<Session[]> {
    try {
      const params = new URLSearchParams();
      if (directory) params.append('directory', directory);
      const queryString = params.toString();
      const url = `${this.baseUrl}/session${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        headers: this.getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch sessions');
      const data: ApiSession[] = await response.json();
      // Map API session format (time.created/updated as Unix timestamps)
      // to our local Session format (createdAt/updatedAt as ISO strings)
      return data.map(apiSession => ({
        id: apiSession.id,
        serverId: '', // Will be set by the caller
        projectId: apiSession.projectID,
        directory: apiSession.directory,
        parentId: apiSession.parentID,
        title: apiSession.title,
        createdAt: apiSession.time?.created
          ? new Date(apiSession.time.created).toISOString()
          : new Date().toISOString(),
        updatedAt: apiSession.time?.updated
          ? new Date(apiSession.time.updated).toISOString()
          : undefined,
      }));
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return [];
    }
  }

  async getAgents(): Promise<Agent[]> {
    try {
      const response = await fetch(`${this.baseUrl}/agent`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch agents');
      const data: Agent[] = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching agents:', error);
      return [];
    }
  }

  async createSession(title: string, directory?: string): Promise<Session | null> {
    try {
      const params = new URLSearchParams();
      if (directory) params.append('directory', directory);
      const queryString = params.toString();
      const url = `${this.baseUrl}/session${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to create session: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to create session: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  }

  async updateSession(sessionId: string, title: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/session/${sessionId}`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        console.error(`Failed to update session: ${response.status}`);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error updating session:', error);
      return false;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/session/${sessionId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }

  async getGitStatus(sessionId: string): Promise<GitFile[]> {
    try {
      const response = await fetch(`${this.baseUrl}/file/status`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch git status');
      const data = await response.json();
      
      // Convert git status to our GitFile format
      return data.files?.map((file: any) => ({
        path: file.path,
        status: file.status,
        additions: file.additions || 0,
        deletions: file.deletions || 0,
      })) || [];
    } catch (error) {
      console.error('Error fetching git status:', error);
      return [];
    }
  }

  async getGitDiff(sessionId: string, filePath?: string): Promise<FileDiff[]> {
    try {
      const url = filePath 
        ? `${this.baseUrl}/session/${sessionId}/diff?path=${encodeURIComponent(filePath)}`
        : `${this.baseUrl}/session/${sessionId}/diff`;
      
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });
      
      if (!response.ok) throw new Error('Failed to fetch git diff');
      return response.json();
    } catch (error) {
      console.error('Error fetching git diff:', error);
      return [];
    }
  }

  async sendMessage(
    sessionId: string,
    message: string,
    attachments?: Array<{ type: string; content: string; name: string; mimeType?: string }>,
    onChunk?: (text: string) => void,
    agentId?: string
  ): Promise<string> {
    try {
      // Prepare message parts
      const parts: MessagePart[] = [
        {
          type: 'text',
          text: message,
        }
      ];

      // Add attachments
      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          if (attachment.type === 'image') {
            parts.push({
              type: 'image',
              image: attachment.content, // base64
            });
          } else {
            // For file attachments
            parts.push({
              type: 'file',
              data: attachment.content, // base64 or text content
              mimeType: attachment.mimeType || 'text/plain',
            });
          }
        }
      }

      // Send message to OpenCode server
      const body: Record<string, any> = { parts };
      if (agentId) {
        body.agentID = agentId;
      }

      const response = await fetch(`${this.baseUrl}/session/${sessionId}/message`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Failed to send message');

      // Get the response - OpenCode returns the full message
      const result: Message = await response.json();
      
      // Extract text from response parts
      let fullResponse = '';
      for (const part of result.parts) {
        if (part.type === 'text' && part.text) {
          fullResponse += part.text;
          if (onChunk) {
            onChunk(part.text);
          }
        }
      }

      return fullResponse;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Send a message and stream the response via SSE events.
   *
   * Connects to GET /event, waits for server.connected, then sends the
   * prompt via POST /session/{id}/prompt_async. Streams incremental text
   * deltas and resolves when the session goes idle or a question is pending.
   */
  async streamMessage(
    sessionId: string,
    message: string,
    attachments?: Array<{ type: string; content: string; name: string; mimeType?: string }>,
    callbacks?: {
      onTextDelta?: (delta: string) => void;
      onPartUpdated?: (event: StreamPartEvent) => void;
      onQuestionAsked?: (event: QuestionAskedEvent) => void;
      onPermissionAsked?: (event: PermissionAskedEvent) => void;
      onComplete?: () => void;
    },
    agentId?: string
  ): Promise<void> {
    // Prepare message parts
    const parts: MessagePart[] = [
      {
        type: 'text',
        text: message,
      }
    ];

    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        if (attachment.type === 'image') {
          parts.push({
            type: 'image',
            image: attachment.content,
          });
        } else {
          parts.push({
            type: 'file',
            data: attachment.content,
            mimeType: attachment.mimeType || 'text/plain',
          });
        }
      }
    }

    // Connect to SSE event stream
    const eventSource = new EventSource(
      `${this.baseUrl}/event`,
      {
        headers: this.getHeaders() as any,
      }
    );

    return new Promise<void>((resolve, reject) => {
      let prompted = false;

      eventSource.addEventListener('message', (event: any) => {
        try {
          const data = JSON.parse(event.data);

          // Once connected, send the prompt
          if (data.type === 'server.connected' && !prompted) {
            prompted = true;
            const asyncBody: Record<string, any> = { parts };
            if (agentId) {
              asyncBody.agentID = agentId;
            }
            fetch(`${this.baseUrl}/session/${sessionId}/prompt_async`, {
              method: 'POST',
              headers: this.getHeaders(),
              body: JSON.stringify(asyncBody),
            }).catch((err) => {
              console.error('Error sending prompt_async:', err);
              eventSource.close();
              reject(err);
            });
            return;
          }

          // Full part snapshot updates from assistant
          if (data.type === 'message.part.updated') {
            const part = data.properties?.part;
            const delta = data.properties?.delta;

            if (part?.sessionID === sessionId) {
              if (delta && part.type === 'text') {
                callbacks?.onTextDelta?.(delta);
              }
              callbacks?.onPartUpdated?.({
                type: 'message.part.updated',
                part,
                ...(delta ? { delta } : {}),
              });
            }
            return;
          }

          // Forward-compatible delta events from newer API transports
          if (data.type === 'message.part.delta') {
            const props = data.properties;

            if (props?.sessionID === sessionId) {
              if (props?.field === 'text' && props?.delta) {
                callbacks?.onTextDelta?.(props.delta);
              }
              callbacks?.onPartUpdated?.({
                type: 'message.part.delta',
                sessionID: props.sessionID,
                messageID: props.messageID,
                partID: props.partID,
                field: props.field,
                delta: props.delta,
              });
            }
            return;
          }

          // The server is asking the user a question (tool blocking)
          if (data.type === 'question.asked') {
            const props = data.properties;
            if (props?.sessionID === sessionId) {
              callbacks?.onQuestionAsked?.({
                id: props.id,
                sessionID: props.sessionID,
                questions: props.questions,
                tool: props.tool,
              });
            }
            return;
          }

          // The server is requesting permission (tool blocking)
          if (data.type === 'permission.asked') {
            const props = data.properties;
            if (props?.sessionID === sessionId) {
              callbacks?.onPermissionAsked?.({
                ...normalizePermissionEvent(props),
              });
            }
            return;
          }

          // Session went idle – the LLM finished processing
          if (data.type === 'session.status') {
            const props = data.properties;
            if (props?.sessionID === sessionId) {
              const statusType = props?.status?.type;
              if (statusType === 'idle') {
                eventSource.close();
                callbacks?.onComplete?.();
                resolve();
              }
            }
            return;
          }
        } catch (err) {
          console.error('Error parsing SSE event:', err);
        }
      });

      eventSource.addEventListener('error', (error: any) => {
        console.error('EventSource error:', error);
        eventSource.close();
        reject(error);
      });

      // Timeout after 10 minutes
      setTimeout(() => {
        eventSource.close();
        callbacks?.onComplete?.();
        resolve();
      }, 600000);
    });
  }

  /**
   * Reply to a pending question.
   * @param requestId  The question request ID (e.g. "que_...")
   * @param answers    Array of answers, one per question. Each answer is an
   *                   array of selected option labels (or free-text entries).
   */
  async replyToQuestion(requestId: string, answers: string[][]): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/question/${requestId}/reply`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ answers }),
      });
      return response.ok;
    } catch (error) {
      console.error('Error replying to question:', error);
      return false;
    }
  }

  /**
   * Reject / dismiss a pending question.
   */
  async rejectQuestion(requestId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/question/${requestId}/reject`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch (error) {
      console.error('Error rejecting question:', error);
      return false;
    }
  }

  /**
   * Get the status of all non-idle sessions.
   * Returns a map of sessionId → { type: 'busy' | 'retry', ... }.
   * Sessions not in the map are idle.
   */
  async getSessionStatuses(): Promise<Record<string, { type: string; [key: string]: any }>> {
    try {
      const response = await fetch(`${this.baseUrl}/session/status`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch session statuses');
      return response.json();
    } catch (error) {
      console.error('Error fetching session statuses:', error);
      return {};
    }
  }

  /**
   * List all pending questions across all sessions.
   */
  async listPendingQuestions(): Promise<QuestionAskedEvent[]> {
    try {
      const response = await fetch(`${this.baseUrl}/question`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch pending questions');
      return response.json();
    } catch (error) {
      console.error('Error fetching pending questions:', error);
      return [];
    }
  }

  /**
   * Reply to a permission request using the v2 API contract.
   */
  async replyToPermission(requestId: string, reply: PermissionReply, message?: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/permission/${requestId}/reply`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ reply, ...(message ? { message } : {}) }),
      });
      return response.ok;
    } catch (error) {
      console.error('Error replying to permission:', error);
      return false;
    }
  }

  /**
   * List all pending permission requests (for background polling/notifications).
   */
  async listPendingPermissions(): Promise<PermissionAskedEvent[]> {
    try {
      const response = await fetch(`${this.baseUrl}/permission`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch pending permissions');
      const data = await response.json();
      return data.map((item: any) => normalizePermissionEvent(item));
    } catch (error) {
      console.error('Error fetching pending permissions:', error);
      return [];
    }
  }

  async getMessages(sessionId: string, limit?: number, before?: string): Promise<Message[]> {
    try {
      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (before) params.append('before', before);
      
      const queryString = params.toString();
      const url = `${this.baseUrl}/session/${sessionId}/message${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });
      
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  async abortSession(sessionId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/session/${sessionId}/abort`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch (error) {
      console.error('Error aborting session:', error);
      return false;
    }
  }

  async executeCommand(sessionId: string, command: string): Promise<string> {
    try {
      // OpenCode doesn't have a direct terminal endpoint in the API
      // We'll send it as a message with a special format
      const message = `Execute command: \`${command}\``;
      return await this.sendMessage(sessionId, message);
    } catch (error) {
      console.error('Error executing command:', error);
      return `Error: ${error}`;
    }
  }

  async getFileContent(filePath: string): Promise<string> {
    try {
      const response = await fetch(
        `${this.baseUrl}/file/content?path=${encodeURIComponent(filePath)}`,
        { headers: this.getHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch file content');
      return response.text();
    } catch (error) {
      console.error('Error fetching file content:', error);
      return '';
    }
  }

  async findFiles(query: string): Promise<string[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/find/file?query=${encodeURIComponent(query)}`,
        { headers: this.getHeaders() }
      );
      if (!response.ok) throw new Error('Failed to find files');
      return response.json();
    } catch (error) {
      console.error('Error finding files:', error);
      return [];
    }
  }

  async searchText(pattern: string): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/find?pattern=${encodeURIComponent(pattern)}`,
        { headers: this.getHeaders() }
      );
      if (!response.ok) throw new Error('Failed to search text');
      return response.json();
    } catch (error) {
      console.error('Error searching text:', error);
      return [];
    }
  }

  async getProjects(): Promise<Project[]> {
    try {
      const response = await fetch(`${this.baseUrl}/project`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data: ApiProject[] = await response.json();
      return data.map(apiProject => ({
        id: apiProject.id,
        serverId: '', // Will be set by the caller
        worktree: apiProject.worktree,
        vcs: apiProject.vcs,
        vcsDir: apiProject.vcsDir,
        createdAt: apiProject.time?.created
          ? new Date(apiProject.time.created * 1000).toISOString()
          : undefined,
        initializedAt: apiProject.time?.initialized
          ? new Date(apiProject.time.initialized * 1000).toISOString()
          : undefined,
      }));
    } catch (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
  }

  async getPath(directory?: string): Promise<ApiPath | null> {
    try {
      const params = new URLSearchParams();
      if (directory) params.append('directory', directory);
      const queryString = params.toString();
      const url = `${this.baseUrl}/path${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        headers: this.getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch path');
      return response.json();
    } catch (error) {
      console.error('Error fetching path:', error);
      return null;
    }
  }

  async listFiles(directory: string, path: string = '.'): Promise<FileNode[]> {
    try {
      const params = new URLSearchParams();
      params.append('directory', directory);
      params.append('path', path);
      const url = `${this.baseUrl}/file?${params.toString()}`;

      const response = await fetch(url, {
        headers: this.getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to list files');
      return response.json();
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  }

  async findDirectories(directory: string, query: string, limit: number = 50): Promise<string[]> {
    try {
      const params = new URLSearchParams();
      params.append('directory', directory);
      params.append('query', query);
      params.append('type', 'directory');
      params.append('limit', limit.toString());
      const url = `${this.baseUrl}/find/file?${params.toString()}`;

      const response = await fetch(url, {
        headers: this.getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to find directories');
      return response.json();
    } catch (error) {
      console.error('Error finding directories:', error);
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/global/health`, {
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch (error) {
      console.error('Error checking health:', error);
      return false;
    }
  }

  async healthCheckWithDetails(timeoutMs: number = 5000): Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    requestUrl: string;
    requestMethod: string;
    requestHeaders: Record<string, string>;
    responseHeaders: Record<string, string>;
    responseBody: string;
  }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const url = `${this.baseUrl}/global/health`;
    const method = 'GET';
    const requestHeaders = this.getHeaders();
    
    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value: string, key: string) => {
        responseHeaders[key] = value;
      });

      let responseBody = '';
      try {
        responseBody = await response.text();
        if (responseBody.length > 1024) {
          responseBody = responseBody.substring(0, 1024) + '... (truncated)';
        }
      } catch (_) {}

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        requestUrl: url,
        requestMethod: method,
        requestHeaders,
        responseHeaders,
        responseBody,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      error._requestUrl = url;
      error._requestMethod = method;
      error._requestHeaders = requestHeaders;
      throw error;
    }
  }

  private getHeaders(): Record<string, string> {
const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.username && this.password) {
      try {
        const credentials = base64.encode(`${this.username}:${this.password}`);
        headers['Authorization'] = `Basic ${credentials}`;
      } catch (e) {
        console.error('Base64 encoding failed:', e);
      }
    }
    
    return headers;
  }
}
