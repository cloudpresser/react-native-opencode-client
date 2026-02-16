import { createOpencode } from 'ai-sdk-provider-opencode-sdk';
import { streamText } from 'ai';
import { Server, Session, GitFile } from '../types';

export class OpenCodeService {
  private baseUrl: string;
  private apiKey?: string;

  constructor(server: Server) {
    const protocol = server.useSSL ? 'https' : 'http';
    this.baseUrl = `${protocol}://${server.host}:${server.port}`;
    this.apiKey = server.apiKey;
  }

  getProvider() {
    return createOpencode({
      baseUrl: this.baseUrl,
    });
  }

  async getSessions(): Promise<Session[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch sessions');
      return response.json();
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return [];
    }
  }

  async createSession(title: string): Promise<Session | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error('Failed to create session');
      return response.json();
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`, {
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
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/git/status`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch git status');
      return response.json();
    } catch (error) {
      console.error('Error fetching git status:', error);
      return [];
    }
  }

  async getGitDiff(sessionId: string, filePath: string): Promise<string> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/sessions/${sessionId}/git/diff?file=${encodeURIComponent(filePath)}`,
        { headers: this.getHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch git diff');
      return response.text();
    } catch (error) {
      console.error('Error fetching git diff:', error);
      return '';
    }
  }

  async sendMessage(
    sessionId: string,
    message: string,
    attachments?: Array<{ type: string; content: string; name: string }>,
    onChunk?: (text: string) => void
  ): Promise<string> {
    try {
      const provider = this.getProvider();
      const model = provider('opencode');

      const messages: any[] = [{ role: 'user', content: message }];

      // Add attachments if any
      if (attachments && attachments.length > 0) {
        const content: any[] = [{ type: 'text', text: message }];
        
        for (const attachment of attachments) {
          if (attachment.type === 'image') {
            content.push({
              type: 'image',
              image: attachment.content,
            });
          } else {
            // For file attachments, include as text
            content.push({
              type: 'text',
              text: `\n\n--- File: ${attachment.name} ---\n${attachment.content}`,
            });
          }
        }
        
        messages[0] = { role: 'user', content };
      }

      let fullResponse = '';

      const result = await streamText({
        model,
        messages,
      });

      for await (const chunk of result.textStream) {
        fullResponse += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }

      return fullResponse;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async executeCommand(sessionId: string, command: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/terminal`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ command }),
      });
      if (!response.ok) throw new Error('Failed to execute command');
      const data = await response.json();
      return data.output || '';
    } catch (error) {
      console.error('Error executing command:', error);
      return `Error: ${error}`;
    }
  }

  async getFileContent(sessionId: string, filePath: string): Promise<string> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/sessions/${sessionId}/files?path=${encodeURIComponent(filePath)}`,
        { headers: this.getHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch file content');
      return response.text();
    } catch (error) {
      console.error('Error fetching file content:', error);
      return '';
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }
}
