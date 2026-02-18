import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Server, Session } from '../../types';
import { OpenCodeService } from '../../services/opencode';
import { useThemeColors } from '../../hooks/useThemeColors';

interface TerminalTabProps {
  session: Session;
  server: Server;
}

interface TerminalLine {
  id: string;
  type: 'command' | 'output' | 'error';
  content: string;
}

export default function TerminalTab({ session, server }: TerminalTabProps) {
  const colors = useThemeColors();
  const [command, setCommand] = useState('');
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: '0',
      type: 'output',
      content: 'OpenCode Terminal - Type commands to execute on the remote session',
    },
  ]);
  const [executing, setExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollViewRef = useRef<ScrollView>(null);
  const [service] = useState(() => new OpenCodeService(server));

  useEffect(() => {
    scrollToBottom();
  }, [lines]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const executeCommand = async () => {
    if (!command.trim() || executing) return;

    const commandText = command;
    setCommand('');

    setCommandHistory([...commandHistory, commandText]);
    setHistoryIndex(-1);

    const commandLine: TerminalLine = {
      id: Date.now().toString(),
      type: 'command',
      content: `$ ${commandText}`,
    };

    setLines((prev) => [...prev, commandLine]);
    setExecuting(true);

    try {
      const output = await service.executeCommand(session.id, commandText);

      const outputLine: TerminalLine = {
        id: (Date.now() + 1).toString(),
        type: 'output',
        content: output || '(no output)',
      };

      setLines((prev) => [...prev, outputLine]);
    } catch (error) {
      const errorLine: TerminalLine = {
        id: (Date.now() + 1).toString(),
        type: 'error',
        content: `Error: ${error}`,
      };

      setLines((prev) => [...prev, errorLine]);
    } finally {
      setExecuting(false);
    }
  };

  const handleHistoryUp = () => {
    if (commandHistory.length === 0) return;

    const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
    setHistoryIndex(newIndex);
    setCommand(commandHistory[newIndex]);
  };

  const handleHistoryDown = () => {
    if (historyIndex === -1) return;

    if (historyIndex === commandHistory.length - 1) {
      setHistoryIndex(-1);
      setCommand('');
    } else {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCommand(commandHistory[newIndex]);
    }
  };

  const clearTerminal = () => {
    setLines([
      {
        id: Date.now().toString(),
        type: 'output',
        content: 'Terminal cleared',
      },
    ]);
  };

  const renderLine = (line: TerminalLine): React.ReactElement => {
    const lineClass = line.type === 'command' 
      ? 'text-success font-bold' 
      : line.type === 'error' 
        ? 'text-danger' 
        : 'text-text';

    return (
      <Text key={line.id} className={`font-mono text-[13px] leading-5 mb-1 ${lineClass}`}>
        {line.content}
      </Text>
    );
  };

  return (
    <View className="flex-1 bg-surface-elevated">
      <View className="flex-row justify-between items-center p-4 bg-surface border-b border-border">
        <Text className="text-xl font-bold text-text">Terminal</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity className="bg-border-muted px-3 py-1.5 rounded-md min-w-[36] items-center" onPress={handleHistoryUp}>
            <Text className="text-text text-base font-bold">↑</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-border-muted px-3 py-1.5 rounded-md min-w-[36] items-center" onPress={handleHistoryDown}>
            <Text className="text-text text-base font-bold">↓</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-danger px-3 py-1.5 rounded-md" onPress={clearTerminal}>
            <Text className="text-white font-semibold">Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerClassName="p-3"
      >
        {lines.map(renderLine)}
        {executing && (
          <View className="flex-row items-center gap-2 mt-2">
            <ActivityIndicator size="small" color={colors.success} />
            <Text className="text-success text-[13px] font-mono">Executing...</Text>
          </View>
        )}
      </ScrollView>

      <View className="flex-row items-center p-3 bg-surface border-t border-border">
        <Text className="text-success text-base font-bold mr-2 font-mono">$</Text>
        <TextInput
          className="flex-1 text-text text-sm font-mono p-2 bg-surface-elevated rounded border border-border"
          value={command}
          onChangeText={setCommand}
          placeholder="Enter command..."
          placeholderTextColor={colors.textSubtle}
          onSubmitEditing={executeCommand}
          editable={!executing}
          autoCapitalize="none"
          autoCorrect={false}
          testID="terminal-input"
        />
        <TouchableOpacity
          className={`px-4 py-2 rounded-md ml-2 ${executing ? 'bg-border-muted' : 'bg-primary'}`}
          onPress={executeCommand}
          disabled={executing}
          testID="terminal-send-btn"
        >
          <Text className="text-white font-semibold">Run</Text>
        </TouchableOpacity>
      </View>

      <View className="p-2 bg-surface border-t border-border">
        <Text className="text-text-subtle text-[11px] text-center">
          Tip: Use ↑ ↓ buttons to navigate command history
        </Text>
      </View>
    </View>
  );
}