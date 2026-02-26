import SSHClient, { PtyType } from '@dylankenneally/react-native-ssh-sftp';
import { Platform } from 'react-native';
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
      let message = error?.message || String(error);
      // NMSSH does not support iOS Simulator - provide a helpful hint
      if (Platform.OS === 'ios' && message.includes('Connection to host')) {
        message += '\n\nNote: SSH is not supported on the iOS Simulator. Please use a real device.';
      }
      this.onError?.(`Connection failed: ${message}`);
      throw new Error(message);
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

  /**
   * Send terminal environment setup commands after shell start.
   * Sets TERM=xterm-256color for maximum compatibility (fixes Ghostty
   * and other non-standard terminal types) and sets the correct
   * terminal dimensions via stty since the SSH library doesn't expose
   * a native PTY resize API.
   *
   * The command is wrapped to suppress echo: stty -echo hides the
   * command itself from appearing in the terminal, then stty echo
   * restores normal input echoing. A final clear + reset-cursor
   * ensures the user sees a clean prompt.
   */
  async setupTerminal(cols: number, rows: number): Promise<void> {
    if (!this.client || !this.shellStarted) return;
    // Use a single compound command that:
    // 1. Temporarily disables echo so the setup commands are invisible
    // 2. Sets TERM for broad compatibility (fixes Ghostty/non-standard terminals)
    // 3. Sets the correct terminal dimensions via stty
    // 4. Re-enables echo
    // 5. Clears the screen so the user starts with a clean slate
    const cmd = [
      'stty -echo',
      'export TERM=xterm-256color',
      `stty cols ${cols} rows ${rows}`,
      'stty echo',
      'clear',
    ].join(' && ');
    await this.client.writeToShell(`${cmd}\n`);
  }

  /**
   * Resize the remote terminal using stty.
   * This is a workaround because the SSH library doesn't expose
   * the SSH window-change message (RFC 4254).
   *
   * Uses stty -echo/echo to suppress the command from appearing
   * in the terminal output.
   */
  async resizeShell(cols: number, rows: number): Promise<void> {
    if (!this.client || !this.shellStarted) return;
    await this.client.writeToShell(
      `stty -echo && stty cols ${cols} rows ${rows} && stty echo\n`,
    );
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
