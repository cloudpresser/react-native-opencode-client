import React, { useState, useRef, useCallback, useEffect } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  RnRussh,
  type ListenerEvent,
  type SshConnection,
  type SshShell,
} from '@fressh/react-native-uniffi-russh';
import {
  XtermJsWebView,
  type XtermWebViewHandle,
} from '@fressh/react-native-xtermjs-webview';
import { Server, Session, SSHConfig, SSHConnectionStatus } from '../../types';
import SSHStatusLine from './SSHStatusLine';
import SSHSettingsPanel from './SSHSettingsPanel';
import { useThemeColors } from '../../hooks/useThemeColors';

interface TerminalTabProps {
  session: Session;
  server: Server;
}

const encoder = new TextEncoder();

export default function TerminalTab({ session, server }: TerminalTabProps) {
  const colors = useThemeColors();
  const connectionRef = useRef<SshConnection | null>(null);
  const shellRef = useRef<SshShell | null>(null);
  const listenerIdRef = useRef<bigint | null>(null);
  const xtermRef = useRef<XtermWebViewHandle | null>(null);

  const [sshStatus, setSSHStatus] = useState<SSHConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [russhReady, setRusshReady] = useState(false);
  const [viewReady, setViewReady] = useState(false);
  const [terminalReady, setTerminalReady] = useState(false);
  const [sshConfig, setSSHConfig] = useState<SSHConfig>({
    host: server.host === 'localhost' ? '127.0.0.1' : server.host,
    port: server.sshPort ?? 22,
    username: server.sshUsername ?? '',
    password: server.sshPassword ?? '',
    privateKey: server.sshPrivateKey ?? '',
    passphrase: server.sshPassphrase ?? '',
  });

  useEffect(() => {
    let cancelled = false;

    RnRussh.uniffiInitAsync()
      .then(() => {
        if (!cancelled) {
          setRusshReady(true);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : String(error));
          setSSHStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        setViewReady(true);
      }, 16);

      return () => {
        clearTimeout(timer);
        setViewReady(false);
        setTerminalReady(false);
      };
    }, []),
  );

  const cleanupShell = useCallback(async () => {
    const shell = shellRef.current;
    if (shell && listenerIdRef.current != null) {
      try {
        shell.removeListener(listenerIdRef.current);
      } catch {}
    }
    listenerIdRef.current = null;

    if (shell) {
      try {
        await shell.close();
      } catch {}
    }
    shellRef.current = null;

    const connection = connectionRef.current;
    if (connection) {
      try {
        await connection.disconnect();
      } catch {}
    }
    connectionRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      void cleanupShell();
      xtermRef.current?.flush();
    };
  }, [cleanupShell]);

  const attachShellListener = useCallback((shell: SshShell) => {
    if (listenerIdRef.current != null) {
      try {
        shell.removeListener(listenerIdRef.current);
      } catch {}
      listenerIdRef.current = null;
    }

    const replay = shell.readBuffer({ mode: 'head' });
    if (replay.chunks.length > 0) {
      xtermRef.current?.writeMany(replay.chunks.map((chunk) => new Uint8Array(chunk.bytes)));
      xtermRef.current?.flush();
    }

    const id = shell.addListener((ev: ListenerEvent) => {
      if ('kind' in ev) {
        return;
      }

      const bytes = new Uint8Array(ev.bytes);
      xtermRef.current?.write(bytes);
    }, { cursor: { mode: 'seq', seq: replay.nextSeq } });

    listenerIdRef.current = id;
  }, []);

  useEffect(() => {
    if (!terminalReady || !shellRef.current) {
      return;
    }

    attachShellListener(shellRef.current);
    xtermRef.current?.focus();
  }, [attachShellListener, terminalReady]);

  const handleConnect = useCallback(async () => {
    if (!russhReady) {
      setErrorMessage('Terminal transport is still loading');
      setSSHStatus('error');
      return;
    }

    if (!sshConfig.username) {
      setErrorMessage('Username is required');
      setSSHStatus('error');
      return;
    }

    await cleanupShell();

    setSSHStatus('connecting');
    setErrorMessage(undefined);
    xtermRef.current?.clear();

    try {
      const security = sshConfig.privateKey
        ? { type: 'key' as const, privateKey: sshConfig.privateKey }
        : { type: 'password' as const, password: sshConfig.password || '' };

      const connection = await RnRussh.connect({
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
        security,
        onServerKey: async () => true,
        onDisconnected: () => {
          listenerIdRef.current = null;
          shellRef.current = null;
          connectionRef.current = null;
          setSSHStatus('disconnected');
          xtermRef.current?.write(encoder.encode('\r\n--- Connection closed ---\r\n'));
        },
      });

      connectionRef.current = connection;
      setSSHStatus('connected');

      const shell = await connection.startShell({ term: 'Xterm256' });
      shellRef.current = shell;

      if (terminalReady) {
        attachShellListener(shell);
        xtermRef.current?.focus();
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      setErrorMessage(msg);
      setSSHStatus('error');
      xtermRef.current?.write(encoder.encode(`\r\nConnection failed: ${msg}\r\n`));
      await cleanupShell();
    }
  }, [attachShellListener, cleanupShell, russhReady, sshConfig]);

  const handleDisconnect = useCallback(async () => {
    await cleanupShell();
    setSSHStatus('disconnected');
    setErrorMessage(undefined);
    xtermRef.current?.write(encoder.encode('\r\n--- Disconnected ---\r\n'));
  }, [cleanupShell]);

  const handleTerminalData = useCallback((data: string) => {
    const shell = shellRef.current;
    if (!shell) return;

    void shell.sendData(encoder.encode(data).buffer).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setSSHStatus('error');
    });
  }, []);

  if (!viewReady) {
    return <View className="flex-1 bg-surface-elevated" />;
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-surface-elevated"
      behavior="height"
      keyboardVerticalOffset={120}
      style={{ gap: 4 }}
    >
      <SSHStatusLine
        status={sshStatus}
        errorMessage={errorMessage}
        onConnect={() => void handleConnect()}
        onDisconnect={() => void handleDisconnect()}
      />

      <SSHSettingsPanel
        config={sshConfig}
        onConfigChange={setSSHConfig}
        disabled={sshStatus === 'connecting' || sshStatus === 'connected'}
      />

      <View style={{ flex: 1, minHeight: 0, backgroundColor: colors.surfaceElevated }}>
        <XtermJsWebView
          ref={xtermRef}
          style={{ width: '100%', height: '100%' }}
          xtermOptions={{
            theme: {
              background: colors.surfaceElevated,
              foreground: colors.text,
            },
          }}
          onInitialized={() => {
            setTerminalReady(true);
            xtermRef.current?.focus();
            xtermRef.current?.fit();
          }}
          onData={handleTerminalData}
          autoFit
        />
      </View>
    </KeyboardAvoidingView>
  );
}
