import { Ionicons } from '@expo/vector-icons';
import React, { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAvoidingView as ControllerKeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
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
const escapeByte = 27;

type KeyboardToolbarModifierButtonProps = {
  type: 'modifier';
  label: string;
  orderPreference: number;
  canApplyModifierToBytes: (bytes: Uint8Array<ArrayBuffer>) => boolean;
  applyModifierToBytes: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
};

type KeyboardToolbarInstantButtonProps = {
  type?: 'sendBytes';
  label?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  sendBytes: Uint8Array<ArrayBuffer>;
};

type KeyboardToolbarButtonProps = KeyboardToolbarModifierButtonProps | KeyboardToolbarInstantButtonProps;

function mapByteToCtrl(byte: number): number | null {
  if (byte === 32) return 0;
  if (byte === 63) return 127;

  const uppercase = byte >= 97 && byte <= 122 ? byte - 32 : byte;
  if (uppercase >= 65 && uppercase <= 90) {
    return uppercase & 0x1f;
  }

  if (uppercase >= 91 && uppercase <= 95) {
    return uppercase & 0x1f;
  }

  return null;
}

const ctrlModifier: KeyboardToolbarModifierButtonProps = {
  type: 'modifier',
  label: 'CTRL',
  orderPreference: 10,
  canApplyModifierToBytes: (bytes) => {
    const firstByte = bytes[0];
    if (firstByte === undefined) return false;
    return mapByteToCtrl(firstByte) != null;
  },
  applyModifierToBytes: (bytes) => {
    const firstByte = bytes[0];
    if (firstByte === undefined) return bytes;
    const ctrlByte = mapByteToCtrl(firstByte);
    if (ctrlByte == null) return bytes;
    return new Uint8Array([ctrlByte]);
  },
};

const altModifier: KeyboardToolbarModifierButtonProps = {
  type: 'modifier',
  label: 'ALT',
  orderPreference: 20,
  canApplyModifierToBytes: (bytes) => bytes.length > 0 && bytes[0] !== escapeByte,
  applyModifierToBytes: (bytes) => {
    const result = new Uint8Array(bytes.length + 1);
    result[0] = escapeByte;
    result.set(bytes, 1);
    return result;
  },
};

const keyboardToolbarButtonPresetToProps: Record<string, KeyboardToolbarButtonProps> = {
  esc: { label: 'ESC', sendBytes: new Uint8Array([27]) },
  '/': { label: '/', sendBytes: new Uint8Array([47]) },
  '|': { label: '|', sendBytes: new Uint8Array([124]) },
  home: { label: 'HOME', sendBytes: new Uint8Array([27, 91, 72]) },
  end: { label: 'END', sendBytes: new Uint8Array([27, 91, 70]) },
  pgup: { label: 'PGUP', sendBytes: new Uint8Array([27, 91, 53, 126]) },
  pgdn: { label: 'PGDN', sendBytes: new Uint8Array([27, 91, 54, 126]) },
  tab: { label: 'TAB', sendBytes: new Uint8Array([9]) },
  left: { iconName: 'arrow-back', sendBytes: new Uint8Array([27, 91, 68]) },
  up: { iconName: 'arrow-up', sendBytes: new Uint8Array([27, 91, 65]) },
  down: { iconName: 'arrow-down', sendBytes: new Uint8Array([27, 91, 66]) },
  right: { iconName: 'arrow-forward', sendBytes: new Uint8Array([27, 91, 67]) },
  ctrl: ctrlModifier,
  alt: altModifier,
};

function propsToKey(props: KeyboardToolbarButtonProps) {
  if ('label' in props && props.label) return props.label;
  if ('iconName' in props && props.iconName) return props.iconName;
  return 'key';
}

export default function TerminalTab({ session, server }: TerminalTabProps) {
  const colors = useThemeColors();
  const headerHeight = useHeaderHeight();
  const connectionRef = useRef<SshConnection | null>(null);
  const shellRef = useRef<SshShell | null>(null);
  const listenerIdRef = useRef<bigint | null>(null);
  const xtermRef = useRef<XtermWebViewHandle | null>(null);
  const terminalLayoutRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  const [sshStatus, setSSHStatus] = useState<SSHConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [russhReady, setRusshReady] = useState(false);
  const [viewReady, setViewReady] = useState(false);
  const [terminalReady, setTerminalReady] = useState(false);
  const [modifierKeysActive, setModifierKeysActive] = useState<KeyboardToolbarModifierButtonProps[]>([]);
  const sendBytesRef = useRef<(bytes: Uint8Array<ArrayBuffer>) => void>(() => {});
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

  const sendBytes = useCallback((input: Uint8Array<ArrayBuffer>) => {
    const shell = shellRef.current;
    if (!shell) return;

    let bytes = new Uint8Array(input);
    modifierKeysActive
      .slice()
      .sort((a, b) => a.orderPreference - b.orderPreference)
      .forEach((modifier) => {
        if (!modifier.canApplyModifierToBytes(bytes)) {
          return;
        }
        bytes = modifier.applyModifierToBytes(bytes);
      });

    void shell.sendData(bytes.buffer).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setSSHStatus('error');
    });

    requestAnimationFrame(() => {
      xtermRef.current?.focus();
    });
  }, [modifierKeysActive]);

  const focusTerminal = useCallback(() => {
    xtermRef.current?.focus();
    requestAnimationFrame(() => {
      xtermRef.current?.focus();
    });
    setTimeout(() => {
      xtermRef.current?.focus();
    }, 32);
  }, []);
  sendBytesRef.current = sendBytes;

  const handleTerminalData = useCallback((data: string) => {
    sendBytesRef.current(encoder.encode(data));
    focusTerminal();
  }, [focusTerminal]);

  const handleTerminalLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const nextWidth = Math.round(width);
    const nextHeight = Math.round(height);
    const previous = terminalLayoutRef.current;

    if (previous.width === nextWidth && previous.height === nextHeight) {
      return;
    }

    terminalLayoutRef.current = { width: nextWidth, height: nextHeight };

    requestAnimationFrame(() => {
      xtermRef.current?.fit();
      xtermRef.current?.focus();
    });
  }, []);

  const handleTerminalInitialized = useCallback(() => {
    setTerminalReady(true);
    xtermRef.current?.focus();
    xtermRef.current?.fit();
  }, []);

  if (!viewReady) {
    return <View className="flex-1 bg-surface-elevated" />;
  }

  return (
    <ControllerKeyboardAvoidingView
      className="flex-1 bg-surface-elevated"
      behavior="translate-with-padding"
      keyboardVerticalOffset={headerHeight}
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

      <TerminalViewport
        colors={colors}
        xtermRef={xtermRef}
        onLayout={handleTerminalLayout}
        onInitialized={handleTerminalInitialized}
        onData={handleTerminalData}
      />

      <KeyboardToolbar
        colors={colors}
        activeModifiers={modifierKeysActive}
        setActiveModifiers={setModifierKeysActive}
        sendBytes={sendBytes}
        focusTerminal={focusTerminal}
      />
    </ControllerKeyboardAvoidingView>
  );
}

