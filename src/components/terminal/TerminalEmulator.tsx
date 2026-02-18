import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { SSHConnectionStatus } from '../../types';
import { useThemeColors } from '../../hooks/useThemeColors';

interface TerminalLine {
  id: string;
  type: 'output' | 'error' | 'info' | 'system';
  content: string;
}

interface TerminalEmulatorProps {
  lines: TerminalLine[];
  sshStatus: SSHConnectionStatus;
  onSendCommand: (command: string) => void;
  onClear: () => void;
}

export default function TerminalEmulator({
  lines,
  sshStatus,
  onSendCommand,
  onClear,
}: TerminalEmulatorProps) {
  const colors = useThemeColors();
  const scrollViewRef = useRef<ScrollView>(null);
  const [inputText, setInputText] = React.useState('');
  const [commandHistory, setCommandHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState(-1);

  const isConnected = sshStatus === 'connected';

  useEffect(() => {
    // Auto-scroll to bottom when new lines appear
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 50);
  }, [lines]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !isConnected) return;

    setCommandHistory((prev) => [...prev, text]);
    setHistoryIndex(-1);
    setInputText('');
    onSendCommand(text);
  };

  const handleHistoryUp = () => {
    if (commandHistory.length === 0) return;
    const newIndex =
      historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
    setHistoryIndex(newIndex);
    setInputText(commandHistory[newIndex]);
  };

  const handleHistoryDown = () => {
    if (historyIndex === -1) return;
    if (historyIndex === commandHistory.length - 1) {
      setHistoryIndex(-1);
      setInputText('');
    } else {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setInputText(commandHistory[newIndex]);
    }
  };

  const renderLine = (line: TerminalLine) => {
    const colorClass =
      line.type === 'error'
        ? 'text-danger'
        : line.type === 'info' || line.type === 'system'
          ? 'text-primary'
          : 'text-text';

    return (
      <Text
        key={line.id}
        className={`font-mono text-[13px] leading-5 ${colorClass}`}
        selectable
      >
        {line.content}
      </Text>
    );
  };

  if (!isConnected) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-text-subtle text-4xl mb-4">🔒</Text>
        <Text className="text-text-subtle text-base font-semibold text-center">
          SSH Not Connected
        </Text>
        <Text className="text-text-subtle text-sm text-center mt-2">
          Connect to the SSH server to use the terminal
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Toolbar */}
      <View className="flex-row items-center justify-between px-3 py-1.5 bg-surface border-b border-border">
        <Text className="text-text-subtle text-xs">Terminal</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity
            className="bg-border-muted px-2.5 py-1 rounded min-w-[32] items-center"
            onPress={handleHistoryUp}
          >
            <Text className="text-text text-xs font-bold">↑</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-border-muted px-2.5 py-1 rounded min-w-[32] items-center"
            onPress={handleHistoryDown}
          >
            <Text className="text-text text-xs font-bold">↓</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-danger/10 border border-danger/20 px-2.5 py-1 rounded"
            onPress={onClear}
          >
            <Text className="text-danger text-xs font-semibold">Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Terminal output */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 bg-surface-elevated"
        contentContainerClassName="p-3"
        keyboardShouldPersistTaps="handled"
      >
        {lines.map(renderLine)}
      </ScrollView>

      {/* Input bar */}
      <View className="flex-row items-center p-2 bg-surface border-t border-border">
        <Text className="text-success text-sm font-bold mr-2 font-mono">$</Text>
        <TextInput
          className="flex-1 text-text text-sm font-mono p-2 bg-surface-elevated rounded border border-border"
          value={inputText}
          onChangeText={setInputText}
          placeholder="Enter command..."
          placeholderTextColor={colors.textSubtle}
          onSubmitEditing={handleSend}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          blurOnSubmit={false}
          testID="terminal-input"
        />
        <TouchableOpacity
          className="px-3 py-2 rounded-md ml-2 bg-primary"
          onPress={handleSend}
          testID="terminal-send-btn"
        >
          <Text className="text-white font-semibold text-sm">Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export type { TerminalLine };
