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
  projectId?: string;
  directory?: string;
  parentId?: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Project {
  id?: string;
  serverId: string;
  worktree: string;
  name?: string;
  vcs?: 'git';
  vcsDir?: string;
  createdAt?: string;
  initializedAt?: string;
}

export interface FileNode {
  name: string;
  path: string;
  absolute: string;
  type: 'file' | 'directory';
  ignored: boolean;
}

export interface ChatMessageToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, any>;
  state: 'call' | 'partial-call' | 'result';
  result?: string;
  title?: string;
}

export interface ChatQuestionOption {
  label: string;
  description: string;
}

export interface ChatQuestion {
  /** The requestID from the server (e.g. "que_...") — used for reply/reject */
  requestId: string;
  /** The question text / prompt */
  question: string;
  /** Short header label (max 12 chars) */
  header: string;
  /** Available choices */
  options: ChatQuestionOption[];
  /** Whether multiple options can be selected */
  multiple?: boolean;
  /** Whether the user can provide free-text (custom) input */
  custom?: boolean;
}

export interface ChatPermission {
  /** The requestID from the server (e.g. "perm_...") — used for approve/deny */
  requestId: string;
  /** The permission request description */
  message: string;
  /** Short header label */
  header?: string;
  /** Optional detailed explanation */
  details?: string;
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


