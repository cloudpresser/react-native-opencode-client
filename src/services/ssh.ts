import SSHClient, { PtyType } from '@dylankenneally/react-native-ssh-sftp';
import { SSHConfig, SSHConnectionStatus } from '../types';

type SSHEventCallback = (data: string) => void;

export class SSHService {
  private client: SSHClient | null = null;
  private shellStarted = false;
  private _status: SSHConnectionStatus = 'disconnected';

  // Public callback properties - set these before calling connect()
  onStatus: ((status: SSHConnectionStatus) => void) | null = null;
  onData: SSHEventCallback | null = null;
  onError: SSHEventCallback | null = null;
  onClose: (() => void) | null = null;

  get status(): SSHConnectionStatus {
    return this._status;
  }

  private setStatus(status: SSHConnectionStatus) {
    this._status = status;
    this.onStatus?.(status);
  }

  async connect(config: SSHConfig): Promise<void> {
    this.setStatus('connecting');

    try {
      if (config.privateKey) {
        this.client = await SSHClient.connectWithKey(
          config.host,
          config.port,
          config.username,
          config.privateKey,
          config.passphrase || '',
        );
      } else if (config.password) {
        this.client = await SSHClient.connectWithPassword(
          config.host,
          config.port,
          config.username,
          config.password,
        );
      } else {
        throw new Error('Either a private key or password is required');
      }

      this.setStatus('connected');
    } catch (error: any) {
      this.setStatus('error');
      const message = error?.message || String(error);
      this.onError?.(`Connection failed: ${message}`);
      throw error;
    }
  }

  async startShell(): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected');
    }

    if (this.shellStarted) return;

    // Register shell data listener before starting the shell
    // The library's handleEvent dispatches event.value (the string) to the handler,
    // not the raw event object. So the handler receives the data string directly.
    this.client.on('Shell', (data: string) => {
      if (data) {
        this.onData?.(data);
      }
    });

    await this.client.startShell(PtyType.XTERM);
    this.shellStarted = true;
  }

  async write(data: string): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected');
    }

    await this.client.writeToShell(data);
  }

  disconnect(): void {
    try {
      if (this.client) {
        if (this.shellStarted) {
          this.client.closeShell();
          this.shellStarted = false;
        }
        this.client.disconnect();
        this.client = null;
      }
    } catch (_) {
      // Ignore errors during disconnect
    } finally {
      this.setStatus('disconnected');
      this.onClose?.();
    }
  }

  get isConnected(): boolean {
    return this._status === 'connected' && this.client !== null;
  }

  get hasShell(): boolean {
    return this.shellStarted;
  }
}
