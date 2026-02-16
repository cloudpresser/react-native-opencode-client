import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Server, Session } from '../../types';
import { OpenCodeService } from '../../services/opencode';

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

    // Add command to history
    setCommandHistory([...commandHistory, commandText]);
    setHistoryIndex(-1);

    // Add command line
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

  const renderLine = (line: TerminalLine) => {
    let lineStyle = styles.outputLine;

    if (line.type === 'command') {
      lineStyle = styles.commandLine;
    } else if (line.type === 'error') {
      lineStyle = styles.errorLine;
    }

    return (
      <Text key={line.id} style={[styles.line, lineStyle]}>
        {line.content}
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Terminal</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.historyButton} onPress={handleHistoryUp}>
            <Text style={styles.historyButtonText}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.historyButton} onPress={handleHistoryDown}>
            <Text style={styles.historyButtonText}>↓</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearButton} onPress={clearTerminal}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.terminalContainer}
        contentContainerStyle={styles.terminalContent}
      >
        {lines.map(renderLine)}
        {executing && (
          <View style={styles.executingContainer}>
            <ActivityIndicator size="small" color="#4ec9b0" />
            <Text style={styles.executingText}>Executing...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <Text style={styles.prompt}>$</Text>
        <TextInput
          style={styles.input}
          value={command}
          onChangeText={setCommand}
          placeholder="Enter command..."
          placeholderTextColor="#666"
          onSubmitEditing={executeCommand}
          editable={!executing}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.executeButton, executing && styles.executeButtonDisabled]}
          onPress={executeCommand}
          disabled={executing}
        >
          <Text style={styles.executeButtonText}>Run</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoBar}>
        <Text style={styles.infoText}>
          Tip: Use ↑ ↓ buttons to navigate command history
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2d2d2d',
    borderBottomWidth: 1,
    borderBottomColor: '#3d3d3d',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  historyButton: {
    backgroundColor: '#3d3d3d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 36,
    alignItems: 'center',
  },
  historyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  terminalContainer: {
    flex: 1,
  },
  terminalContent: {
    padding: 12,
  },
  line: {
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  commandLine: {
    color: '#4ec9b0',
    fontWeight: 'bold',
  },
  outputLine: {
    color: '#d4d4d4',
  },
  errorLine: {
    color: '#f48771',
  },
  executingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  executingText: {
    color: '#4ec9b0',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#2d2d2d',
    borderTopWidth: 1,
    borderTopColor: '#3d3d3d',
  },
  prompt: {
    color: '#4ec9b0',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
    fontFamily: 'monospace',
  },
  input: {
    flex: 1,
    color: '#d4d4d4',
    fontSize: 14,
    fontFamily: 'monospace',
    padding: 8,
    backgroundColor: '#1e1e1e',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3d3d3d',
  },
  executeButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  executeButtonDisabled: {
    backgroundColor: '#555',
  },
  executeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  infoBar: {
    padding: 8,
    backgroundColor: '#2d2d2d',
    borderTopWidth: 1,
    borderTopColor: '#3d3d3d',
  },
  infoText: {
    color: '#858585',
    fontSize: 11,
    textAlign: 'center',
  },
});
