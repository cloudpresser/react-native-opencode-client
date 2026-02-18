export type ConnectionStatus = 'connected' | 'disconnected' | 'checking';

export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  useSSL: boolean;
  apiKey?: string;
}

export interface Session {
  id: string;
  serverId: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
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

export interface TerminalState {
  history: string[];
  currentInput: string;
  isProcessing: boolean;
}


