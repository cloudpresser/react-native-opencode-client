import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { KeyboardAvoidingView as ControllerKeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useHeaderHeight } from '@react-navigation/elements';
import { Server, Session, SSHConfig, SSHConnectionStatus } from '../../types';
import { SSHService } from '../../services/ssh';
import SSHStatusLine from './SSHStatusLine';
import SSHSettingsPanel from './SSHSettingsPanel';
import TerminalEmulator, { TerminalLine } from './TerminalEmulator';

interface TerminalTabProps {
  session: Session;
  server: Server;
}

export default function TerminalTab({ session, server }: TerminalTabProps) {
  const headerHeight = useHeaderHeight();
  const sshRef = useRef<SSHService | null>(null);

  const [sshStatus, setSSHStatus] = useState<SSHConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [sshConfig, setSSHConfig] = useState<SSHConfig>({
    host: server.host === 'localhost' ? '127.0.0.1' : server.host,
    port: server.sshPort ?? 22,
    username: server.sshUsername ?? '',
    password: server.sshPassword ?? '',
    privateKey: server.sshPrivateKey ?? '',
    passphrase: server.sshPassphrase ?? '',
  });

  // Clean up SSH on unmount
  useEffect(() => {
    return () => {
      sshRef.current?.disconnect();
    };
  }, []);

  const addLine = useCallback((type: TerminalLine['type'], content: string) => {
    setLines((prev) => [
      ...prev,
      { id: Date.now().toString() + Math.random(), type, content },
    ]);
  }, []);

  const handleConnect = useCallback(async () => {
    if (!sshConfig.username) {
      setErrorMessage('Username is required');
      setSSHStatus('error');
      return;
    }

    // Disconnect existing session if any
    if (sshRef.current) {
      sshRef.current.disconnect();
      sshRef.current = null;
    }

    const ssh = new SSHService();
    sshRef.current = ssh;

    // Wire up callbacks
    ssh.onStatus = (status) => {
      setSSHStatus(status);
      if (status === 'connected') {
        setErrorMessage(undefined);
      }
    };

    ssh.onData = (data) => {
      addLine('output', data);
    };

    ssh.onError = (error) => {
      addLine('error', error);
      setErrorMessage(error);
    };

    ssh.onClose = () => {
      addLine('system', '--- Connection closed ---');
      setSSHStatus('disconnected');
    };

    setSSHStatus('connecting');
    setErrorMessage(undefined);
    addLine('system', `Connecting to ${sshConfig.username}@${sshConfig.host}:${sshConfig.port}...`);

    try {
      await ssh.connect(sshConfig);
      addLine('system', 'SSH connected. Starting shell...');
      await ssh.startShell();
      addLine('system', 'Shell ready.');
    } catch (err: any) {
      const msg = err?.message || String(err);
      setErrorMessage(msg);
      setSSHStatus('error');
      addLine('error', `Connection failed: ${msg}`);
    }
  }, [sshConfig, addLine]);

  const handleDisconnect = useCallback(() => {
    sshRef.current?.disconnect();
    sshRef.current = null;
    setSSHStatus('disconnected');
    setErrorMessage(undefined);
    addLine('system', '--- Disconnected ---');
  }, [addLine]);

  const handleSendCommand = useCallback(
    (command: string) => {
      if (!sshRef.current?.hasShell) {
        addLine('error', 'No active shell. Connect first.');
        return;
      }
      // Send with newline to execute
      sshRef.current.write(command + '\n');
    },
    [addLine],
  );

  const handleClear = useCallback(() => {
    setLines([]);
  }, []);

  return (
    <ControllerKeyboardAvoidingView
      className="flex-1 bg-surface-elevated"
      behavior="translate-with-padding"
      keyboardVerticalOffset={headerHeight}
    >
      <SSHStatusLine
        status={sshStatus}
        errorMessage={errorMessage}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      <SSHSettingsPanel
        config={sshConfig}
        onConfigChange={setSSHConfig}
        disabled={sshStatus === 'connecting' || sshStatus === 'connected'}
      />

      <TerminalEmulator
        lines={lines}
        sshStatus={sshStatus}
        onSendCommand={handleSendCommand}
        onClear={handleClear}
      />
    </ControllerKeyboardAvoidingView>
  );
}
