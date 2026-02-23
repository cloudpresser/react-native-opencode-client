import { Server, Session, GitFile, Project, FileNode } from '../types';
import EventSource from 'react-native-sse';
import base64 from 'base-64';

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ReasoningPart {
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

export interface ToolInvocationPart {
  type: 'tool-invocation';
  toolInvocation: ToolInvocation;
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
  | SourceUrlPart
  | StepStartPart
  | FilePart
  | ImagePart;

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
        title: apiSession.title,
        createdAt: apiSession.time?.created
          ? new Date(apiSession.time.created * 1000).toISOString()
          : new Date().toISOString(),
        updatedAt: apiSession.time?.updated
          ? new Date(apiSession.time.updated * 1000).toISOString()
          : undefined,
      }));
    } catch (error) {
      console.error('Error fetching sessions:', error);
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
    onChunk?: (text: string) => void
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
      const response = await fetch(`${this.baseUrl}/session/${sessionId}/message`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ parts }),
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

  async streamMessage(
    sessionId: string,
    message: string,
    attachments?: Array<{ type: string; content: string; name: string; mimeType?: string }>,
    onChunk?: (text: string) => void
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

      // Use SSE endpoint for streaming
      const eventSource = new EventSource(
        `${this.baseUrl}/event`,
        {
          headers: this.getHeaders() as any,
        }
      );

      let fullResponse = '';

      return new Promise((resolve, reject) => {
        // First, send the message asynchronously
        fetch(`${this.baseUrl}/session/${sessionId}/prompt_async`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ parts }),
        }).catch(reject);

        eventSource.addEventListener('message', (event: any) => {
          try {
            const data = JSON.parse(event.data);
            
            // Check if this event is for our session
            if (data.sessionID === sessionId && data.type === 'text') {
              const chunk = data.text || '';
              fullResponse += chunk;
              if (onChunk) {
                onChunk(chunk);
              }
            }
            
            // Check if message is complete
            if (data.done) {
              eventSource.close();
              resolve(fullResponse);
            }
          } catch (err) {
            console.error('Error parsing event:', err);
          }
        });

        eventSource.addEventListener('error', (error: any) => {
          console.error('EventSource error:', error);
          eventSource.close();
          // Fallback to non-streaming if SSE fails
          this.sendMessage(sessionId, message, attachments, onChunk)
            .then(resolve)
            .catch(reject);
        });

        // Timeout after 5 minutes
        setTimeout(() => {
          eventSource.close();
          resolve(fullResponse || 'Request timed out');
        }, 300000);
      });
    } catch (error) {
      console.error('Error streaming message:', error);
      throw error;
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

  async listFiles(directory: string, path?: string): Promise<FileNode[]> {
    try {
      const params = new URLSearchParams();
      params.append('directory', directory);
      if (path) params.append('path', path);
      const url = `${this.baseUrl}/file/list?${params.toString()}`;

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

  async findDirectories(directory: string, query: string, limit: number = 50): Promise<FileNode[]> {
    try {
      const params = new URLSearchParams();
      params.append('directory', directory);
      params.append('query', query);
      params.append('type', 'directory');
      params.append('limit', limit.toString());
      const url = `${this.baseUrl}/find/files?${params.toString()}`;

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
