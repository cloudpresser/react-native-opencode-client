import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { KeyboardAvoidingView as ControllerKeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useHeaderHeight } from '@react-navigation/elements';
import { Server, Session, SSHConfig, SSHConnectionStatus } from '../../types';
import { SSHService } from '../../services/ssh';
import SSHStatusLine from './SSHStatusLine';
import SSHSettingsPanel from './SSHSettingsPanel';
import XTerm, { XTermRef } from './XTerm';
import { useThemeColors } from '../../hooks/useThemeColors';

interface TerminalTabProps {
  session: Session;
  server: Server;
}

export default function TerminalTab({ session, server }: TerminalTabProps) {
  const headerHeight = useHeaderHeight();
  const sshRef = useRef<SSHService | null>(null);
  const xtermRef = useRef<XTermRef | null>(null);
  const colors = useThemeColors();

  const [sshStatus, setSSHStatus] = useState<SSHConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
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

  // Track the latest known terminal dimensions
  const termDimensionsRef = useRef<{ cols: number; rows: number }>({ cols: 80, rows: 24 });

  const handleTerminalData = useCallback((data: string) => {
    if (sshRef.current?.hasShell) {
      sshRef.current.write(data);
    }
  }, []);

  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTerminalResize = useCallback(({ cols, rows }: { cols: number; rows: number }) => {
    termDimensionsRef.current = { cols, rows };
    // Debounce resize commands to avoid flooding the shell during rapid layout changes
    if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    resizeTimerRef.current = setTimeout(() => {
      if (sshRef.current?.hasShell) {
        sshRef.current.resizeShell(cols, rows);
      }
    }, 150);
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
      xtermRef.current?.write(data);
    };

    ssh.onError = (error) => {
      const msg = `\r\n\x1b[31mError: ${error}\x1b[0m\r\n`;
      xtermRef.current?.write(msg);
      setErrorMessage(error);
    };

    ssh.onClose = () => {
      xtermRef.current?.write('\r\n\x1b[33m--- Connection closed ---\x1b[0m\r\n');
      setSSHStatus('disconnected');
    };

    setSSHStatus('connecting');
    setErrorMessage(undefined);
    xtermRef.current?.write(`\r\n\x1b[32mConnecting to ${sshConfig.username}@${sshConfig.host}:${sshConfig.port}...\x1b[0m\r\n`);

    try {
      await ssh.connect(sshConfig);
      xtermRef.current?.write('\r\n\x1b[32mSSH connected. Starting shell...\x1b[0m\r\n');
      await ssh.startShell();
      // Let the shell initialize (e.g. .bashrc/.zshrc) before sending setup commands
      await new Promise((r) => setTimeout(r, 500));
      // Set TERM=xterm-256color for Ghostty compatibility and sync terminal dimensions
      const { cols, rows } = termDimensionsRef.current;
      await ssh.setupTerminal(cols, rows);
      // Give the clear command time to execute, then reset the local xterm buffer
      // so the user starts with a pristine terminal showing only the shell prompt
      setTimeout(() => {
        xtermRef.current?.clear();
      }, 300);
      xtermRef.current?.focus();
    } catch (err: any) {
      const msg = err?.message || String(err);
      setErrorMessage(msg);
      setSSHStatus('error');
      xtermRef.current?.write(`\r\n\x1b[31mConnection failed: ${msg}\x1b[0m\r\n`);
    }
  }, [sshConfig]);

  const handleDisconnect = useCallback(() => {
    sshRef.current?.disconnect();
    sshRef.current = null;
    setSSHStatus('disconnected');
    setErrorMessage(undefined);
    xtermRef.current?.write('\r\n\x1b[33m--- Disconnected ---\x1b[0m\r\n');
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

      <View style={{ flex: 1, backgroundColor: colors.surfaceElevated }}>
        <XTerm
          ref={xtermRef}
          onData={handleTerminalData}
          onResize={handleTerminalResize}
          theme={{
            background: colors.surfaceElevated,
            foreground: colors.text,
            cursor: colors.text,
            selection: colors.primary + '40', // 40 = 25% opacity
          }}
        />
      </View>
    </ControllerKeyboardAvoidingView>
  );
}
