export type ConnectionStatus = 'connected' | 'disconnected' | 'checking' | 'error';

export interface ConnectionLogEntry {
  id: string;
  serverId: string;
  timestamp: string;
  status: 'success' | 'failed';
  errorType?: 'network' | 'auth' | 'timeout' | 'server' | 'unknown';
  httpCode?: number;
  errorMessage?: string;
  latencyMs?: number;
  requestUrl?: string;
  requestMethod?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
}

export type ConnectionLogCallback = (entry: ConnectionLogEntry) => void;

export type SSHConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  useSSL: boolean;
  apiKey?: string;
  sshPort?: number;
  sshUsername?: string;
  sshPassword?: string;
  sshPrivateKey?: string;
  sshPassphrase?: string;
}

export interface Session {
  id: string;
  serverId: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ChatMessageToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  state: 'call' | 'partial-call' | 'result';
  result?: string;
  title?: string;
}

export interface ChatMessagePart {
  type: 'text' | 'tool-call' | 'reasoning';
  content?: string;
  toolCall?: ChatMessageToolCall;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string; // plain-text fallback / user messages
  parts?: ChatMessagePart[];
  attachments?: MessageAttachment[];
  timestamp: string;
}

export interface MessageAttachment {
  id: string;
  type: 'file' | 'image';
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
}

export interface GitFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  diff?: string;
}

export interface FileAnnotation {
  filePath: string;
  content: string;
  annotations: Array<{
    lineStart: number;
    lineEnd: number;
    note: string;
  }>;
}

export interface Agent {
  name: string;
  description?: string;
  mode: 'primary' | 'subagent' | 'all';
  hidden?: boolean;
  native?: boolean;
}

export interface TerminalState {
  history: string[];
  currentInput: string;
  isProcessing: boolean;
}