function KeyboardToolbar({
  colors,
  activeModifiers,
  setActiveModifiers,
  sendBytes,
  focusTerminal,
}: {
  colors: ReturnType<typeof useThemeColors>;
  activeModifiers: KeyboardToolbarModifierButtonProps[];
  setActiveModifiers: React.Dispatch<React.SetStateAction<KeyboardToolbarModifierButtonProps[]>>;
  sendBytes: (bytes: Uint8Array<ArrayBuffer>) => void;
  focusTerminal: () => void;
}) {
  const handleToggleModifier = useCallback((modifier: KeyboardToolbarModifierButtonProps) => {
    const key = propsToKey(modifier);
    setActiveModifiers((current) =>
      current.some((item) => propsToKey(item) === key)
        ? current.filter((item) => propsToKey(item) !== key)
        : [...current, modifier],
    );
    focusTerminal();
  }, [focusTerminal, setActiveModifiers]);

  return (
    <View
      style={{
        height: 96,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <KeyboardToolbarRow>
        <KeyboardToolbarButton preset="esc" colors={colors} activeModifiers={activeModifiers} onToggleModifier={handleToggleModifier} sendBytes={sendBytes} />
        <KeyboardToolbarButton preset="/" colors={colors} activeModifiers={activeModifiers} onToggleModifier={handleToggleModifier} sendBytes={sendBytes} />
        <KeyboardToolbarButton preset="|" colors={colors} activeModifiers={activeModifiers} onToggleModifier={handleToggleModifier} sendBytes={sendBytes} />
        <KeyboardToolbarButton preset="home" colors={colors} activeModifiers={activeModifiers} onToggleModifier={handleToggleModifier} sendBytes={sendBytes} />
        <KeyboardToolbarButton preset="up" colors={colors} activeModifiers={activeModifiers} onToggleModifier={handleToggleModifier} sendBytes={sendBytes} />
        <KeyboardToolbarButton preset="end" colors={colors} activeModifiers={activeModifiers} onToggleModifier={handleToggleModifier} sendBytes={sendBytes} />
        <KeyboardToolbarButton preset="pgup" colors={colors} activeModifiers={activeModifiers} onToggleModifier={handleToggleModifier} sendBytes={sendBytes} />
      </KeyboardToolbarRow>
      <KeyboardToolbarRow>
        <KeyboardToolbarButton preset="tab" colors={colors} activeModifiers={activeModifiers} onToggleModifier={handleToggleModifier} sendBytes={sendBytes} />
        <KeyboardToolbarButton preset="ctrl" colors={colors} activeModifiers={activeModifiers} onToggleModifier={handleToggleModifier} sendBytes={sendBytes} />
        <KeyboardToolbarButton preset="alt" colors={colors} activeModifiers={activeModifiers} onToggleModifier={handleToggleModifier} sendBytes={sendBytes} />
        <KeyboardToolbarButton preset="left" colors={colors} activeModifiers={activeModifiers} onToggleModifier={handleToggleModifier} sendBytes={sendBytes} />
        <KeyboardToolbarButton preset="down" colors={colors} activeModifiers={activeModifiers} onToggleModifier={handleToggleModifier} sendBytes={sendBytes} />
        <KeyboardToolbarButton preset="right" colors={colors} activeModifiers={activeModifiers} onToggleModifier={handleToggleModifier} sendBytes={sendBytes} />
        <KeyboardToolbarButton preset="pgdn" colors={colors} activeModifiers={activeModifiers} onToggleModifier={handleToggleModifier} sendBytes={sendBytes} />
      </KeyboardToolbarRow>
    </View>
  );
}

const TerminalViewport = memo(function TerminalViewport({
  colors,
  xtermRef,
  onLayout,
  onInitialized,
  onData,
}: {
  colors: ReturnType<typeof useThemeColors>;
  xtermRef: React.RefObject<XtermWebViewHandle | null>;
  onLayout: (event: LayoutChangeEvent) => void;
  onInitialized: () => void;
  onData: (data: string) => void;
}) {
  return (
    <View
      style={{ flex: 1, minHeight: 0, backgroundColor: colors.surfaceElevated }}
      onLayout={onLayout}
    >
      <XtermJsWebView
        ref={xtermRef}
        style={{ width: '100%', height: '100%' }}
        xtermOptions={{
          theme: {
            background: colors.surfaceElevated,
            foreground: colors.text,
          },
        }}
        onInitialized={onInitialized}
        onData={onData}
        autoFit
      />
    </View>
  );
});

function KeyboardToolbarRow({ children }: { children?: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', flex: 1 }}>{children}</View>;
}

function KeyboardToolbarButton({
  preset,
  colors,
  activeModifiers,
  onToggleModifier,
  sendBytes,
  style,
}: {
  preset: string;
  colors: ReturnType<typeof useThemeColors>;
  activeModifiers: KeyboardToolbarModifierButtonProps[];
  onToggleModifier: (modifier: KeyboardToolbarModifierButtonProps) => void;
  sendBytes: (bytes: Uint8Array<ArrayBuffer>) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const props = keyboardToolbarButtonPresetToProps[preset];
  const key = propsToKey(props);
  const modifierActive = props.type === 'modifier' && activeModifiers.some((item) => propsToKey(item) === key);

  return (
    <Pressable
      style={[
        {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          borderRightWidth: 1,
          borderBottomWidth: 1,
          borderColor: colors.border,
          backgroundColor: modifierActive ? colors.primary : colors.surface,
        },
        style,
      ]}
      onPressIn={() => {
        if (props.type === 'modifier') {
          onToggleModifier(props);
          return;
        }

        sendBytes(new Uint8Array(props.sendBytes));
      }}
    >
      {'label' in props && props.label ? (
        <Text style={{ color: modifierActive ? colors.onPrimary : colors.text, fontSize: 12, fontWeight: '600' }}>
          {props.label}
        </Text>
      ) : 'iconName' in props && props.iconName ? (
        <Ionicons
          name={props.iconName}
          size={18}
          color={modifierActive ? colors.onPrimary : colors.text}
        />
      ) : null}
    </Pressable>
  );
}
